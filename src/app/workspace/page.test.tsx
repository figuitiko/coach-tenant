import { describe, expect, it, vi } from "vitest";

const { redirectMock } = vi.hoisted(() => ({ redirectMock: vi.fn() }));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

import WorkspacePage from "./page";

describe("WorkspacePage", () => {
  it("redirects unauthenticated visitors to sign in", () => {
    WorkspacePage();

    expect(redirectMock).toHaveBeenCalledWith("/sign-in");
  });
});
