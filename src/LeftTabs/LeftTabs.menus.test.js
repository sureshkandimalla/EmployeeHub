import { CREATE_MENU, ACCOUNTING_MENU, CUSTOMERS_MENU, VENDORS_MENU } from "./LeftTabs";

// These are plain data (no component rendering needed) but drive what every
// role actually sees in the Create/Accounting/Customers/Vendors flyouts —
// pinned here specifically to catch the two things this session changed:
// ACCOUNTING_MENU gaining Invoices/Timesheets, then later losing its
// duplicate Customers/Vendors sections (three copies of the same links
// was clutter — see the comment on ACCOUNTING_MENU itself).

describe("ACCOUNTING_MENU", () => {
  const sectionTitles = ACCOUNTING_MENU.map((s) => s.title);

  it("does not duplicate the Customers or Vendors sections — those have their own rail icons", () => {
    expect(sectionTitles).not.toContain("Customers");
    expect(sectionTitles).not.toContain("Vendors");
  });

  it("has its own Invoices section with the key invoice pages", () => {
    const invoices = ACCOUNTING_MENU.find((s) => s.title === "Invoices");
    expect(invoices.items.map((i) => i.to)).toEqual(
      expect.arrayContaining(["/invoicedetails", "/generateInvoice", "/unsubmittedInvoices"]),
    );
  });

  it("has its own Timesheets section with the key timesheet pages", () => {
    const timesheets = ACCOUNTING_MENU.find((s) => s.title === "Timesheets");
    expect(timesheets.items.map((i) => i.to)).toEqual(
      expect.arrayContaining(["/timesheets", "/monthlytimesheets", "/unsubmittedTimesheets"]),
    );
  });

  it("still has Adjustments/All Bills — the Accounting-only section that was always here", () => {
    const adjustments = ACCOUNTING_MENU.find((s) => s.title === "Adjustments");
    expect(adjustments.items.map((i) => i.to)).toEqual(
      expect.arrayContaining(["/adjustmentDetails", "/allBills"]),
    );
  });
});

describe("CUSTOMERS_MENU / VENDORS_MENU — derived from CREATE_MENU, not re-listed", () => {
  it("CUSTOMERS_MENU is exactly CREATE_MENU's Customers section, plus a Dashboard link, with ?new=1 stripped", () => {
    const createCustomers = CREATE_MENU.find((s) => s.title === "Customers");
    expect(CUSTOMERS_MENU).toHaveLength(1);
    expect(CUSTOMERS_MENU[0].items[0]).toEqual({ label: "Customer Dashboard", to: "/customerDashboard" });
    // Every item from CREATE_MENU's Customers section is present, unaltered
    // except for the stripped query string.
    createCustomers.items.forEach((createItem) => {
      const stripped = CUSTOMERS_MENU[0].items.find((i) => i.label === createItem.label);
      expect(stripped.to).toBe(createItem.to.split("?")[0]);
    });
  });

  it("VENDORS_MENU is exactly CREATE_MENU's Vendors section, plus a Dashboard link, with ?new=1 stripped", () => {
    const createVendors = CREATE_MENU.find((s) => s.title === "Vendors");
    expect(VENDORS_MENU).toHaveLength(1);
    expect(VENDORS_MENU[0].items[0]).toEqual({ label: "Vendor Dashboard", to: "/vendorDashboard" });
    createVendors.items.forEach((createItem) => {
      const stripped = VENDORS_MENU[0].items.find((i) => i.label === createItem.label);
      expect(stripped.to).toBe(createItem.to.split("?")[0]);
    });
  });

  it("neither menu carries a quick-add ?new=1 query string — these are plain navigation, not shortcuts", () => {
    [...CUSTOMERS_MENU, ...VENDORS_MENU].forEach((section) => {
      section.items.forEach((item) => expect(item.to).not.toContain("?new=1"));
    });
  });
});
