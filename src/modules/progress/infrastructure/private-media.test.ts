import { describe, expect, it } from "vitest";
import { PrivateMediaError, S3CompatibleSigner, S3PrivateMedia } from "./private-media";

const checksumSha256 = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";

describe("S3PrivateMedia", () => {
  it("allows only private image MIME types and a five MiB maximum", async () => {
    const media = fixture();
    await expect(media.createUploadIntent({ workspaceId: "w", studentId: "s", fileName: "x.svg", mimeType: "image/svg+xml", sizeBytes: 10, checksumSha256 })).rejects.toBeInstanceOf(PrivateMediaError);
    await expect(media.createUploadIntent({ workspaceId: "w", studentId: "s", fileName: "x.jpg", mimeType: "image/jpeg", sizeBytes: 5 * 1024 * 1024 + 1, checksumSha256 })).rejects.toBeInstanceOf(PrivateMediaError);
  });

  it("creates an opaque workspace-and-student scoped key and short-lived signed URL", async () => {
    const media = fixture();
    const intent = await media.createUploadIntent({ workspaceId: "workspace/a", studentId: "student/a", fileName: "My Face.JPG", mimeType: "image/jpeg", sizeBytes: 42, checksumSha256 });
    expect(intent.objectKey).toMatch(/^workspaces\/workspace-a\/students\/student-a\/progress\/[a-f0-9-]+\.jpg$/);
    expect(intent.uploadUrl).toContain("signed.test");
    expect(intent.expiresAt.getTime()).toBe(1_700_000_300_000);
    expect(intent.uploadHeaders).toEqual({ "Content-Type": "image/jpeg", "x-amz-checksum-sha256": checksumSha256, "If-None-Match": "*" });
  });

  it("refuses to sign downloads unless the persisted object belongs to the actor scope", async () => {
    const media = fixture();
    await expect(media.createDownloadUrl({ workspaceId: "w", studentId: "s", objectKey: "workspaces/w/students/other/progress/x.jpg" })).rejects.toBeInstanceOf(PrivateMediaError);
    await expect(media.createDownloadUrl({ workspaceId: "w", studentId: "s", objectKey: "workspaces/w/students/s/progress/x.jpg" })).resolves.toEqual(expect.objectContaining({ downloadUrl: expect.stringContaining("signed.test"), expiresAt: new Date(1_700_000_300_000) }));
  });

  it("refuses expired upload intents and detects forged uploaded metadata when object-head is available", async () => {
    const media = new S3PrivateMedia({ bucket: "private-bucket", now: () => new Date("2026-08-19T12:10:00Z"), signer: {
      sign: async () => "https://signed.test",
      head: async () => ({ mimeType: "image/png", sizeBytes: 999, checksumSha256: "wrong" }),
    } });
    await expect(media.signUploadIntent({ objectKey: "workspaces/w/students/s/progress/x.jpg", mimeType: "image/jpeg", sizeBytes: 42, checksumSha256, expiresAt: new Date("2026-08-19T12:00:00Z") })).rejects.toBeInstanceOf(PrivateMediaError);
    await expect(media.verifyUploadedObject({ objectKey: "workspaces/w/students/s/progress/x.jpg", mimeType: "image/jpeg", sizeBytes: 42, checksumSha256 })).rejects.toBeInstanceOf(PrivateMediaError);
  });

  it("signs immutable checksum-bound PUTs through path-prefixed S3-compatible endpoints", async () => {
    const signer = new S3CompatibleSigner({ endpoint: "https://storage.test/root/s3", region: "test-1", accessKeyId: "test-key", secretAccessKey: "test-secret" });
    const signed = new URL(await signer.sign({ method: "PUT", bucket: "private", key: "workspaces/w/students/s/progress/x.jpg", contentType: "image/jpeg", contentLength: 42, checksumSha256, ifNoneMatch: "*", expiresInSeconds: 60 }));
    expect(signed.pathname).toBe("/root/s3/private/workspaces/w/students/s/progress/x.jpg");
    expect(signed.searchParams.get("x-amz-checksum-sha256")).toBe(checksumSha256);
    expect(signed.searchParams.get("X-Amz-SignedHeaders")).toContain("content-length");
    expect(signed.searchParams.get("X-Amz-SignedHeaders")).toContain("content-type");
    expect(signed.searchParams.get("X-Amz-SignedHeaders")).toContain("if-none-match");
  });
});

function fixture() {
  return new S3PrivateMedia({
    bucket: "private-bucket",
    now: () => new Date(1_700_000_000_000),
    signer: { sign: async (input) => `https://signed.test/${input.method}/${input.key}?expires=${input.expiresInSeconds}` },
  });
}
