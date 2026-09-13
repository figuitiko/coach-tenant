import { describe, expect, it, vi } from "vitest";
import { MarketingPrivateMedia, MarketingPrivateMediaError } from "./marketing-private-media";

const checksum = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa=";

describe("MarketingPrivateMedia", () => {
  it("creates private logo/portrait upload intents under the workspace marketing prefix", async () => {
    const signer = { sign: vi.fn(async () => "https://storage.test/upload") };
    const media = new MarketingPrivateMedia({ bucket: "private-bucket", signer, uuid: () => "asset-uuid" });

    const intent = await media.createUploadIntent({
      workspaceId: "workspace a",
      kind: "LOGO",
      mimeType: "image/webp",
      sizeBytes: 1024,
      checksumSha256: checksum,
    });

    expect(intent).toMatchObject({
      objectKey: "workspaces/workspace-a/marketing/asset-uuid.webp",
      uploadUrl: "https://storage.test/upload",
      uploadHeaders: {
        "Content-Type": "image/webp",
        "x-amz-checksum-sha256": checksum,
        "If-None-Match": "*",
      },
    });
    expect(signer.sign).toHaveBeenCalledWith(
      expect.objectContaining({ method: "PUT", bucket: "private-bucket", key: intent.objectKey, ifNoneMatch: "*" }),
    );
  });

  it("re-signs an existing upload intent object key only inside the workspace marketing prefix", async () => {
    const signer = { sign: vi.fn(async () => "https://storage.test/replay") };
    const media = new MarketingPrivateMedia({ bucket: "private-bucket", signer, uuid: () => "asset-uuid" });

    const intent = await media.createUploadIntent({
      workspaceId: "workspace-a",
      kind: "PORTRAIT",
      mimeType: "image/jpeg",
      sizeBytes: 2048,
      checksumSha256: checksum,
      objectKey: "workspaces/workspace-a/marketing/original-portrait.jpg",
    });

    expect(intent).toMatchObject({
      objectKey: "workspaces/workspace-a/marketing/original-portrait.jpg",
      uploadUrl: "https://storage.test/replay",
    });
    expect(signer.sign).toHaveBeenCalledWith(
      expect.objectContaining({ key: "workspaces/workspace-a/marketing/original-portrait.jpg" }),
    );

    await expect(
      media.createUploadIntent({
        workspaceId: "workspace-a",
        kind: "PORTRAIT",
        mimeType: "image/jpeg",
        sizeBytes: 2048,
        checksumSha256: checksum,
        objectKey: "workspaces/workspace-b/marketing/original-portrait.jpg",
      }),
    ).rejects.toBeInstanceOf(MarketingPrivateMediaError);
  });

  it("rejects non-image or oversized marketing assets and unsafe public object keys", async () => {
    const media = new MarketingPrivateMedia({
      bucket: "private-bucket",
      signer: { sign: vi.fn() },
      uuid: () => "asset-uuid",
    });

    await expect(
      media.createUploadIntent({
        workspaceId: "workspace-a",
        kind: "LOGO",
        mimeType: "image/gif",
        sizeBytes: 1024,
        checksumSha256: checksum,
      }),
    ).rejects.toBeInstanceOf(MarketingPrivateMediaError);

    await expect(
      media.createUploadIntent({
        workspaceId: "workspace-a",
        kind: "PORTRAIT",
        mimeType: "image/jpeg",
        sizeBytes: 5 * 1024 * 1024 + 1,
        checksumSha256: checksum,
      }),
    ).rejects.toBeInstanceOf(MarketingPrivateMediaError);

    await expect(
      media.fetchObject("workspaces/workspace-a/students/student-a/progress/photo.jpg"),
    ).rejects.toBeInstanceOf(MarketingPrivateMediaError);
  });
});
