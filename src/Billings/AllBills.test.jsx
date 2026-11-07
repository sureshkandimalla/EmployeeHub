import React from "react";
import { render, waitFor, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import axios from "axios";
import AllBills from "./AllBills";
import API_ENDPOINTS from "../config";
import AuthContext from "../Authentication/Context/AuthContext";
import { ROLES } from "../Utils/roleAccess";

jest.mock("axios");

// Same double-the-grid pattern WorkForceList.test.jsx already established:
// AG Grid Enterprise needs real layout/a licence and contributes nothing
// under jsdom, so it's replaced with a stand-in that records the props it
// was given (columnDefs, rowData, the pinned total rows, the
// onCellValueChanged callback) for assertions and direct invocation.
const gridProps = { current: null };

jest.mock("@ag-grid-community/react", () => ({
  AgGridReact: (props) => {
    gridProps.current = props;
    return <div data-testid="ag-grid" />;
  },
}));

jest.mock("ag-grid-enterprise", () => ({}));

const BILLS = [
  { billId: 1, employeeId: 100, invoiceId: 500, projectId: 10, billing: 50, hours: 10, total: 500, billPaidAmount: 200, discount: 20, status: "Partial", billType: "Labor" },
  { billId: 2, employeeId: 101, invoiceId: 501, projectId: 10, billing: 60, hours: 8, total: 480, billPaidAmount: 0, discount: 0, status: "Unpaid", billType: "Labor" },
];

const EMPLOYEES = [
  { employeeId: 100, firstName: "Jane", lastName: "Doe", employeeType: "W2" },
  { employeeId: 101, firstName: "John", lastName: "Smith", employeeType: "W2" },
];

const mockGetResponses = () => {
  axios.get.mockImplementation((url) => {
    if (url === API_ENDPOINTS.getAllBills) return Promise.resolve({ data: BILLS });
    if (url === API_ENDPOINTS.getAllEmployees) return Promise.resolve({ data: EMPLOYEES });
    if (url === API_ENDPOINTS.getAllVendors) return Promise.resolve({ data: [] });
    return Promise.resolve({ data: [] });
  });
};

beforeEach(() => {
  mockGetResponses();
  axios.put.mockResolvedValue({ data: {} });
});

afterEach(() => {
  gridProps.current = null;
  jest.clearAllMocks();
});

const renderAllBills = async (role) => {
  render(
    <AuthContext.Provider value={{ user: { role } }}>
      <AllBills />
    </AuthContext.Provider>,
  );
  await waitFor(() => expect(gridProps.current?.rowData?.length).toBe(BILLS.length));
};

const columnByField = (field) => gridProps.current.columnDefs.find((col) => col.field === field);

describe("AllBills — role-gated editing", () => {
  it.each([ROLES.ADMIN, ROLES.HR, ROLES.ACCOUNTING])(
    "lets %s edit Bill PaidAmount, Discount, Status and Comments",
    async (role) => {
      await renderAllBills(role);
      expect(columnByField("billPaidAmount").editable).toBe(true);
      expect(columnByField("discount").editable).toBe(true);
      expect(columnByField("status").editable).toBe(true);
      expect(columnByField("comments").editable).toBe(true);
    },
  );

  it("denies IMMIGRATION edit access to the same columns", async () => {
    await renderAllBills(ROLES.IMMIGRATION);
    expect(columnByField("billPaidAmount").editable).toBe(false);
    expect(columnByField("discount").editable).toBe(false);
    expect(columnByField("status").editable).toBe(false);
    expect(columnByField("comments").editable).toBe(false);
  });

  it("never makes Balance editable, for any role — it's computed, not entered", async () => {
    await renderAllBills(ROLES.ADMIN);
    expect(columnByField("balance").editable).toBeFalsy();
  });
});

describe("AllBills — balance computation and totals", () => {
  it("computes each row's balance as total minus paid minus discount", async () => {
    await renderAllBills(ROLES.ACCOUNTING);
    const rows = gridProps.current.rowData;
    const row1 = rows.find((r) => r.billId === 1);
    expect(row1.balance).toBe(500 - 200 - 20); // 280
    const row2 = rows.find((r) => r.billId === 2);
    expect(row2.balance).toBe(480 - 0 - 0); // 480
  });

  it("sums balance (and the other numeric columns) into the pinned Total row", async () => {
    await renderAllBills(ROLES.ACCOUNTING);
    const [totalRow] = gridProps.current.pinnedBottomRowData;
    expect(totalRow.employeeName).toBe("Total");
    expect(totalRow.total).toBe(500 + 480);
    expect(totalRow.billPaidAmount).toBe(200 + 0);
    expect(totalRow.discount).toBe(20 + 0);
    expect(totalRow.balance).toBe(280 + 480);
  });
});

describe("AllBills — editing a cell", () => {
  it("PUTs the full bill payload to updateBill and writes the server response back into state", async () => {
    await renderAllBills(ROLES.ACCOUNTING);
    const updatedFromServer = { ...BILLS[0], status: "Paid", billPaidAmount: 500 };
    axios.put.mockResolvedValueOnce({ data: updatedFromServer });

    const editedRow = { ...gridProps.current.rowData.find((r) => r.billId === 1), status: "Paid" };
    await act(async () => {
      gridProps.current.onCellValueChanged({ data: editedRow });
    });

    expect(axios.put).toHaveBeenCalledWith(
      API_ENDPOINTS.updateBill(1),
      expect.objectContaining({ billId: 1, status: "Paid", invoiceId: 500, projectId: 10 }),
    );

    await waitFor(() =>
      expect(gridProps.current.rowData.find((r) => r.billId === 1).billPaidAmount).toBe(500),
    );
  });

  it("reverts by refetching when the update fails", async () => {
    await renderAllBills(ROLES.ACCOUNTING);
    axios.put.mockRejectedValueOnce(new Error("network down"));
    axios.get.mockClear();
    mockGetResponses();

    const editedRow = { ...gridProps.current.rowData.find((r) => r.billId === 1), status: "Paid" };
    await act(async () => {
      gridProps.current.onCellValueChanged({ data: editedRow });
    });

    await waitFor(() => expect(axios.get).toHaveBeenCalledWith(API_ENDPOINTS.getAllBills));
  });
});
