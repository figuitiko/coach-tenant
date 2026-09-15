import { describe, expect, it, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  getPublishedLandingWhatsAppUrl: vi.fn(),
  recordPublicLandingMetric: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/modules/marketing/infrastructure/marketing-use-cases", () => ({
  marketingService: {
    getPublishedLandingWhatsAppUrl: mocks.getPublishedLandingWhatsAppUrl,
    recordPublicLandingMetric: mocks.recordPublicLandingMetric,
  },
}));

import { GET } from "./route";

describe("public landing WhatsApp redirect", () => {
  beforeEach(() => vi.clearAllMocks());

  it("tracks an aggregate click and redirects to the validated WhatsApp URL", async () => {
    mocks.getPublishedLandingWhatsAppUrl.mockResolvedValue("https://wa.me/541112345678?text=Hola");

    await expect(
      GET(new Request("https://app.test/c/fuerza-norte/go/whatsapp"), {
        params: Promise.resolve({ workspaceSlug: "fuerza-norte" }),
      }),
    ).rejects.toThrow("NEXT_REDIRECT:https://wa.me/541112345678?text=Hola");

    expect(mocks.recordPublicLandingMetric).toHaveBeenCalledWith("fuerza-norte", "WHATSAPP_CLICK");
  });

  it("returns 404 for unpublished landings without tracking", async () => {
    mocks.getPublishedLandingWhatsAppUrl.mockResolvedValue(null);

    const response = await GET(new Request("https://app.test/c/draft/go/whatsapp"), {
      params: Promise.resolve({ workspaceSlug: "draft" }),
    });

    expect(response.status).toBe(404);
    expect(mocks.recordPublicLandingMetric).not.toHaveBeenCalled();
  });
});
