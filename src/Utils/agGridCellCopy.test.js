import { getCellCopyContextMenuItems, gridPopupParent } from "./agGridCellCopy";

// navigator.clipboard is a read-only getter in jsdom — Object.defineProperty
// (not Object.assign) is required to stub it per test.
const stubClipboard = (value) =>
  Object.defineProperty(navigator, "clipboard", { value, writable: true, configurable: true });

describe("getCellCopyContextMenuItems", () => {
  it.each([undefined, null, ""])("returns no menu items for an empty cell value (%p)", (value) => {
    expect(getCellCopyContextMenuItems({ value })).toEqual([]);
  });

  it("offers a single Copy entry showing the full value when it's short", () => {
    const items = getCellCopyContextMenuItems({ value: "jane@example.com" });
    expect(items).toHaveLength(1);
    expect(items[0].name).toBe('Copy "jane@example.com"');
  });

  it("truncates the menu label (not the copied text) past 40 characters", () => {
    const longValue = "a".repeat(50);
    const items = getCellCopyContextMenuItems({ value: longValue });
    expect(items[0].name).toBe(`Copy "${"a".repeat(40)}…"`);
  });

  it("copies the full, untruncated value to the clipboard when clicked", () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    stubClipboard({ writeText });

    const longValue = "b".repeat(50);
    getCellCopyContextMenuItems({ value: longValue })[0].action();

    expect(writeText).toHaveBeenCalledWith(longValue);
  });

  it("stringifies a non-string value (e.g. a number) before copying", () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    stubClipboard({ writeText });

    const items = getCellCopyContextMenuItems({ value: 42 });
    expect(items[0].name).toBe('Copy "42"');
    items[0].action();
    expect(writeText).toHaveBeenCalledWith("42");
  });

  it("does not throw when the Clipboard API is unavailable", () => {
    stubClipboard(undefined);
    expect(() => getCellCopyContextMenuItems({ value: "x" })[0].action()).not.toThrow();
  });

  it("swallows a rejected clipboard write instead of throwing", async () => {
    const writeText = jest.fn().mockRejectedValue(new Error("no permission"));
    stubClipboard({ writeText });

    expect(() => getCellCopyContextMenuItems({ value: "x" })[0].action()).not.toThrow();
    // Let the rejection's .catch() actually run before the test ends.
    await Promise.resolve().then().then();
  });
});

describe("gridPopupParent", () => {
  it("is document.body, so grid popups escape the grid's own height-measured ancestor chain", () => {
    expect(gridPopupParent).toBe(document.body);
  });
});
