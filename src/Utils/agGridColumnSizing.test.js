import { sizeColumnsForHeader } from "./agGridColumnSizing";

// Shared by every grid in the app: it floors each column's minWidth off its
// header label so headers never truncate, without shrinking a column that
// already asked for more room.

describe("sizeColumnsForHeader", () => {
  it("widens a column whose header is longer than its declared minWidth", () => {
    const [col] = sizeColumnsForHeader([{ headerName: "Employment Type", minWidth: 50 }]);

    expect(col.minWidth).toBe("Employment Type".length * 8 + 60);
  });

  it("leaves a column that already asked for more room alone", () => {
    const [col] = sizeColumnsForHeader([{ headerName: "Visa", minWidth: 500 }]);

    expect(col.minWidth).toBe(500);
  });

  it("derives a minWidth for a column that declared none", () => {
    const [col] = sizeColumnsForHeader([{ headerName: "SSN" }]);

    expect(col.minWidth).toBe("SSN".length * 8 + 60);
  });

  it("still reserves the icon padding for a column with no header label", () => {
    const [col] = sizeColumnsForHeader([{}]);

    expect(col.minWidth).toBe(60);
  });

  it("leaves a fixed-width column untouched", () => {
    const original = { headerName: "#", width: 120, minWidth: 120, suppressSizeToFit: true };

    const [col] = sizeColumnsForHeader([original]);

    expect(col).toBe(original);
  });

  it("still sizes a suppressSizeToFit column that has no fixed width", () => {
    const [col] = sizeColumnsForHeader([
      { headerName: "Annual Pay", minWidth: 10, suppressSizeToFit: true },
    ]);

    expect(col.minWidth).toBe("Annual Pay".length * 8 + 60);
  });

  it("preserves every other property on the column definition", () => {
    const [col] = sizeColumnsForHeader([
      { colId: "status", headerName: "Status", field: "status", editable: true, minWidth: 10 },
    ]);

    expect(col).toMatchObject({
      colId: "status",
      field: "status",
      editable: true,
      headerName: "Status",
    });
  });

  it("does not mutate the column definitions it was given", () => {
    const original = { headerName: "Designation", minWidth: 10 };

    sizeColumnsForHeader([original]);

    expect(original.minWidth).toBe(10);
  });

  it("returns a column for every input column, in the same order", () => {
    const cols = sizeColumnsForHeader([
      { headerName: "A", minWidth: 10 },
      { headerName: "B", minWidth: 10 },
      { headerName: "C", minWidth: 10 },
    ]);

    expect(cols.map((c) => c.headerName)).toEqual(["A", "B", "C"]);
  });

  it("returns an empty list for an empty column set", () => {
    expect(sizeColumnsForHeader([])).toEqual([]);
  });
});
