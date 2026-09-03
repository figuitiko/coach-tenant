import { createHash } from "node:crypto";

/** Seed-only canonicalization. Batch 2 owns the production publication contract. */
export function fingerprintMarketingFixture(snapshot: unknown): string {
  return createHash("sha256").update(canonicalizeFixture(snapshot)).digest("hex");
}

function canonicalizeFixture(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("Marketing fixtures cannot contain non-finite numbers.");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalizeFixture).join(",")}]`;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${canonicalizeFixture(entry)}`).join(",")}}`;
  }
  throw new TypeError(`Marketing fixtures cannot contain ${typeof value} values.`);
}
