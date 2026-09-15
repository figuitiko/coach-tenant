import { describe, expect, it } from "vitest";
import { fingerprintMarketingFixture } from "./marketing-fixtures";

describe("fingerprintMarketingFixture", () => {
  it("produces the same fingerprint for the same snapshot regardless of object key order", () => {
    const first = fingerprintMarketingFixture({
      headline: "Bajó 6kg",
      metrics: [{ label: "Peso", before: "74.40", after: "68.40" }],
      attribution: { mode: "ANONYMOUS", label: "Alumna" },
    });
    const reordered = fingerprintMarketingFixture({
      attribution: { label: "Alumna", mode: "ANONYMOUS" },
      metrics: [{ after: "68.40", before: "74.40", label: "Peso" }],
      headline: "Bajó 6kg",
    });

    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(reordered).toBe(first);
  });

  it("changes the fingerprint when any nested public value changes", () => {
    const original = fingerprintMarketingFixture({ headline: "Bajó 6kg", metrics: [{ after: "68.40" }] });
    const changed = fingerprintMarketingFixture({ headline: "Bajó 6kg", metrics: [{ after: "68.41" }] });

    expect(changed).not.toBe(original);
  });
});
