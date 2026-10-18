import {
  INVOICE_TERM_OPTIONS,
  INVOICE_TERM_DAYS,
  WEEK_START_DAY_OPTIONS,
  DEFAULT_WEEK_START_DAY,
  invoiceTermLabel,
  invoiceTermCode,
  invoiceTermDays,
  computeInvoiceEndDate,
  computeInvoicePeriod,
} from "./invoiceTerm";

// Invoice Term drives every billing period in the app: how many invoices a
// project generates, what each one bills for, and therefore how much money is
// invoiced. It is pure date arithmetic, so it is pinned exhaustively here.

describe("invoiceTerm — option tables", () => {
  it("exposes the six invoice terms the backend understands, keyed by their numeric codes", () => {
    expect(INVOICE_TERM_OPTIONS).toEqual([
      { value: 1, label: "Weekly" },
      { value: 2, label: "Biweekly" },
      { value: 3, label: "Monthly" },
      { value: 4, label: "Special" },
      { value: 5, label: "Semi-Monthly" },
      { value: 6, label: "Once in 4 Weeks" },
    ]);
  });

  it("offers all seven days as a week-start anchor", () => {
    expect(WEEK_START_DAY_OPTIONS).toHaveLength(7);
    expect(WEEK_START_DAY_OPTIONS.map((o) => o.value)).toContain("SUNDAY");
  });

  it("defaults the week-start anchor to Monday", () => {
    expect(DEFAULT_WEEK_START_DAY).toBe("MONDAY");
  });

  it("only gives Weekly and Biweekly a flat day-equivalent", () => {
    expect(INVOICE_TERM_DAYS).toEqual({ 1: 7, 2: 14 });
  });
});

describe("invoiceTermLabel", () => {
  it.each([
    [1, "Weekly"],
    [2, "Biweekly"],
    [3, "Monthly"],
    [4, "Special"],
    [5, "Semi-Monthly"],
    [6, "Once in 4 Weeks"],
  ])("maps code %s to %s", (code, label) => {
    expect(invoiceTermLabel(code)).toBe(label);
  });

  it("accepts the string form of a code, which is how the backend sends it", () => {
    expect(invoiceTermLabel("3")).toBe("Monthly");
  });

  it("returns an empty string for a missing code", () => {
    expect(invoiceTermLabel(null)).toBe("");
    expect(invoiceTermLabel(undefined)).toBe("");
    expect(invoiceTermLabel("")).toBe("");
  });

  it("falls back to showing the raw code when it is not one of the known terms", () => {
    expect(invoiceTermLabel(99)).toBe("99");
  });

  it("treats code 0 as unknown rather than missing", () => {
    expect(invoiceTermLabel(0)).toBe("0");
  });
});

describe("invoiceTermCode", () => {
  it.each([
    ["Weekly", 1],
    ["Biweekly", 2],
    ["Monthly", 3],
    ["Special", 4],
    ["Semi-Monthly", 5],
    ["Once in 4 Weeks", 6],
  ])("maps %s back to code %s", (label, code) => {
    expect(invoiceTermCode(label)).toBe(code);
  });

  it("returns null for a label that is not one of the known terms", () => {
    expect(invoiceTermCode("Fortnightly")).toBeNull();
  });

  it("is case-sensitive, so a differently-cased label does not resolve", () => {
    expect(invoiceTermCode("monthly")).toBeNull();
  });
});

describe("invoiceTermDays", () => {
  it("gives Weekly 7 days and Biweekly 14", () => {
    expect(invoiceTermDays(1)).toBe(7);
    expect(invoiceTermDays(2)).toBe(14);
  });

  it("gives Monthly no flat day count — it is end-of-month, not +30 days", () => {
    expect(invoiceTermDays(3)).toBeNull();
  });

  it("gives Special no day count at all", () => {
    expect(invoiceTermDays(4)).toBeNull();
  });

  it("returns null for a missing code", () => {
    expect(invoiceTermDays(null)).toBeNull();
    expect(invoiceTermDays(undefined)).toBeNull();
    expect(invoiceTermDays("")).toBeNull();
  });

  it("accepts the string form of a code", () => {
    expect(invoiceTermDays("1")).toBe(7);
  });
});

describe("computeInvoiceEndDate", () => {
  it("adds 7 days for a Weekly term", () => {
    expect(computeInvoiceEndDate("2026-07-01", 1)).toBe("2026-07-08");
  });

  it("adds 14 days for a Biweekly term", () => {
    expect(computeInvoiceEndDate("2026-07-01", 2)).toBe("2026-07-15");
  });

  it("rolls into the next month when the day offset crosses a month boundary", () => {
    expect(computeInvoiceEndDate("2026-07-28", 1)).toBe("2026-08-04");
  });

  it("rolls into the next year when the day offset crosses a year boundary", () => {
    expect(computeInvoiceEndDate("2026-12-28", 1)).toBe("2027-01-04");
  });

  it("lands on the last day of the month for a Monthly term", () => {
    expect(computeInvoiceEndDate("2026-07-01", 3)).toBe("2026-07-31");
  });

  it("lands on end-of-month for a Monthly term regardless of which day was picked", () => {
    expect(computeInvoiceEndDate("2026-07-15", 3)).toBe("2026-07-31");
  });

  it("handles a 30-day month for a Monthly term", () => {
    expect(computeInvoiceEndDate("2026-06-10", 3)).toBe("2026-06-30");
  });

  it("handles a non-leap February for a Monthly term", () => {
    expect(computeInvoiceEndDate("2026-02-15", 3)).toBe("2026-02-28");
  });

  it("handles a leap February for a Monthly term", () => {
    expect(computeInvoiceEndDate("2028-02-15", 3)).toBe("2028-02-29");
  });

  it("does not auto-calculate for a Special term", () => {
    expect(computeInvoiceEndDate("2026-07-01", 4)).toBeNull();
  });

  it("does not auto-calculate for an unrecognized term", () => {
    expect(computeInvoiceEndDate("2026-07-01", 99)).toBeNull();
  });

  it("returns null when there is no start date to calculate from", () => {
    expect(computeInvoiceEndDate(null, 1)).toBeNull();
    expect(computeInvoiceEndDate("", 1)).toBeNull();
  });

  it("accepts the string form of the term code", () => {
    expect(computeInvoiceEndDate("2026-07-01", "3")).toBe("2026-07-31");
  });
});

describe("computeInvoicePeriod — Weekly", () => {
  it("snaps a mid-week pick back to the Monday anchor and spans 7 days", () => {
    // 2026-07-01 is a Wednesday; the Monday on or before it is 2026-06-29.
    expect(computeInvoicePeriod("2026-07-01", 1)).toEqual({
      startDate: "2026-06-29",
      endDate: "2026-07-05",
    });
  });

  it("leaves a pick already on the anchor day untouched", () => {
    expect(computeInvoicePeriod("2026-06-29", 1)).toEqual({
      startDate: "2026-06-29",
      endDate: "2026-07-05",
    });
  });

  it("honours a project configured to start its week on Sunday", () => {
    // 2026-07-01 is a Wednesday; the Sunday on or before it is 2026-06-28.
    expect(computeInvoicePeriod("2026-07-01", 1, "SUNDAY")).toEqual({
      startDate: "2026-06-28",
      endDate: "2026-07-04",
    });
  });

  it("honours a project configured to start its week on Thursday", () => {
    // 2026-07-01 is a Wednesday; the Thursday on or before it is 2026-06-25.
    expect(computeInvoicePeriod("2026-07-01", 1, "THURSDAY")).toEqual({
      startDate: "2026-06-25",
      endDate: "2026-07-01",
    });
  });

  it("falls back to Monday for an unrecognized week-start day", () => {
    expect(computeInvoicePeriod("2026-07-01", 1, "NOT_A_DAY")).toEqual({
      startDate: "2026-06-29",
      endDate: "2026-07-05",
    });
  });
});

describe("computeInvoicePeriod — Biweekly", () => {
  it("snaps to the anchor day and spans 14 days", () => {
    expect(computeInvoicePeriod("2026-07-01", 2)).toEqual({
      startDate: "2026-06-29",
      endDate: "2026-07-12",
    });
  });

  it("honours a configured week-start day", () => {
    expect(computeInvoicePeriod("2026-07-01", 2, "SUNDAY")).toEqual({
      startDate: "2026-06-28",
      endDate: "2026-07-11",
    });
  });
});

describe("computeInvoicePeriod — Once in 4 Weeks", () => {
  it("snaps to the anchor day and spans 28 days", () => {
    expect(computeInvoicePeriod("2026-07-01", 6)).toEqual({
      startDate: "2026-06-29",
      endDate: "2026-07-26",
    });
  });
});

describe("computeInvoicePeriod — Monthly", () => {
  it("snaps to the 1st and runs to the last day of the picked month", () => {
    expect(computeInvoicePeriod("2026-07-15", 3)).toEqual({
      startDate: "2026-07-01",
      endDate: "2026-07-31",
    });
  });

  it("handles a 30-day month", () => {
    expect(computeInvoicePeriod("2026-06-15", 3)).toEqual({
      startDate: "2026-06-01",
      endDate: "2026-06-30",
    });
  });

  it("handles a leap February", () => {
    expect(computeInvoicePeriod("2028-02-10", 3)).toEqual({
      startDate: "2028-02-01",
      endDate: "2028-02-29",
    });
  });

  it("handles December without rolling the year", () => {
    expect(computeInvoicePeriod("2026-12-20", 3)).toEqual({
      startDate: "2026-12-01",
      endDate: "2026-12-31",
    });
  });
});

describe("computeInvoicePeriod — Semi-Monthly", () => {
  it("returns the 1st-to-15th half for a pick on or before the 15th", () => {
    expect(computeInvoicePeriod("2026-07-10", 5)).toEqual({
      startDate: "2026-07-01",
      endDate: "2026-07-15",
    });
  });

  it("treats the 15th itself as the first half (inclusive boundary)", () => {
    expect(computeInvoicePeriod("2026-07-15", 5)).toEqual({
      startDate: "2026-07-01",
      endDate: "2026-07-15",
    });
  });

  it("returns the 16th-to-end half for a pick on the 16th", () => {
    expect(computeInvoicePeriod("2026-07-16", 5)).toEqual({
      startDate: "2026-07-16",
      endDate: "2026-07-31",
    });
  });

  it("ends the second half on the month's real last day in a short month", () => {
    expect(computeInvoicePeriod("2026-02-20", 5)).toEqual({
      startDate: "2026-02-16",
      endDate: "2026-02-28",
    });
  });
});

describe("computeInvoicePeriod — Special and edge cases", () => {
  it("keeps the picked start date and auto-calculates nothing for a Special term", () => {
    expect(computeInvoicePeriod("2026-07-15", 4)).toEqual({
      startDate: "2026-07-15",
      endDate: null,
    });
  });

  it("treats an unrecognized term the same as Special", () => {
    expect(computeInvoicePeriod("2026-07-15", 99)).toEqual({
      startDate: "2026-07-15",
      endDate: null,
    });
  });

  it("returns a fully empty period when there is no start date", () => {
    expect(computeInvoicePeriod(null, 1)).toEqual({ startDate: null, endDate: null });
    expect(computeInvoicePeriod("", 3)).toEqual({ startDate: null, endDate: null });
  });

  it("accepts the string form of the term code", () => {
    expect(computeInvoicePeriod("2026-07-15", "3")).toEqual({
      startDate: "2026-07-01",
      endDate: "2026-07-31",
    });
  });

  it("produces back-to-back, non-overlapping Weekly periods", () => {
    const first = computeInvoicePeriod("2026-06-29", 1);
    const second = computeInvoicePeriod("2026-07-06", 1);

    expect(first.endDate).toBe("2026-07-05");
    expect(second.startDate).toBe("2026-07-06");
  });
});
