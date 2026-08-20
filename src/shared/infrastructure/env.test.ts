import { describe, expect, it } from "vitest";
import { validateServerEnvironment } from "./env";

describe("server environment validation", () => {
  it("accepts documented non-secret operational settings", () => {
    expect(validateServerEnvironment({
      DATABASE_URL: "postgresql://localhost/tenand",
      BETTER_AUTH_URL: "http://localhost:3000",
      SMTP_PORT: "587",
      S3_MAX_UPLOAD_BYTES: "5242880",
    }).S3_MAX_UPLOAD_BYTES).toBe(5_242_880);
  });

  it("rejects unsafe or malformed operational settings without echoing secrets", () => {
    expect(() => validateServerEnvironment({ DATABASE_URL: "secret-value", BETTER_AUTH_URL: "javascript:alert(1)" })).toThrow(/environment configuration/i);
  });
});
