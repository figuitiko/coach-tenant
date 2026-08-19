import { createHash, createHmac, randomUUID } from "node:crypto";

export type SignInput = { method: "PUT" | "GET"; bucket: string; key: string; contentType?: string; expiresInSeconds: number };
export interface PrivateObjectSigner { sign(input: SignInput): Promise<string> }

export class PrivateMediaError extends Error {}

export class S3PrivateMedia {
  private readonly expiresInSeconds = 300;
  constructor(private readonly options: { bucket: string; signer: PrivateObjectSigner; now?: () => Date }) {}

  async createUploadIntent(input: { workspaceId: string; studentId: string; fileName: string; mimeType: string; sizeBytes: number }) {
    if (!(["image/jpeg", "image/png", "image/webp"] as string[]).includes(input.mimeType)) throw new PrivateMediaError("Unsupported photo type");
    if (!Number.isInteger(input.sizeBytes) || input.sizeBytes < 1 || input.sizeBytes > 5 * 1024 * 1024) throw new PrivateMediaError("Photo is too large");
    const extension = input.mimeType === "image/jpeg" ? "jpg" : input.mimeType.split("/")[1];
    const objectKey = `workspaces/${segment(input.workspaceId)}/students/${segment(input.studentId)}/progress/${randomUUID()}.${extension}`;
    const uploadUrl = await this.options.signer.sign({ method: "PUT", bucket: this.options.bucket, key: objectKey, contentType: input.mimeType, expiresInSeconds: this.expiresInSeconds });
    return { objectKey, uploadUrl, expiresAt: this.expiry() };
  }

  async createDownloadUrl(input: { workspaceId: string; studentId: string; objectKey: string }) {
    const prefix = `workspaces/${segment(input.workspaceId)}/students/${segment(input.studentId)}/progress/`;
    if (!input.objectKey.startsWith(prefix) || input.objectKey.includes("..")) throw new PrivateMediaError("Private object unavailable");
    const downloadUrl = await this.options.signer.sign({ method: "GET", bucket: this.options.bucket, key: input.objectKey, expiresInSeconds: this.expiresInSeconds });
    return { downloadUrl, expiresAt: this.expiry() };
  }

  private expiry() { return new Date((this.options.now?.() ?? new Date()).getTime() + this.expiresInSeconds * 1000); }
}

function segment(value: string) {
  const safe = value.trim().replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  if (!safe) throw new PrivateMediaError("Invalid object scope");
  return safe;
}

export function privateMediaFromEnvironment(signer: PrivateObjectSigner) {
  const bucket = process.env.S3_BUCKET;
  if (!bucket) throw new Error("S3_BUCKET is required for private progress photos");
  return new S3PrivateMedia({ bucket, signer });
}

export class S3CompatibleSigner implements PrivateObjectSigner {
  constructor(private readonly config: { endpoint: string; region: string; accessKeyId: string; secretAccessKey: string; now?: () => Date }) {}
  async sign(input: SignInput) {
    const now = this.config.now?.() ?? new Date();
    const stamp = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
    const day = stamp.slice(0, 8);
    const credentialScope = `${day}/${this.config.region}/s3/aws4_request`;
    const base = new URL(this.config.endpoint);
    const path = `/${encodeURIComponent(input.bucket)}/${input.key.split("/").map(encodeURIComponent).join("/")}`;
    const params = new URLSearchParams({ "X-Amz-Algorithm": "AWS4-HMAC-SHA256", "X-Amz-Credential": `${this.config.accessKeyId}/${credentialScope}`, "X-Amz-Date": stamp, "X-Amz-Expires": String(input.expiresInSeconds), "X-Amz-SignedHeaders": "host" });
    params.sort();
    const canonical = `${input.method}\n${path}\n${params.toString()}\nhost:${base.host}\n\nhost\nUNSIGNED-PAYLOAD`;
    const toSign = `AWS4-HMAC-SHA256\n${stamp}\n${credentialScope}\n${sha256(canonical)}`;
    const signingKey = hmac(hmac(hmac(hmac(`AWS4${this.config.secretAccessKey}`, day), this.config.region), "s3"), "aws4_request");
    params.set("X-Amz-Signature", createHmac("sha256", signingKey).update(toSign).digest("hex"));
    return `${base.origin}${base.pathname.replace(/\/$/, "")}${path}?${params.toString()}`;
  }
}

export function s3SignerFromEnvironment() {
  const endpoint = process.env.S3_ENDPOINT, region = process.env.S3_REGION, accessKeyId = process.env.S3_ACCESS_KEY_ID, secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  if (!endpoint || !region || !accessKeyId || !secretAccessKey) throw new Error("S3 endpoint, region, and credentials are required");
  return new S3CompatibleSigner({ endpoint, region, accessKeyId, secretAccessKey });
}
function sha256(value: string) { return createHash("sha256").update(value).digest("hex"); }
function hmac(key: string | Buffer, value: string) { return createHmac("sha256", key).update(value).digest(); }
