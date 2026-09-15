import { describe, expect, it, vi, beforeEach } from "vitest";
import { MarketingNotFoundError } from "@/modules/marketing/domain/errors";

const mocks = vi.hoisted(() => ({
  getPublishedAsset: vi.fn(),
  fetchObject: vi.fn(),
}));

vi.mock("@/modules/marketing/infrastructure/marketing-use-cases", () => ({
  marketingService: { getPublishedAsset: mocks.getPublishedAsset },
}));
vi.mock("@/modules/marketing/infrastructure/marketing-private-media", () => ({
  marketingPrivateMediaFromEnvironment: () => ({ fetchObject: mocks.fetchObject }),
  MarketingPrivateMediaError: class MarketingPrivateMediaError extends Error {},
}));

import { GET } from "./route";

const context = { params: Promise.resolve({ workspaceSlug: "fuerza-norte", assetId: "asset-logo" }) };

describe("public coach landing media route", () => {
  beforeEach(() => vi.resetAllMocks());

  it("streams only a currently published logo or portrait through same-origin proxy headers", async () => {
    mocks.getPublishedAsset.mockResolvedValue({
      objectKey: "workspaces/workspace-a/marketing/logo.jpg",
      mimeType: "image/jpeg",
      sizeBytes: 1234,
    });
    mocks.fetchObject.mockResolvedValue(new Response("image-bytes", { headers: { "Content-Type": "image/jpeg" } }));

    const response = await GET(new Request("https://app.test/c/fuerza-norte/media/asset-logo"), context);

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("image-bytes");
    expect(response.headers.get("content-type")).toBe("image/jpeg");
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("location")).toBeNull();
    expect(mocks.getPublishedAsset).toHaveBeenCalledWith("fuerza-norte", "asset-logo");
    expect(mocks.fetchObject).toHaveBeenCalledWith("workspaces/workspace-a/marketing/logo.jpg");
  });

  it("returns 404 for unpublished, draft-only, foreign, replaced, or private progress media", async () => {
    mocks.getPublishedAsset.mockResolvedValue(null);

    const response = await GET(new Request("https://app.test/c/fuerza-norte/media/progress-photo-1"), context);

    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    expect(mocks.fetchObject).not.toHaveBeenCalled();
  });

  it("translates storage failures to non-leaky 404", async () => {
    mocks.getPublishedAsset.mockResolvedValue({
      objectKey: "workspaces/workspace-a/marketing/logo.jpg",
      mimeType: "image/jpeg",
      sizeBytes: 1234,
    });
    mocks.fetchObject.mockRejectedValue(new MarketingNotFoundError());

    const response = await GET(new Request("https://app.test/c/fuerza-norte/media/asset-logo"), context);

    expect(response.status).toBe(404);
  });
});
