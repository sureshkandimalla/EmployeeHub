import {
  formatMonthYear,
  formatDate,
  formatDateMDY,
  parseLocalDateSafe,
} from "./dateFormat";

// These helpers exist specifically to avoid the `new Date("2026-07-01")`
// UTC-midnight trap, which renders the *previous* day in any timezone behind
// UTC. Every test here asserts the day/month actually stored, which is what
// users reported seeing shifted.

describe("formatMonthYear", () => {
  it("renders a full ISO date as its month name and year", () => {
    expect(formatMonthYear("2026-07-15")).toBe("July 2026");
  });

  it("renders a bare yyyy-MM month key", () => {
    expect(formatMonthYear("2026-07")).toBe("July 2026");
  });

  it("does not shift January back into the previous December", () => {
    expect(formatMonthYear("2026-01-01")).toBe("January 2026");
  });

  it("renders December without rolling the year forward", () => {
    expect(formatMonthYear("2026-12-31")).toBe("December 2026");
  });

  it("returns an empty string for a missing value", () => {
    expect(formatMonthYear(null)).toBe("");
    expect(formatMonthYear(undefined)).toBe("");
    expect(formatMonthYear("")).toBe("");
  });

  it("returns an empty string for an unparseable value", () => {
    expect(formatMonthYear("not-a-date")).toBe("");
  });
});

describe("formatDate", () => {
  it("renders an ISO date as a short, human-readable date", () => {
    expect(formatDate("2025-04-15")).toBe("Apr 15, 2025");
  });

  it("does not shift the first of the month back a day", () => {
    expect(formatDate("2026-07-01")).toBe("Jul 1, 2026");
  });

  it("does not shift January 1st back into the previous year", () => {
    expect(formatDate("2026-01-01")).toBe("Jan 1, 2026");
  });

  it("renders a leap day correctly", () => {
    expect(formatDate("2028-02-29")).toBe("Feb 29, 2028");
  });

  it("ignores a trailing time component on a full ISO timestamp", () => {
    expect(formatDate("2026-07-01T23:30:00Z")).toBe("Jul 1, 2026");
  });

  it("returns an empty string for a missing value", () => {
    expect(formatDate(null)).toBe("");
    expect(formatDate("")).toBe("");
  });

  it("returns an empty string for an unparseable value", () => {
    expect(formatDate("tomorrow")).toBe("");
  });
});

describe("formatDateMDY", () => {
  it("renders an ISO date as MM/DD/YYYY", () => {
    expect(formatDateMDY("2026-07-01")).toBe("07/01/2026");
  });

  it("zero-pads both the month and the day", () => {
    expect(formatDateMDY("2026-01-05")).toBe("01/05/2026");
  });

  it("does not shift the day backwards", () => {
    expect(formatDateMDY("2026-12-31")).toBe("12/31/2026");
  });

  it("ignores a trailing time component on a full ISO timestamp", () => {
    expect(formatDateMDY("2026-07-01T00:00:00.000Z")).toBe("07/01/2026");
  });

  it("returns an empty string for a missing value, so a blank grid cell stays blank", () => {
    expect(formatDateMDY(null)).toBe("");
    expect(formatDateMDY(undefined)).toBe("");
    expect(formatDateMDY("")).toBe("");
  });

  it("returns an empty string for an unparseable value rather than showing NaN", () => {
    expect(formatDateMDY("N/A")).toBe("");
  });
});

describe("parseLocalDateSafe", () => {
  it("parses an ISO date into a local-midnight Date", () => {
    const date = parseLocalDateSafe("2026-07-01");

    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(6); // 0-based
    expect(date.getDate()).toBe(1);
    expect(date.getHours()).toBe(0);
  });

  it("does not shift the date backwards the way new Date(iso) would", () => {
    expect(parseLocalDateSafe("2026-07-01").getDate()).toBe(1);
  });

  it("drops a trailing time component", () => {
    expect(parseLocalDateSafe("2026-07-01T18:45:00Z").getDate()).toBe(1);
  });

  it("returns null for a missing value", () => {
    expect(parseLocalDateSafe(null)).toBeNull();
    expect(parseLocalDateSafe(undefined)).toBeNull();
    expect(parseLocalDateSafe("")).toBeNull();
  });

  it("returns null for a value with no day component", () => {
    expect(parseLocalDateSafe("2026-07")).toBeNull();
  });

  it("returns null for a non-date string", () => {
    expect(parseLocalDateSafe("hello")).toBeNull();
  });

  it("round-trips through formatDateMDY without drifting a day", () => {
    expect(formatDateMDY("2026-03-09")).toBe("03/09/2026");
    expect(parseLocalDateSafe("2026-03-09").getDate()).toBe(9);
  });
});
