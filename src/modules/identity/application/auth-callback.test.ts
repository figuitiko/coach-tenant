import { describe, expect, it } from "vitest";
import { invitationTokenFromCallback, safeRelativeCallback } from "./auth-callback";

describe("safeRelativeCallback", () => {
  it("preserves a local invitation callback", () => {
    expect(safeRelativeCallback("/invite/abcdefghijklmnopqrstuvwxyzABCDEFG123456789_-", "/workspace"))
      .toBe("/invite/abcdefghijklmnopqrstuvwxyzABCDEFG123456789_-");
  });

  it.each([
    "https://evil.example/invite/token",
    "//evil.example/invite/token",
    "/\\evil.example/invite/token",
    "javascript:alert(1)",
  ])("rejects the unsafe callback %s", (callback) => {
    expect(safeRelativeCallback(callback, "/workspace")).toBe("/workspace");
  });
});

describe("invitationTokenFromCallback", () => {
  it("returns a token only for an exact invitation path", () => {
    expect(invitationTokenFromCallback("/invite/abcdefghijklmnopqrstuvwxyzABCDEFG123456789_-"))
      .toBe("abcdefghijklmnopqrstuvwxyzABCDEFG123456789_-");
    expect(invitationTokenFromCallback("/workspace")).toBeNull();
    expect(invitationTokenFromCallback("/invite/too-short")).toBeNull();
    expect(invitationTokenFromCallback("/invite/abcdefghijklmnopqrstuvwxyzABCDEFG123456789_-/extra"))
      .toBeNull();
  });
});
