import { describe, expect, it, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({ listPublishedLandingSitemapEntries: vi.fn() }));
vi.mock("@/modules/marketing/infrastructure/marketing-use-cases", () => ({
  marketingService: { listPublishedLandingSitemapEntries: mocks.listPublishedLandingSitemapEntries },
}));

import sitemap from "./sitemap";

describe("sitemap", () => {
  beforeEach(() => vi.clearAllMocks());

  it("includes only published coach landing URLs", async () => {
    mocks.listPublishedLandingSitemapEntries.mockResolvedValue([
      { workspaceSlug: "fuerza-norte", updatedAt: new Date("2026-09-14T10:00:00.000Z") },
    ]);

    await expect(sitemap()).resolves.toEqual([
      {
        url: "/c/fuerza-norte",
        lastModified: new Date("2026-09-14T10:00:00.000Z"),
        changeFrequency: "weekly",
        priority: 0.7,
      },
    ]);
  });
});
