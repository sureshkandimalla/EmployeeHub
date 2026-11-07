import { RangeActionsCell, MonthRowActionsCell } from "./MonthlyTimesheets";

// RangeActionsCell/MonthRowActionsCell are plain functions with no hooks of
// their own (all state/handlers arrive via params), so they can be called
// directly like any other function — no render() or AG Grid mocking needed.
// Both return <div><Dropdown menu={{items}}><Button/></Dropdown></div>; the
// built `items` array is what actually decides which actions a role can
// reach, so that's what these tests inspect.
const dropdownItems = (element) => element.props.children.props.menu.items;
const itemKeys = (element) => dropdownItems(element).map((i) => i.key);

describe("RangeActionsCell — Approve/Reopen are ADMIN-only", () => {
  const baseParams = (isAdmin, status) => ({
    data: { dayStatus: { "2026-01-05": status } },
    rangeDates: [{ iso: "2026-01-05" }],
    scopeLabel: "Week",
    onSave: jest.fn(),
    onSubmit: jest.fn(),
    onApprove: jest.fn(),
    onReject: jest.fn(),
    onReopen: jest.fn(),
    isAdmin,
  });

  it("includes Approve and Reopen for an ADMIN", () => {
    const element = RangeActionsCell(baseParams(true, "Submitted"));
    expect(itemKeys(element)).toEqual(expect.arrayContaining(["approve", "reopen"]));
  });

  it("omits Approve and Reopen entirely for a non-ADMIN — not shown disabled, not shown at all", () => {
    const element = RangeActionsCell(baseParams(false, "Submitted"));
    const keys = itemKeys(element);
    expect(keys).not.toContain("approve");
    expect(keys).not.toContain("reopen");
    // Save/Submit/Reject are still there — only the ADMIN-only pair is gated.
    expect(keys).toEqual(["save", "submit", "reject"]);
  });

  it("still enables Save/Submit/Reject for a non-ADMIN (ADMIN/ACCOUNTING/IMMIGRATION can use those)", () => {
    const element = RangeActionsCell(baseParams(false, "Draft"));
    const items = dropdownItems(element);
    expect(items.find((i) => i.key === "submit").disabled).toBe(false);
  });

  it("Approve's own onClick calls onApprove with the row and range", () => {
    const params = baseParams(true, "Submitted");
    const element = RangeActionsCell(params);
    dropdownItems(element).find((i) => i.key === "approve").onClick();
    expect(params.onApprove).toHaveBeenCalledWith(params.data, params.rangeDates);
  });
});

describe("MonthRowActionsCell — same ADMIN-only gating, for the per-employee summary grid", () => {
  const baseRow = { assignmentId: 42, yearMonth: "2026-01", daysInMonth: 31, dayStatus: { "2026-01-05": "Approved" } };

  const baseParams = (isAdmin) => ({
    data: baseRow,
    weekIdx: null,
    onSave: jest.fn(),
    onSubmit: jest.fn(),
    onApprove: jest.fn(),
    onReject: jest.fn(),
    onReopen: jest.fn(),
    isAdmin,
  });

  it("includes Approve and Reopen for an ADMIN", () => {
    const element = MonthRowActionsCell(baseParams(true));
    expect(itemKeys(element)).toEqual(expect.arrayContaining(["approve", "reopen"]));
  });

  it("omits Approve and Reopen for a non-ADMIN", () => {
    const element = MonthRowActionsCell(baseParams(false));
    expect(itemKeys(element)).toEqual(["save", "submit", "reject"]);
  });

  it("forwards only {assignmentId} (not the full row) to onApprove — the minimalRow convention", () => {
    const params = baseParams(true);
    const element = MonthRowActionsCell(params);
    dropdownItems(element).find((i) => i.key === "approve").onClick();
    expect(params.onApprove).toHaveBeenCalledWith({ assignmentId: 42 }, expect.any(Array));
  });
});
