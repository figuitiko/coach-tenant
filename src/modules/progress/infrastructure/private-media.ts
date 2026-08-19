import { randomUUID } from "node:crypto";
import { HeadObjectCommand, PutObjectCommand, GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export type SignInput = {
  method: "PUT" | "GET";
  bucket: string;
  key: string;
  contentType?: string;
  contentLength?: number;
  checksumSha256?: string;
  ifNoneMatch?: "*";
  expiresInSeconds: number;
};
export interface PrivateObjectSigner {
  sign(input: SignInput): Promise<string>;
  head?(input: { bucket: string; key: string }): Promise<{ mimeType: string; sizeBytes: number; checksumSha256: string } | null>;
}

export class PrivateMediaError extends Error {}

export class S3PrivateMedia {
  private readonly expiresInSeconds = 300;
  constructor(private readonly options: { bucket: string; signer: PrivateObjectSigner; now?: () => Date }) {}

  async createUploadIntent(input: { workspaceId: string; studentId: string; fileName: string; mimeType: string; sizeBytes: number; checksumSha256: string }) {
    validateUpload(input);
    const extension = input.mimeType === "image/jpeg" ? "jpg" : input.mimeType.split("/")[1];
    const objectKey = `workspaces/${segment(input.workspaceId)}/students/${segment(input.studentId)}/progress/${randomUUID()}.${extension}`;
    const uploadUrl = await this.signPut({ ...input, objectKey, expiresInSeconds: this.expiresInSeconds });
    return { objectKey, uploadUrl, uploadHeaders: uploadHeaders(input), expiresAt: this.expiry() };
  }

  async createDownloadUrl(input: { workspaceId: string; studentId: string; objectKey: string }) {
    const prefix = `workspaces/${segment(input.workspaceId)}/students/${segment(input.studentId)}/progress/`;
    if (!input.objectKey.startsWith(prefix) || input.objectKey.includes("..")) throw new PrivateMediaError("Private object unavailable");
    const downloadUrl = await this.options.signer.sign({ method: "GET", bucket: this.options.bucket, key: input.objectKey, expiresInSeconds: this.expiresInSeconds });
    return { downloadUrl, expiresAt: this.expiry() };
  }

  async signUploadIntent(input: { objectKey: string; mimeType: string; sizeBytes: number; checksumSha256: string; expiresAt: Date }) {
    const remaining = Math.floor((input.expiresAt.getTime() - (this.options.now?.() ?? new Date()).getTime()) / 1000);
    if (remaining < 1) throw new PrivateMediaError("Upload intent expired");
    return this.signPut({ ...input, expiresInSeconds: Math.min(remaining, this.expiresInSeconds) });
  }

  async verifyUploadedObject(input: { objectKey: string; mimeType: string; sizeBytes: number; checksumSha256: string }) {
    if (!this.options.signer.head) throw new PrivateMediaError("Object verification is unavailable");
    const actual = await this.options.signer.head({ bucket: this.options.bucket, key: input.objectKey });
    if (!actual || actual.mimeType !== input.mimeType || actual.sizeBytes !== input.sizeBytes || actual.checksumSha256 !== input.checksumSha256) {
      throw new PrivateMediaError("Uploaded object metadata does not match intent");
    }
  }

  private signPut(input: { objectKey: string; mimeType: string; sizeBytes: number; checksumSha256: string; expiresInSeconds: number }) {
    return this.options.signer.sign({ method: "PUT", bucket: this.options.bucket, key: input.objectKey, contentType: input.mimeType, contentLength: input.sizeBytes, checksumSha256: input.checksumSha256, ifNoneMatch: "*", expiresInSeconds: input.expiresInSeconds });
  }
  private expiry() { return new Date((this.options.now?.() ?? new Date()).getTime() + this.expiresInSeconds * 1000); }
}

function validateUpload(input: { mimeType: string; sizeBytes: number; checksumSha256: string }) {
  if (!( ["image/jpeg", "image/png", "image/webp"] as string[]).includes(input.mimeType)) throw new PrivateMediaError("Unsupported photo type");
  if (!Number.isInteger(input.sizeBytes) || input.sizeBytes < 1 || input.sizeBytes > 5 * 1024 * 1024) throw new PrivateMediaError("Photo is too large");
  if (!/^[A-Za-z0-9+/]{43}=$/.test(input.checksumSha256)) throw new PrivateMediaError("Invalid SHA-256 checksum");
}
function uploadHeaders(input: { mimeType: string; checksumSha256: string }) { return { "Content-Type": input.mimeType, "x-amz-checksum-sha256": input.checksumSha256, "If-None-Match": "*" } as const; }
function segment(value: string) { const safe = value.trim().replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, ""); if (!safe) throw new PrivateMediaError("Invalid object scope"); return safe; }

export function privateMediaFromEnvironment(signer: PrivateObjectSigner) {
  const bucket = process.env.S3_BUCKET;
  if (!bucket) throw new Error("S3_BUCKET is required for private progress photos");
  return new S3PrivateMedia({ bucket, signer });
}

export class S3CompatibleSigner implements PrivateObjectSigner {
  private readonly client: S3Client;
  constructor(config: { endpoint: string; region: string; accessKeyId: string; secretAccessKey: string }) {
    this.client = new S3Client({ endpoint: config.endpoint, region: config.region, forcePathStyle: true, credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey } });
  }
  async sign(input: SignInput) {
    const command = input.method === "PUT"
      ? new PutObjectCommand({ Bucket: input.bucket, Key: input.key, ContentType: input.contentType, ContentLength: input.contentLength, ChecksumSHA256: input.checksumSha256, IfNoneMatch: input.ifNoneMatch })
      : new GetObjectCommand({ Bucket: input.bucket, Key: input.key });
    return getSignedUrl(this.client, command, { expiresIn: input.expiresInSeconds, signableHeaders: new Set(["content-type"]) });
  }
  async head(input: { bucket: string; key: string }) {
    try {
      const output = await this.client.send(new HeadObjectCommand({ Bucket: input.bucket, Key: input.key, ChecksumMode: "ENABLED" }));
      if (!output.ChecksumSHA256 || output.ContentLength === undefined) return null;
      return { mimeType: output.ContentType?.split(";")[0] ?? "", sizeBytes: output.ContentLength, checksumSha256: output.ChecksumSHA256 };
    } catch { return null; }
  }
}

export function s3SignerFromEnvironment() {
  const endpoint = process.env.S3_ENDPOINT, region = process.env.S3_REGION, accessKeyId = process.env.S3_ACCESS_KEY_ID, secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  if (!endpoint || !region || !accessKeyId || !secretAccessKey) throw new Error("S3 endpoint, region, and credentials are required");
  return new S3CompatibleSigner({ endpoint, region, accessKeyId, secretAccessKey });
}
