import { describe, expect, it } from "vitest";
import { createPasswordResetMailer } from "./password-reset-mailer";

describe("createPasswordResetMailer", () => {
  it("refuses to silently discard reset emails in production", () => {
    expect(() => createPasswordResetMailer({}, "production")).toThrow(/smtp/i);
  });

  it("allows an explicit development logger without SMTP credentials", async () => {
    const messages: string[] = [];
    const mailer = createPasswordResetMailer({}, "development", (message) => messages.push(message));

    await mailer.sendPasswordReset({ to: "coach@example.com", resetUrl: "https://example.test/reset" });
    expect(messages[0]).toContain("coach@example.com");
  });
});
