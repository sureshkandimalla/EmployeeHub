import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import axios from "axios";
import { MemoryRouter } from "react-router-dom";
import WorkForceList from "./WorkForceList";
import API_ENDPOINTS from "../config";

jest.mock("axios");

// AG Grid Enterprise does not render a usable viewport under jsdom (it needs
// real layout and a licence), and the behaviour worth testing here is this
// component's *data handling*: which rows it hands the grid, which columns it
// derives, and what it does with the grid's callbacks. So the grid itself is
// replaced with a double that records the props it was given and exposes the
// callbacks for a test to invoke, exactly as the real grid would.
const gridProps = { current: null };

jest.mock("@ag-grid-community/react", () => ({
  AgGridReact: (props) => {
    gridProps.current = props;
    return <div data-testid="ag-grid" />;
  },
}));

// AG Grid's enterprise bundle and stylesheets have nothing to contribute in
// jsdom and are slow to evaluate.
jest.mock("ag-grid-enterprise", () => ({}));

const EMPLOYEES = [
  {
    employeeId: 1,
    firstName: "John",
    lastName: "Doe",
    annualPay: 50000,
    designation: "Developer",
    phone: "1234567890",
    emailId: "john@example.com",
    status: "Active",
    companyName: "Intellan Technologies LLC",
    vendorId: null,
  },
  {
    employeeId: 2,
    firstName: "Jane",
    lastName: "Smith",
    annualPay: 60000,
    designation: "Manager",
    phone: "9876543210",
    emailId: "jane@example.com",
    status: "Active",
    companyName: "Code9 LLC",
    vendorId: 11,
  },
];

const VENDORS = [{ vendorId: 11, vendorCompanyName: "Supplier Inc" }];

beforeEach(() => {
  axios.get.mockResolvedValue({ data: VENDORS });
  axios.put.mockResolvedValue({ data: {} });
  axios.delete.mockResolvedValue({ data: {} });
  localStorage.setItem("user", JSON.stringify({ role: "ADMIN", name: "Admin" }));
});

afterEach(() => {
  gridProps.current = null;
  localStorage.clear();
  jest.clearAllMocks();
});

const renderList = async (options = {}) => {
  // `employees` is deliberately read with a presence check rather than a
  // destructuring default, so a test can pass `undefined` on purpose.
  const employees = "employees" in options ? options.employees : EMPLOYEES;
  const onRefresh = options.onRefresh ?? jest.fn();

  render(
    <MemoryRouter>
      <WorkForceList employees={employees} isCollapsed onRefresh={onRefresh} />
    </MemoryRouter>,
  );
  // The vendor list is fetched on mount; wait for it to be applied to the
  // Vendor column so no state update lands outside an act() boundary and no
  // test reads a half-built column set.
  await waitFor(() => expect(axios.get).toHaveBeenCalledWith(API_ENDPOINTS.getAllVendors));
  await waitFor(() =>
    expect(columnByColId("vendorId").cellEditorParams.values).toHaveLength(VENDORS.length + 1),
  );
  return { onRefresh };
};

const columnByColId = (colId) =>
  gridProps.current.columnDefs.find((col) => col.colId === colId);

// GridToolbar renders a hidden, aria-hidden clone of every toolbar child
// purely to measure natural widths, so each control exists twice in the DOM.
// Role-based queries skip the clone; placeholder-based ones do not, so scope
// them to the visible row.
const visibleToolbar = () => document.querySelector(".grid-toolbar-visible");
const searchBox = () => within(visibleToolbar()).getByPlaceholderText("Search...");

describe("WorkForceList — toolbar", () => {
  it("renders the search box, refresh and export controls", async () => {
    await renderList();

    expect(searchBox()).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Refresh/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Export to Excel/ })).toBeInTheDocument();
  });

  it("hides Save Changes until something has actually been edited", async () => {
    await renderList();

    expect(screen.queryByRole("button", { name: /Save Changes/ })).not.toBeInTheDocument();
  });

  it("asks the parent to reload when Refresh is clicked", async () => {
    const { onRefresh } = await renderList();

    await userEvent.click(screen.getByRole("button", { name: /Refresh/ }));

    expect(onRefresh).toHaveBeenCalled();
  });

  it("exports through the grid when Export to Excel is clicked", async () => {
    await renderList();
    const exportDataAsExcel = jest.fn();
    gridProps.current.onGridReady({ api: { exportDataAsExcel } });

    await userEvent.click(screen.getByRole("button", { name: /Export to Excel/ }));

    expect(exportDataAsExcel).toHaveBeenCalled();
  });
});

describe("WorkForceList — row data", () => {
  it("passes every employee through to the grid", async () => {
    await renderList();

    expect(gridProps.current.rowData).toHaveLength(2);
    expect(gridProps.current.rowData[0].firstName).toBe("John");
  });

  it("hands the grid an empty row set when there are no employees", async () => {
    await renderList({ employees: [] });

    expect(gridProps.current.rowData).toEqual([]);
  });

  it("hands the grid an empty row set when the employee list is missing entirely", async () => {
    await renderList({ employees: undefined });

    expect(gridProps.current.rowData).toEqual([]);
  });

  it("hands the grid an empty row set when the API returned something that is not an array", async () => {
    await renderList({ employees: { error: "boom" } });

    expect(gridProps.current.rowData).toEqual([]);
  });

  it("identifies each row by its employee id, so edits survive a re-render", async () => {
    await renderList();

    expect(gridProps.current.getRowId({ data: { employeeId: 7 } })).toBe("7");
  });
});

describe("WorkForceList — LCA Wage derived from the latest visa", () => {
  it("derives lcaWage from the employee's highest-numbered (latest) visa", async () => {
    await renderList({
      employees: [
        {
          ...EMPLOYEES[0],
          visas: [
            { visaId: 1, lcaWage: 90000 },
            { visaId: 5, lcaWage: 120000 },
            { visaId: 3, lcaWage: 100000 },
          ],
        },
      ],
    });

    expect(gridProps.current.rowData[0].lcaWage).toBe(120000);
  });

  it("falls back to the visa's nested LCA record when the visa has no lcaWage of its own", async () => {
    await renderList({
      employees: [{ ...EMPLOYEES[0], visas: [{ visaId: 2, lca: { lcaWage: 111000 } }] }],
    });

    expect(gridProps.current.rowData[0].lcaWage).toBe(111000);
  });

  it("prefers the visa's own lcaWage over the nested LCA record", async () => {
    await renderList({
      employees: [
        { ...EMPLOYEES[0], visas: [{ visaId: 2, lcaWage: 95000, lca: { lcaWage: 111000 } }] },
      ],
    });

    expect(gridProps.current.rowData[0].lcaWage).toBe(95000);
  });

  it("leaves lcaWage null for an employee with no visas", async () => {
    await renderList();

    expect(gridProps.current.rowData[0].lcaWage).toBeNull();
  });

  it("leaves lcaWage null when the latest visa has neither an lcaWage nor an LCA", async () => {
    await renderList({ employees: [{ ...EMPLOYEES[0], visas: [{ visaId: 2 }] }] });

    expect(gridProps.current.rowData[0].lcaWage).toBeNull();
  });

  it("does not mutate the employee objects it was handed", async () => {
    const employees = [{ ...EMPLOYEES[0], visas: [{ visaId: 1, lcaWage: 90000 }] }];
    await renderList({ employees });

    expect(employees[0]).not.toHaveProperty("lcaWage");
  });
});

describe("WorkForceList — search", () => {
  it("narrows the grid's rows to those matching the search text", async () => {
    await renderList();

    await userEvent.type(searchBox(), "Jane");

    await waitFor(() => expect(gridProps.current.rowData).toHaveLength(1));
    expect(gridProps.current.rowData[0].firstName).toBe("Jane");
  });

  it("matches on any field, not just the name", async () => {
    await renderList();

    await userEvent.type(searchBox(), "Manager");

    await waitFor(() => expect(gridProps.current.rowData).toHaveLength(1));
    expect(gridProps.current.rowData[0].designation).toBe("Manager");
  });

  it("ignores case when matching", async () => {
    await renderList();

    await userEvent.type(searchBox(), "jANE");

    await waitFor(() => expect(gridProps.current.rowData).toHaveLength(1));
  });

  it("matches on a partial value", async () => {
    await renderList();

    await userEvent.type(searchBox(), "example.com");

    await waitFor(() => expect(gridProps.current.rowData).toHaveLength(2));
  });

  it("shows no rows when nothing matches", async () => {
    await renderList();

    await userEvent.type(searchBox(), "zzzz");

    await waitFor(() => expect(gridProps.current.rowData).toHaveLength(0));
  });

  it("restores every row when the search box is cleared", async () => {
    await renderList();

    await userEvent.type(searchBox(), "Jane");
    await waitFor(() => expect(gridProps.current.rowData).toHaveLength(1));
    await userEvent.clear(searchBox());

    await waitFor(() => expect(gridProps.current.rowData).toHaveLength(2));
  });
});

describe("WorkForceList — inline editing and saving", () => {
  const editCell = async (row) => {
    await waitFor(() => expect(gridProps.current).not.toBeNull());
    gridProps.current.onCellValueChanged({ data: row });
  };

  it("reveals Save Changes once a cell has been edited", async () => {
    await renderList();

    await editCell({ ...EMPLOYEES[0], status: "Bench" });

    expect(await screen.findByRole("button", { name: /Save Changes/ })).toBeInTheDocument();
  });

  it("ignores an edit on a row with no employee id", async () => {
    await renderList();

    await editCell({ firstName: "Ghost" });

    expect(screen.queryByRole("button", { name: /Save Changes/ })).not.toBeInTheDocument();
  });

  it("PUTs the edited employee to the update endpoint when Save Changes is clicked", async () => {
    await renderList();
    const edited = { ...EMPLOYEES[0], status: "Bench" };

    await editCell(edited);
    await userEvent.click(await screen.findByRole("button", { name: /Save Changes/ }));

    await waitFor(() =>
      expect(axios.put).toHaveBeenCalledWith(API_ENDPOINTS.updateEmployee(1), edited),
    );
  });

  it("saves one request per edited employee, not one per edited cell", async () => {
    await renderList();

    await editCell({ ...EMPLOYEES[0], status: "Bench" });
    await editCell({ ...EMPLOYEES[0], status: "Bench", designation: "Lead" });
    await editCell({ ...EMPLOYEES[1], status: "Bench" });
    await userEvent.click(await screen.findByRole("button", { name: /Save Changes/ }));

    await waitFor(() => expect(axios.put).toHaveBeenCalledTimes(2));
  });

  it("sends only the latest value for an employee edited more than once", async () => {
    await renderList();

    await editCell({ ...EMPLOYEES[0], designation: "Lead" });
    await editCell({ ...EMPLOYEES[0], designation: "Principal" });
    await userEvent.click(await screen.findByRole("button", { name: /Save Changes/ }));

    await waitFor(() => expect(axios.put).toHaveBeenCalledTimes(1));
    expect(axios.put.mock.calls[0][1].designation).toBe("Principal");
  });

  it("hides Save Changes again and reloads the list after a successful save", async () => {
    const { onRefresh } = await renderList();

    await editCell({ ...EMPLOYEES[0], status: "Bench" });
    await userEvent.click(await screen.findByRole("button", { name: /Save Changes/ }));

    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /Save Changes/ })).not.toBeInTheDocument(),
    );
    expect(onRefresh).toHaveBeenCalled();
  });

  it("keeps the pending edits and does not reload when the save fails", async () => {
    axios.put.mockRejectedValue(new Error("network down"));
    const { onRefresh } = await renderList();

    await editCell({ ...EMPLOYEES[0], status: "Bench" });
    await userEvent.click(await screen.findByRole("button", { name: /Save Changes/ }));

    await waitFor(() => expect(axios.put).toHaveBeenCalled());
    expect(await screen.findByRole("button", { name: /Save Changes/ })).toBeInTheDocument();
    expect(onRefresh).not.toHaveBeenCalled();
  });
});

describe("WorkForceList — column definitions", () => {
  it("exposes LCA Wage under the field the row data actually uses", async () => {
    await renderList();

    expect(columnByColId("lcaWage")).toBeDefined();
    expect(columnByColId("lcaWage").field).toBe("lcaWage");
  });

  it("makes LCA Wage read-only, since the employee update endpoint cannot persist it", async () => {
    await renderList();

    expect(columnByColId("lcaWage").editable).toBe(false);
  });

  it("keeps SSN and DOB on their lower-case field names", async () => {
    await renderList();

    expect(columnByColId("ssn").field).toBe("ssn");
    expect(columnByColId("dob").field).toBe("dob");
  });

  it("leaves every other column editable", async () => {
    await renderList();

    expect(columnByColId("status").editable).toBe(true);
    expect(columnByColId("designation").editable).toBe(true);
  });

  it("offers the configured working statuses as the Status cell editor's choices", async () => {
    await renderList();

    expect(columnByColId("status").cellEditor).toBe("agSelectCellEditor");
    expect(columnByColId("status").cellEditorParams.values).toContain("Active");
    expect(columnByColId("status").cellEditorParams.values).toContain("NewHires");
  });

  it("offers the configured work authorizations as the Visa cell editor's choices", async () => {
    await renderList();

    expect(columnByColId("visa").cellEditorParams.values).toContain("H1B");
    expect(columnByColId("visa").cellEditorParams.values).toContain("OPT");
  });

  it("pins First Name and Last Name to the left so they stay visible while scrolling", async () => {
    await renderList();

    expect(columnByColId("firstName").pinned).toBe("left");
    expect(columnByColId("lastName").pinned).toBe("left");
  });

  it("pins the row-number column left and the action column right", async () => {
    await renderList();

    expect(columnByColId("rowNum").pinned).toBe("left");
    expect(columnByColId("action").pinned).toBe("right");
  });

  it("numbers rows from 1, not 0", async () => {
    await renderList();

    expect(columnByColId("rowNum").valueGetter({ node: { rowIndex: 0 } })).toBe(1);
  });

  it("appends any extra primitive field the API returned as its own column", async () => {
    await renderList({
      employees: [{ ...EMPLOYEES[0], probationEndDate: "2026-07-01" }],
    });

    expect(columnByColId("probationEndDate")).toBeDefined();
  });

  it("does not create a column for a nested object or array field", async () => {
    await renderList({
      employees: [{ ...EMPLOYEES[0], visas: [{ visaId: 1 }], manager: { id: 2 } }],
    });

    expect(columnByColId("visas")).toBeUndefined();
    expect(columnByColId("manager")).toBeUndefined();
  });
});

describe("WorkForceList — vendor column", () => {
  it("shows the vendor's company name rather than its raw id", async () => {
    await renderList();

    expect(columnByColId("vendorId").valueGetter({ data: { vendorId: 11 } })).toBe(
      "Supplier Inc",
    );
  });

  it("shows a blank vendor for an employee with none", async () => {
    await renderList();

    expect(columnByColId("vendorId").valueGetter({ data: { vendorId: null } })).toBe("");
  });

  it("writes the chosen vendor's id back onto the row, not its name", async () => {
    await renderList();
    const row = { vendorId: null };

    columnByColId("vendorId").valueSetter({ data: row, newValue: "Supplier Inc" });

    expect(row.vendorId).toBe(11);
  });

  it("clears the vendor id when the blank option is chosen", async () => {
    await renderList();
    const row = { vendorId: 11 };

    columnByColId("vendorId").valueSetter({ data: row, newValue: "" });

    expect(row.vendorId).toBeNull();
  });

  it("offers a blank choice plus every loaded vendor in the editor", async () => {
    await renderList();

    expect(columnByColId("vendorId").cellEditorParams.values).toEqual(["", "Supplier Inc"]);
  });

  it("still renders with an empty vendor list when the vendor fetch fails", async () => {
    axios.get.mockRejectedValue(new Error("network down"));
    render(
      <MemoryRouter>
        <WorkForceList employees={EMPLOYEES} isCollapsed onRefresh={jest.fn()} />
      </MemoryRouter>,
    );

    await waitFor(() => expect(gridProps.current).not.toBeNull());
    expect(columnByColId("vendorId").cellEditorParams.values).toEqual([""]);
    expect(gridProps.current.rowData).toHaveLength(2);
  });
});
