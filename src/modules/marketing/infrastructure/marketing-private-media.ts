import { randomUUID } from "node:crypto";
import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  MARKETING_ASSET_MAX_BYTES,
  MARKETING_ASSET_MIME_TYPES,
  type MarketingAssetKind,
  type MarketingAssetMimeType,
} from "../domain/assets";

export type MarketingSignInput = {
  method: "PUT";
  bucket: string;
  key: string;
  contentType: MarketingAssetMimeType;
  contentLength: number;
  checksumSha256: string;
  ifNoneMatch: "*";
  expiresInSeconds: number;
};

export interface MarketingObjectStore {
  sign(input: MarketingSignInput): Promise<string>;
  head?(input: {
    bucket: string;
    key: string;
  }): Promise<{ mimeType: string; sizeBytes: number; checksumSha256: string } | null>;
  get?(input: { bucket: string; key: string }): Promise<Response>;
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
      bucket: string;
      signer: MarketingObjectStore;
      now?: () => Date;
      uuid?: () => string;
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
      bucket: this.options.bucket,
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
      uploadHeaders: uploadHeaders(mimeType, input.checksumSha256),
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
    const actual = await this.options.signer.head({ bucket: this.options.bucket, key: input.objectKey });
    if (
      !actual ||
      actual.mimeType !== input.mimeType ||
      actual.sizeBytes !== input.sizeBytes ||
      actual.checksumSha256 !== input.checksumSha256
    ) {
      throw new MarketingPrivateMediaError("Uploaded object metadata does not match intent");
    }
  }

  async fetchObject(objectKey: string): Promise<Response> {
    assertMarketingObjectKey(objectKey);
    if (!this.options.signer.get) throw new MarketingPrivateMediaError("Object fetch is unavailable");
    return this.options.signer.get({ bucket: this.options.bucket, key: objectKey });
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

function uploadHeaders(mimeType: MarketingAssetMimeType, checksumSha256: string) {
  return { "Content-Type": mimeType, "x-amz-checksum-sha256": checksumSha256, "If-None-Match": "*" } as const;
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

export class S3MarketingObjectStore implements MarketingObjectStore {
  private readonly client: S3Client;

  constructor(config: { endpoint: string; region: string; accessKeyId: string; secretAccessKey: string }) {
    this.client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      forcePathStyle: true,
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    });
  }

  async sign(input: MarketingSignInput) {
    return getSignedUrl(
      this.client,
      new PutObjectCommand({
        Bucket: input.bucket,
        Key: input.key,
        ContentType: input.contentType,
        ContentLength: input.contentLength,
        ChecksumSHA256: input.checksumSha256,
        IfNoneMatch: input.ifNoneMatch,
      }),
      { expiresIn: input.expiresInSeconds, signableHeaders: new Set(["content-type"]) },
    );
  }

  async head(input: { bucket: string; key: string }) {
    try {
      const output = await this.client.send(
        new HeadObjectCommand({ Bucket: input.bucket, Key: input.key, ChecksumMode: "ENABLED" }),
      );
      if (!output.ChecksumSHA256 || output.ContentLength === undefined) return null;
      return {
        mimeType: output.ContentType?.split(";")[0] ?? "",
        sizeBytes: output.ContentLength,
        checksumSha256: output.ChecksumSHA256,
      };
    } catch {
      return null;
    }
  }

  async get(input: { bucket: string; key: string }) {
    try {
      const output = await this.client.send(new GetObjectCommand({ Bucket: input.bucket, Key: input.key }));
      const body = output.Body?.transformToWebStream();
      if (!body) throw new MarketingPrivateMediaError();
      return new Response(body, {
        headers: { "Content-Type": output.ContentType?.split(";")[0] ?? "application/octet-stream" },
      });
    } catch (error) {
      if (error instanceof MarketingPrivateMediaError) throw error;
      throw new MarketingPrivateMediaError();
    }
  }
}

export function marketingPrivateMediaFromEnvironment(signer = s3MarketingObjectStoreFromEnvironment()) {
  const bucket = process.env.S3_BUCKET;
  if (!bucket) throw new Error("S3_BUCKET is required for marketing assets");
  return new MarketingPrivateMedia({ bucket, signer });
}

export function s3MarketingObjectStoreFromEnvironment() {
  const endpoint = process.env.S3_ENDPOINT;
  const region = process.env.S3_REGION;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  if (!endpoint || !region || !accessKeyId || !secretAccessKey)
    throw new Error("S3 endpoint, region, and credentials are required");
  return new S3MarketingObjectStore({ endpoint, region, accessKeyId, secretAccessKey });
}
