import { randomUUID } from "node:crypto";
import { get, head, issueSignedToken, presignUrl } from "@vercel/blob";
import {
  MARKETING_ASSET_MAX_BYTES,
  MARKETING_ASSET_MIME_TYPES,
  type MarketingAssetKind,
  type MarketingAssetMimeType,
} from "../domain/assets";

export type MarketingSignInput = {
  method: "PUT";
  key: string;
  contentType: MarketingAssetMimeType;
  contentLength: number;
  checksumSha256: string;
  ifNoneMatch: "*";
  expiresInSeconds: number;
};

export interface MarketingObjectStore {
  sign(input: MarketingSignInput): Promise<string>;
  head?(input: { key: string }): Promise<{ mimeType: string; sizeBytes: number; checksumSha256: string } | null>;
  get?(input: { key: string }): Promise<Response>;
}

export class MarketingPrivateMediaError extends Error {
  constructor(message = "Marketing media unavailable") {
    super(message);
    this.name = "MarketingPrivateMediaError";
  }
}

export class MarketingPrivateMedia {
  private readonly expiresInSeconds = 300;

  constructor(
    private readonly options: {
      signer: MarketingObjectStore;
      now?: () => Date;
      uuid?: () => string;
      bucket?: string;
    },
  ) {}

  async createUploadIntent(input: {
    workspaceId: string;
    kind: MarketingAssetKind;
    mimeType: string;
    sizeBytes: number;
    checksumSha256: string;
    objectKey?: string;
  }) {
    validateMarketingObjectInput(input);
    const mimeType = input.mimeType as MarketingAssetMimeType;
    const objectKey = resolveUploadObjectKey({
      workspaceId: input.workspaceId,
      mimeType,
      uuid: this.options.uuid,
      objectKey: input.objectKey,
    });
    const uploadUrl = await this.options.signer.sign({
      method: "PUT",
      key: objectKey,
      contentType: mimeType,
      contentLength: input.sizeBytes,
      checksumSha256: input.checksumSha256,
      ifNoneMatch: "*",
      expiresInSeconds: this.expiresInSeconds,
    });
    return {
      objectKey,
      uploadUrl,
      uploadHeaders: uploadHeaders(mimeType),
      expiresAt: this.expiry(),
    };
  }

  async verifyUploadedObject(input: {
    objectKey: string;
    mimeType: string;
    sizeBytes: number;
    checksumSha256: string;
  }) {
    assertMarketingObjectKey(input.objectKey);
    if (!this.options.signer.head) throw new MarketingPrivateMediaError("Object verification is unavailable");
    const actual = await this.options.signer.head({ key: input.objectKey });
    if (!actual || actual.mimeType !== input.mimeType || actual.sizeBytes !== input.sizeBytes) {
      throw new MarketingPrivateMediaError("Uploaded object metadata does not match intent");
    }
    if (actual.checksumSha256 && actual.checksumSha256 !== input.checksumSha256) {
      throw new MarketingPrivateMediaError("Uploaded object metadata does not match intent");
    }
  }

  async fetchObject(objectKey: string): Promise<Response> {
    assertMarketingObjectKey(objectKey);
    if (!this.options.signer.get) throw new MarketingPrivateMediaError("Object fetch is unavailable");
    return this.options.signer.get({ key: objectKey });
  }

  private expiry() {
    return new Date((this.options.now?.() ?? new Date()).getTime() + this.expiresInSeconds * 1000);
  }
}

function validateMarketingObjectInput(input: {
  kind: string;
  mimeType: string;
  sizeBytes: number;
  checksumSha256: string;
}) {
  if (!["LOGO", "PORTRAIT"].includes(input.kind))
    throw new MarketingPrivateMediaError("Unsupported marketing asset kind");
  if (!MARKETING_ASSET_MIME_TYPES.includes(input.mimeType as MarketingAssetMimeType)) {
    throw new MarketingPrivateMediaError("Unsupported marketing asset type");
  }
  if (!Number.isInteger(input.sizeBytes) || input.sizeBytes < 1 || input.sizeBytes > MARKETING_ASSET_MAX_BYTES) {
    throw new MarketingPrivateMediaError("Marketing asset is too large");
  }
  if (!/^[A-Za-z0-9+/]{43}=$/.test(input.checksumSha256)) {
    throw new MarketingPrivateMediaError("Invalid SHA-256 checksum");
  }
}

function resolveUploadObjectKey(input: {
  workspaceId: string;
  mimeType: MarketingAssetMimeType;
  uuid?: () => string;
  objectKey?: string;
}) {
  const scope = `workspaces/${segment(input.workspaceId)}/marketing/`;
  if (!input.objectKey) return `${scope}${input.uuid?.() ?? randomUUID()}.${extensionFor(input.mimeType)}`;

  assertMarketingObjectKey(input.objectKey);
  if (!input.objectKey.startsWith(scope)) throw new MarketingPrivateMediaError("Marketing object unavailable");
  return input.objectKey;
}

function assertMarketingObjectKey(objectKey: string) {
  if (!/^workspaces\/[A-Za-z0-9_-]+\/marketing\/[A-Za-z0-9_-]+\.(jpg|png|webp)$/.test(objectKey)) {
    throw new MarketingPrivateMediaError("Marketing object unavailable");
  }
}

function uploadHeaders(mimeType: MarketingAssetMimeType) {
  return { "Content-Type": mimeType } as const;
}

function extensionFor(mimeType: MarketingAssetMimeType) {
  return mimeType === "image/jpeg" ? "jpg" : mimeType.split("/")[1];
}

function segment(value: string) {
  const safe = value
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!safe) throw new MarketingPrivateMediaError("Invalid object scope");
  return safe;
}

export class VercelBlobMarketingObjectStore implements MarketingObjectStore {
  async sign(input: MarketingSignInput) {
    const validUntil = Date.now() + input.expiresInSeconds * 1000;
    const signedToken = await issueSignedToken({
      pathname: input.key,
      operations: ["put"],
      validUntil,
      allowedContentTypes: [input.contentType],
      maximumSizeInBytes: input.contentLength,
    });
    const { presignedUrl } = await presignUrl(signedToken, {
      operation: "put",
      access: "private",
      pathname: input.key,
      validUntil,
      allowedContentTypes: [input.contentType],
      maximumSizeInBytes: input.contentLength,
      allowOverwrite: false,
    });
    return presignedUrl;
  }

  async head(input: { key: string }) {
    try {
      const output = await head(input.key);
      return {
        mimeType: output.contentType?.split(";")[0] ?? "",
        sizeBytes: output.size,
        checksumSha256: "",
      };
    } catch {
      return null;
    }
  }

  async get(input: { key: string }) {
    const output = await get(input.key, { access: "private", useCache: false });
    if (!output || output.statusCode !== 200 || !output.stream) throw new MarketingPrivateMediaError();
    return new Response(output.stream, {
      headers: { "Content-Type": output.blob.contentType?.split(";")[0] ?? "application/octet-stream" },
    });
  }
}

export function marketingPrivateMediaFromEnvironment(signer = vercelBlobMarketingObjectStoreFromEnvironment()) {
  return new MarketingPrivateMedia({ signer });
}

export function vercelBlobMarketingObjectStoreFromEnvironment() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error("BLOB_READ_WRITE_TOKEN is required for Vercel Blob assets");
  return new VercelBlobMarketingObjectStore();
}
