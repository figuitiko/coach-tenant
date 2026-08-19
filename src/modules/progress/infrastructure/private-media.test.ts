import { describe, expect, it } from "vitest";
import { PrivateMediaError, S3PrivateMedia } from "./private-media";

describe("S3PrivateMedia", () => {
  it("allows only private image MIME types and a five MiB maximum", async () => {
    const media = fixture();
    await expect(media.createUploadIntent({ workspaceId: "w", studentId: "s", fileName: "x.svg", mimeType: "image/svg+xml", sizeBytes: 10 })).rejects.toBeInstanceOf(PrivateMediaError);
    await expect(media.createUploadIntent({ workspaceId: "w", studentId: "s", fileName: "x.jpg", mimeType: "image/jpeg", sizeBytes: 5 * 1024 * 1024 + 1 })).rejects.toBeInstanceOf(PrivateMediaError);
  });

  it("creates an opaque workspace-and-student scoped key and short-lived signed URL", async () => {
    const media = fixture();
    const intent = await media.createUploadIntent({ workspaceId: "workspace/a", studentId: "student/a", fileName: "My Face.JPG", mimeType: "image/jpeg", sizeBytes: 42 });
    expect(intent.objectKey).toMatch(/^workspaces\/workspace-a\/students\/student-a\/progress\/[a-f0-9-]+\.jpg$/);
    expect(intent.uploadUrl).toContain("signed.test");
    expect(intent.expiresAt.getTime()).toBe(1_700_000_300_000);
  });

  it("refuses to sign downloads unless the persisted object belongs to the actor scope", async () => {
    const media = fixture();
    await expect(media.createDownloadUrl({ workspaceId: "w", studentId: "s", objectKey: "workspaces/w/students/other/progress/x.jpg" })).rejects.toBeInstanceOf(PrivateMediaError);
    await expect(media.createDownloadUrl({ workspaceId: "w", studentId: "s", objectKey: "workspaces/w/students/s/progress/x.jpg" })).resolves.toEqual(expect.objectContaining({ downloadUrl: expect.stringContaining("signed.test"), expiresAt: new Date(1_700_000_300_000) }));
  });
});

function fixture() {
  return new S3PrivateMedia({
    bucket: "private-bucket",
    now: () => new Date(1_700_000_000_000),
    signer: { sign: async (input) => `https://signed.test/${input.method}/${input.key}?expires=${input.expiresInSeconds}` },
  });
}
