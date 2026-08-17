import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");

function colorToken(name: string) {
  const match = css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!match) throw new Error(`Missing --${name} color token`);
  return match[1];
}

function luminance(hex: string) {
  const channels = hex.match(/[0-9a-f]{2}/gi)?.map((value) => Number.parseInt(value, 16) / 255);
  if (!channels) throw new Error(`Invalid color: ${hex}`);
  const [red, green, blue] = channels.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrast(first: string, second: string) {
  const [lighter, darker] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

describe("signal color tokens", () => {
  it("meet WCAG AA for small text on light and dark surfaces", () => {
    const signal = colorToken("signal");
    const signalBright = colorToken("signal-bright");

    expect(contrast(signal, "#ffffff")).toBeGreaterThanOrEqual(4.5);
    expect(contrast(signal, colorToken("paper"))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(signal, colorToken("paper-light"))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(signalBright, colorToken("ink"))).toBeGreaterThanOrEqual(4.5);
  });
});
