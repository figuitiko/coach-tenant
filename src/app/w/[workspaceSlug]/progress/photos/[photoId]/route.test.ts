import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProgressAccessDeniedError } from "@/modules/progress/application/progress-service";
import { CrossTenantAccessError, UnauthenticatedError } from "@/modules/tenancy/application/workspace-access";

const mocks = vi.hoisted(() => ({
  requireAccess: vi.fn(),
  getPhoto: vi.fn(),
  createDownloadUrl: vi.fn(),
}));

vi.mock("@/modules/tenancy/infrastructure/workspace-dal", () => ({ requireWorkspaceAccess: mocks.requireAccess }));
vi.mock("@/modules/progress/infrastructure/progress-use-cases", () => ({ progressService: { getPhotoDownload: mocks.getPhoto } }));
vi.mock("@/modules/progress/infrastructure/private-media", () => ({
  privateMediaFromEnvironment: () => ({ createDownloadUrl: mocks.createDownloadUrl }),
  s3SignerFromEnvironment: () => ({}),
  PrivateMediaError: class PrivateMediaError extends Error {},
}));

import { GET } from "./route";

const context = { params: Promise.resolve({ workspaceSlug: "north", photoId: "photo-1" }) };

describe("private progress photo download route", () => {
  beforeEach(() => vi.resetAllMocks());

  it("redirects unauthenticated requests to sign-in", async () => {
    mocks.requireAccess.mockRejectedValue(new UnauthenticatedError());
    const response = await GET(new Request("https://app.test/w/north/progress/photos/photo-1", { headers: { Accept: "text/html" } }), context);
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://app.test/sign-in");
  });

  it("returns 401 instead of redirecting unauthenticated non-navigation requests", async () => {
    mocks.requireAccess.mockRejectedValue(new UnauthenticatedError());
    const response = await GET(new Request("https://app.test/w/north/progress/photos/photo-1", { headers: { Accept: "application/json" } }), context);
    expect(response.status).toBe(401);
    expect(response.headers.get("location")).toBeNull();
  });

  it.each([new CrossTenantAccessError(), new ProgressAccessDeniedError()])("returns a non-leaky 404 for denied or guessed IDs", async (error) => {
    mocks.requireAccess.mockResolvedValue({ userId: "coach", workspace: { workspaceId: "workspace", role: "COACH" } });
    mocks.getPhoto.mockRejectedValue(error);
    const response = await GET(new Request("https://app.test/w/north/progress/photos/guessed"), context);
    expect(response.status).toBe(404);
  });

  it("redirects authorized downloads without caching", async () => {
    mocks.requireAccess.mockResolvedValue({ userId: "coach", workspace: { workspaceId: "workspace", role: "COACH" } });
    mocks.getPhoto.mockResolvedValue({ studentId: "student", objectKey: "key" });
    mocks.createDownloadUrl.mockResolvedValue({ downloadUrl: "https://storage.test/private", expiresAt: new Date() });
    const response = await GET(new Request("https://app.test/w/north/progress/photos/photo-1"), context);
    expect(response.status).toBe(307);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });
});
