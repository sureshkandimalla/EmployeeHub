import { buildPoFileName } from "./poFileName";

// Purchase Orders are renamed on upload so anyone scanning the S3 bucket can
// tell them apart. A collision or an unsafe character here means a PO lands
// under the wrong name (or is rejected by S3).

describe("buildPoFileName", () => {
  const base = {
    employeeName: "Ada Lovelace",
    customerName: "Acme Corp",
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    originalFileName: "scan.pdf",
  };

  it("builds PO_<employee>_<customer>_<start>_<end> with the original extension", () => {
    expect(buildPoFileName(base)).toBe("PO_Ada_Lovelace_Acme_Corp_2026-01-01_2026-12-31.pdf");
  });

  it("replaces spaces in names with underscores", () => {
    expect(buildPoFileName({ ...base, employeeName: "Grace Brewster Hopper" }))
      .toContain("Grace_Brewster_Hopper");
  });

  it("collapses a run of spaces into a single underscore", () => {
    expect(buildPoFileName({ ...base, customerName: "Acme    Corp" })).toContain("Acme_Corp");
  });

  it("strips characters that are unsafe in a file name", () => {
    expect(buildPoFileName({ ...base, customerName: "Acme, Inc. (US)/EU" }))
      .toBe("PO_Ada_Lovelace_Acme_Inc_USEU_2026-01-01_2026-12-31.pdf");
  });

  it("keeps hyphens, which are already safe", () => {
    expect(buildPoFileName({ ...base, customerName: "Acme-Global" })).toContain("Acme-Global");
  });

  it("trims surrounding whitespace before building the name", () => {
    expect(buildPoFileName({ ...base, employeeName: "  Ada Lovelace  " }))
      .toContain("PO_Ada_Lovelace_");
  });

  it("preserves a multi-part extension's final segment", () => {
    expect(buildPoFileName({ ...base, originalFileName: "my.scan.v2.PDF" })).toMatch(/\.PDF$/);
  });

  it("produces no extension when the original file had none", () => {
    expect(buildPoFileName({ ...base, originalFileName: "scan" }))
      .toBe("PO_Ada_Lovelace_Acme_Corp_2026-01-01_2026-12-31");
  });

  it("produces no extension when no original file name was supplied", () => {
    expect(buildPoFileName({ ...base, originalFileName: undefined }))
      .toBe("PO_Ada_Lovelace_Acme_Corp_2026-01-01_2026-12-31");
  });

  it("substitutes Unknown for a missing employee name rather than leaving a gap", () => {
    expect(buildPoFileName({ ...base, employeeName: null }))
      .toBe("PO_Unknown_Acme_Corp_2026-01-01_2026-12-31.pdf");
  });

  it("substitutes Unknown for a missing customer name", () => {
    expect(buildPoFileName({ ...base, customerName: "" })).toContain("_Unknown_");
  });

  it("substitutes Unknown for missing dates", () => {
    expect(buildPoFileName({ ...base, startDate: null, endDate: null }))
      .toBe("PO_Ada_Lovelace_Acme_Corp_Unknown_Unknown.pdf");
  });

  it("gives two different work orders for the same pairing different file names", () => {
    const first = buildPoFileName(base);
    const second = buildPoFileName({ ...base, startDate: "2027-01-01", endDate: "2027-12-31" });

    expect(first).not.toBe(second);
  });

  it("builds a name with no characters S3 would need escaped", () => {
    const name = buildPoFileName({ ...base, employeeName: "José Núñez", customerName: "Ação & Co" });

    expect(name).toMatch(/^[\w.-]+$/);
  });
});
