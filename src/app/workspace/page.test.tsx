import { describe, expect, it, vi } from "vitest";

const { redirectMock, listCurrentMembershipsMock } = vi.hoisted(() => ({
  redirectMock: vi.fn(),
  listCurrentMembershipsMock: vi.fn(async () => null),
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));
vi.mock("@/modules/tenancy/infrastructure/workspace-dal", () => ({
  listCurrentMemberships: listCurrentMembershipsMock,
}));

import WorkspacePage from "./page";

describe("WorkspacePage", () => {
  it("redirects unauthenticated visitors to sign in", async () => {
    await WorkspacePage();

    expect(redirectMock).toHaveBeenCalledWith("/sign-in");
  });
});
