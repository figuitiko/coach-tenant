import { randomUUID } from "node:crypto";
import { get, head, issueSignedToken, presignUrl } from "@vercel/blob";

export type SignInput = {
  method: "PUT" | "GET";
  key: string;
  bucket?: string;
  contentType?: string;
  contentLength?: number;
  checksumSha256?: string;
  ifNoneMatch?: "*";
  expiresInSeconds: number;
};
export interface PrivateObjectSigner {
  sign(input: SignInput): Promise<string>;
  head?(input: { key: string }): Promise<{ mimeType: string; sizeBytes: number; checksumSha256: string } | null>;
}

export class PrivateMediaError extends Error {}

export class VercelBlobPrivateMedia {
  private readonly expiresInSeconds = 300;
  constructor(private readonly options: { signer: PrivateObjectSigner; now?: () => Date; bucket?: string }) {}

  async createUploadIntent(input: {
    workspaceId: string;
    studentId: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    checksumSha256: string;
  }) {
    validateUpload(input);
    const extension = input.mimeType === "image/jpeg" ? "jpg" : input.mimeType.split("/")[1];
    const objectKey = `workspaces/${segment(input.workspaceId)}/students/${segment(input.studentId)}/progress/${randomUUID()}.${extension}`;
    const uploadUrl = await this.signPut({ ...input, objectKey, expiresInSeconds: this.expiresInSeconds });
    return { objectKey, uploadUrl, uploadHeaders: uploadHeaders(input), expiresAt: this.expiry() };
  }

  async createDownloadUrl(input: { workspaceId: string; studentId: string; objectKey: string }) {
    const prefix = `workspaces/${segment(input.workspaceId)}/students/${segment(input.studentId)}/progress/`;
    if (!input.objectKey.startsWith(prefix) || input.objectKey.includes(".."))
      throw new PrivateMediaError("Private object unavailable");
    const downloadUrl = await this.options.signer.sign({
      method: "GET",
      key: input.objectKey,
      expiresInSeconds: this.expiresInSeconds,
    });
    return { downloadUrl, expiresAt: this.expiry() };
  }

  async signUploadIntent(input: {
    objectKey: string;
    mimeType: string;
    sizeBytes: number;
    checksumSha256: string;
    expiresAt: Date;
  }) {
    const remaining = Math.floor((input.expiresAt.getTime() - (this.options.now?.() ?? new Date()).getTime()) / 1000);
    if (remaining < 1) throw new PrivateMediaError("Upload intent expired");
    return this.signPut({ ...input, expiresInSeconds: Math.min(remaining, this.expiresInSeconds) });
  }

  async verifyUploadedObject(input: { objectKey: string; mimeType: string; sizeBytes: number; checksumSha256: string }) {
    if (!this.options.signer.head) throw new PrivateMediaError("Object verification is unavailable");
    const actual = await this.options.signer.head({ key: input.objectKey });
    if (!actual || actual.mimeType !== input.mimeType || actual.sizeBytes !== input.sizeBytes) {
      throw new PrivateMediaError("Uploaded object metadata does not match intent");
    }
    if (actual.checksumSha256 && actual.checksumSha256 !== input.checksumSha256) {
      throw new PrivateMediaError("Uploaded object metadata does not match intent");
    }
  }

  private signPut(input: {
    objectKey: string;
    mimeType: string;
    sizeBytes: number;
    checksumSha256: string;
    expiresInSeconds: number;
  }) {
    return this.options.signer.sign({
      method: "PUT",
      key: input.objectKey,
      contentType: input.mimeType,
      contentLength: input.sizeBytes,
      checksumSha256: input.checksumSha256,
      ifNoneMatch: "*",
      expiresInSeconds: input.expiresInSeconds,
    });
  }
  private expiry() {
    return new Date((this.options.now?.() ?? new Date()).getTime() + this.expiresInSeconds * 1000);
  }
}

export const S3PrivateMedia = VercelBlobPrivateMedia;

function validateUpload(input: { mimeType: string; sizeBytes: number; checksumSha256: string }) {
  if (!( ["image/jpeg", "image/png", "image/webp"] as string[]).includes(input.mimeType))
    throw new PrivateMediaError("Unsupported photo type");
  if (!Number.isInteger(input.sizeBytes) || input.sizeBytes < 1 || input.sizeBytes > 5 * 1024 * 1024)
    throw new PrivateMediaError("Photo is too large");
  if (!/^[A-Za-z0-9+/]{43}=$/.test(input.checksumSha256)) throw new PrivateMediaError("Invalid SHA-256 checksum");
}
function uploadHeaders(input: { mimeType: string }) {
  return { "Content-Type": input.mimeType } as const;
}
function segment(value: string) {
  const safe = value
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!safe) throw new PrivateMediaError("Invalid object scope");
  return safe;
}

export function privateMediaFromEnvironment(signer: PrivateObjectSigner = vercelBlobSignerFromEnvironment()) {
  return new VercelBlobPrivateMedia({ signer });
}

export class VercelBlobSigner implements PrivateObjectSigner {
  async sign(input: SignInput) {
    const validUntil = Date.now() + input.expiresInSeconds * 1000;
    if (input.method === "GET") {
      const signedToken = await issueSignedToken({ pathname: input.key, operations: ["get"], validUntil });
      const { presignedUrl } = await presignUrl(signedToken, {
        operation: "get",
        access: "private",
        pathname: input.key,
        validUntil,
        useCache: false,
      });
      return presignedUrl;
    }
    const signedToken = await issueSignedToken({
      pathname: input.key,
      operations: ["put"],
      validUntil,
      allowedContentTypes: input.contentType ? [input.contentType] : undefined,
      maximumSizeInBytes: input.contentLength,
    });
    const { presignedUrl } = await presignUrl(signedToken, {
      operation: "put",
      access: "private",
      pathname: input.key,
      validUntil,
      allowedContentTypes: input.contentType ? [input.contentType] : undefined,
      maximumSizeInBytes: input.contentLength,
      allowOverwrite: false,
    });
    return presignedUrl;
  }

  async head(input: { key: string }) {
    try {
      const output = await head(input.key);
      return { mimeType: output.contentType?.split(";")[0] ?? "", sizeBytes: output.size, checksumSha256: "" };
    } catch {
      return null;
    }
  }
}

export class S3CompatibleSigner extends VercelBlobSigner {
  constructor(config?: { endpoint: string; region: string; accessKeyId: string; secretAccessKey: string }) {
    void config;
    super();
  }
}
export const s3SignerFromEnvironment = vercelBlobSignerFromEnvironment;

export function vercelBlobSignerFromEnvironment() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error("BLOB_READ_WRITE_TOKEN is required for Vercel Blob uploads");
  return new VercelBlobSigner();
}

export async function fetchPrivateBlob(objectKey: string) {
  const output = await get(objectKey, { access: "private", useCache: false });
  if (!output || output.statusCode !== 200 || !output.stream) throw new PrivateMediaError("Private object unavailable");
  return new Response(output.stream, {
    headers: { "Content-Type": output.blob.contentType?.split(";")[0] ?? "application/octet-stream" },
  });
}
