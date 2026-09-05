import { describe, expect, it } from "vitest";
import {
  buildWhatsAppUrl,
  fingerprintResultVersion,
  normalizeResultVersionInput,
  normalizeLandingContent,
  normalizeWhatsAppDigits,
  validateDraft,
  validatePublication,
  type LandingContentInput,
  type ResultVersionInput,
} from "./contracts";
import { MarketingValidationError, UnknownLandingThemeError } from "./errors";
import { toPublicCoachLandingDto } from "./dto";
import { resolveLandingTheme } from "./theme";


const draft: LandingContentInput = {
  themeKey: "editorial",
  coachDisplayName: "  Fuerza Norte  ", heroHeadline: "  Entrená mejor  ", heroSubheadline: "Plan claro.",
  whatsappDigits: " +54 (11) 1234-5678 ", whatsappMessage: "Hola, quiero empezar.", ctaHeading: "Hablemos",
  services: [{ title: "Online", description: "Plan semanal" }],
};

const result: ResultVersionInput = {
  headline: "Más fuerza", narrative: "  Progreso real. ", testimonial: "Me siento mejor.",
  attributionMode: "ANONYMOUS", attributionLabel: "", metrics: [{ label: "Peso", beforeValue: 80, afterValue: 72.5, unit: "KG", order: 0 }],
};

describe("marketing domain contracts", () => {
  it("normalizes whitespace and WhatsApp digits", () => {
    const value = normalizeLandingContent(draft);
    expect(value.coachDisplayName).toBe("Fuerza Norte");
    expect(value.whatsappDigits).toBe("541112345678");
    expect(normalizeWhatsAppDigits("+54 (11) 1234-5678")).toBe("541112345678");
    expect(() => normalizeWhatsAppDigits("5551234")).toThrow();
    expect(() => normalizeWhatsAppDigits("+541234567")).toThrow();
    expect(() => normalizeWhatsAppDigits("+0000000000")).toThrow();
    expect(() => normalizeWhatsAppDigits("+9991234567")).toThrow();
    expect(normalizeWhatsAppDigits("+52 55 1234 5678")).toBe("525512345678");
    expect(normalizeWhatsAppDigits("+1 (202) 555-0123")).toBe("12025550123");
    expect(() => normalizeWhatsAppDigits("+5412345678901234")).toThrow();
  });

  it("allows incomplete drafts but requires publication fields", () => {
    expect(() => validateDraft({ ...draft, heroHeadline: "" })).not.toThrow();
    expect(() => validatePublication({ ...draft, heroHeadline: "" })).toThrow(MarketingValidationError);
    expect(() => validatePublication(draft)).not.toThrow();
  });

  it("rejects executable markup, unsafe links, and invalid metrics", () => {
    expect(() => validateDraft({ ...draft, heroHeadline: "<script>alert(1)</script>" })).toThrow();
    expect(() => validateDraft({ ...draft, instagramUrl: "javascript:alert(1)" })).toThrow();
    expect(() => validateDraft({ ...draft, instagramUrl: "https://example.com/profile" })).toThrow();
    expect(() => validateDraft({ ...draft, instagramUrl: "https://user:pass@instagram.com/profile" })).toThrow();
    expect(() => validateDraft({ ...draft, instagramUrl: "https://instagram.com:443/profile" })).toThrow();
    expect(() => validateDraft({ ...draft, publicEmail: "nope" })).toThrow();
    expect(() => validateDraft({ ...draft, services: Array.from({ length: 11 }, () => ({ title: "x", description: "y" })) })).toThrow();
    expect(() => validateDraft({ ...draft, resultAttributionLabel: "x" })).not.toThrow();
  });

  it("builds WhatsApp URL with exactly-once encoding", () => {
    const url = buildWhatsAppUrl("+54 (11) 1234-5678", "Hola & ¿listo? 50%" );
    expect(url).toBe("https://wa.me/541112345678?text=Hola%20%26%20%C2%BFlisto%3F%2050%25");
    expect(url).not.toContain("%2520");
  });

  it("fingerprints normalized equivalent values and detects every public change", () => {
    expect(fingerprintResultVersion(result)).toBe(fingerprintResultVersion({ ...result, narrative: "Progreso real." }));
    expect(fingerprintResultVersion(result)).not.toBe(fingerprintResultVersion({ ...result, headline: "Otra" }));
    expect(fingerprintResultVersion(result)).not.toBe(fingerprintResultVersion({ ...result, metrics: [{ ...result.metrics[0], order: 1 }] }));
    expect(fingerprintResultVersion(result)).not.toBe(fingerprintResultVersion({ ...result, attributionMode: "FULL_NAME", attributionLabel: "Ana" }));
  });

  it("defaults attribution to anonymous and fails closed on themes", () => {
    expect(validateDraft({ ...draft, resultAttributionMode: undefined }).resultAttributionMode).toBe("ANONYMOUS");
    expect(normalizeResultVersionInput({ ...result, attributionMode: "ANONYMOUS", attributionLabel: "Lucía" }).attributionLabel).toBe("Anónimo");
    expect(() => normalizeResultVersionInput({ ...result, attributionMode: "BOGUS" as never })).toThrow();
    expect(() => normalizeResultVersionInput({ ...result, metrics: [{ ...result.metrics[0], unit: "BOGUS" as never }] })).toThrow();
    expect(resolveLandingTheme("editorial").key).toBe("editorial");
    expect(() => resolveLandingTheme("neon")).toThrow(UnknownLandingThemeError);
  });

  it("serializes an explicit public allowlist", () => {
    const dto = toPublicCoachLandingDto({ id: "internal", workspaceId: "secret", themeKey: "editorial", coachDisplayName: "Coach", heroHeadline: "Go", heroSubheadline: "Now", whatsappDigits: "541112345678", whatsappMessage: "Hi", ctaHeading: "Contact", publicEmail: "coach@example.com", logoObjectKey: "s3/secret", unpublished: "nope", results: [{ id: "r", headline: "Result", attributionLabel: "Anónimo", metrics: [{ label: "Peso", beforeValue: "80.00", afterValue: "72.50", unit: "KG" }] }] });
    expect(dto).toEqual(expect.objectContaining({ themeKey: "editorial", cta: expect.objectContaining({ publicEmail: "coach@example.com" }) }));
    expect(JSON.stringify(dto)).not.toContain("workspaceId");
    expect(JSON.stringify(dto)).not.toContain("541112345678");
    expect(() => toPublicCoachLandingDto({ ...({ ...draft, themeKey: "editorial", heroHeadline: "Go", heroSubheadline: "Now", ctaHeading: "Contact" }), results: [{ attributionMode: "ANONYMOUS", attributionLabel: "Lucía", metrics: [{ label: "Peso", beforeValue: "80", afterValue: "72", unit: "BOGUS" }] }] })).toThrow();
    expect(JSON.stringify(dto)).not.toContain("s3/secret");
    expect(JSON.stringify(dto)).not.toContain('"id"');
  });
});
