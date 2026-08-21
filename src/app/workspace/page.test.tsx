import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { redirectMock, listCurrentMembershipsMock } = vi.hoisted(() => ({
  redirectMock: vi.fn(),
  listCurrentMembershipsMock: vi.fn<() => Promise<unknown>>(async () => null),
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));
vi.mock("@/modules/tenancy/infrastructure/workspace-dal", () => ({
  listCurrentMemberships: listCurrentMembershipsMock,
}));

import WorkspacePage from "./page";

describe("WorkspacePage", () => {
  beforeEach(() => {
    redirectMock.mockClear();
    listCurrentMembershipsMock.mockResolvedValue(null);
  });
  it("redirects unauthenticated visitors to sign in", async () => {
    await WorkspacePage();

    expect(redirectMock).toHaveBeenCalledWith("/sign-in");
  });

  it("routes an ordinary coach with one membership directly to that workspace", async () => {
    listCurrentMembershipsMock.mockResolvedValueOnce({
      userId: "north-coach",
      platformRole: "USER",
      memberships: [{ workspaceId: "north", workspaceSlug: "north", workspaceName: "North", timeZone: "UTC", role: "COACH", accessMode: "MEMBERSHIP" }],
    });

    await WorkspacePage();

    expect(redirectMock).toHaveBeenCalledWith("/w/north");
  });

  it("shows a clearly labeled global workspace selector to a super admin", async () => {
    listCurrentMembershipsMock.mockResolvedValueOnce({
      userId: "admin",
      platformRole: "SUPER_ADMIN",
      memberships: [
        { workspaceId: "north", workspaceSlug: "north", workspaceName: "North", timeZone: "UTC", role: "COACH", accessMode: "SUPER_ADMIN" },
        { workspaceId: "south", workspaceSlug: "south", workspaceName: "South", timeZone: "UTC", role: "COACH", accessMode: "SUPER_ADMIN" },
      ],
    });

    render(await WorkspacePage());

    expect(screen.getByText(/panel de super admin/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /north/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /south/i })).toBeInTheDocument();
  });
});
