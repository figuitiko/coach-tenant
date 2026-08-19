import { describe, expect, it } from "vitest";
import { calendarDateInTimeZone } from "./local-date";

describe("calendarDateInTimeZone", () => {
  it("keeps the workspace day before UTC midnight crosses in Mexico City", () => {
    expect(calendarDateInTimeZone(new Date("2026-08-19T01:30:00.000Z"), "America/Mexico_City"))
      .toBe("2026-08-18");
  });

  it("uses the configured workspace timezone at the evening boundary", () => {
    expect(calendarDateInTimeZone(new Date("2026-08-19T04:30:00.000Z"), "America/New_York"))
      .toBe("2026-08-19");
  });
});
