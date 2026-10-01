import { describe, expect, it } from "vitest";
import { validateProductionEnvironment, validateServerEnvironment } from "./env";

describe("server environment validation", () => {
  it("accepts documented non-secret operational settings", () => {
    expect(validateServerEnvironment({
      DATABASE_URL: "postgresql://localhost/tenand",
      BETTER_AUTH_URL: "http://localhost:3000",
      SMTP_PORT: "587",
      BLOB_READ_WRITE_TOKEN: "vercel-blob-token",
    }).BLOB_READ_WRITE_TOKEN).toBe("vercel-blob-token");
  });

  it("requires auth, SMTP, and private object storage secrets in production", () => {
    const environment = {
      DATABASE_URL: "postgresql://localhost/tenand",
      BETTER_AUTH_URL: "https://pilot.tenand.example",
      BETTER_AUTH_SECRET: "a-secure-secret-with-at-least-32-characters",
      SMTP_HOST: "smtp.example.com", SMTP_PORT: "587", SMTP_FROM: "Tenand <noreply@example.com>", SMTP_USER: "smtp-user", SMTP_PASSWORD: "smtp-password",
      BLOB_READ_WRITE_TOKEN: "vercel-blob-token",
    };
    expect(validateProductionEnvironment(environment).SMTP_HOST).toBe("smtp.example.com");
    expect(() => validateProductionEnvironment({ ...environment, BETTER_AUTH_SECRET: "super-secret-value" })).toThrow("Invalid production environment configuration.");
  });

  it("rejects unsafe or malformed operational settings without echoing secrets", () => {
    expect(() => validateServerEnvironment({ DATABASE_URL: "secret-value", BETTER_AUTH_URL: "javascript:alert(1)" })).toThrow(/environment configuration/i);
  });
});
