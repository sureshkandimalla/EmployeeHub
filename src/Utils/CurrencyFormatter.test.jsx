import { formatCurrency } from "./CurrencyFormatter";

// Every money column in every grid renders through this, so a null here
// becomes a blank/NaN cell in a financial report.

describe("formatCurrency", () => {
  it("formats a whole-dollar amount with two decimal places", () => {
    expect(formatCurrency(1000)).toBe("$1,000.00");
  });

  it("groups thousands with commas", () => {
    expect(formatCurrency(1234567.89)).toBe("$1,234,567.89");
  });

  it("keeps the cents on a fractional amount", () => {
    expect(formatCurrency(45.5)).toBe("$45.50");
  });

  it("rounds to two decimal places", () => {
    expect(formatCurrency(45.567)).toBe("$45.57");
  });

  it("renders zero as $0.00 rather than blank", () => {
    expect(formatCurrency(0)).toBe("$0.00");
  });

  it("renders a negative amount with a leading minus sign", () => {
    expect(formatCurrency(-250.75)).toBe("-$250.75");
  });

  it("falls back to $0.00 for a null amount", () => {
    expect(formatCurrency(null)).toBe("$0.00");
  });

  it("falls back to $0.00 for a missing amount", () => {
    expect(formatCurrency(undefined)).toBe("$0.00");
  });

  it("formats a numeric string the backend may have sent as a string", () => {
    expect(formatCurrency("1500")).toBe("$1,500.00");
  });
});
