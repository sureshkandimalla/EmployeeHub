import React from "react";
import { render, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import axios from "axios";
import { MemoryRouter } from "react-router-dom";
import EmployeeTimesheetSummary from "./EmployeeTimesheetSummary";
import API_ENDPOINTS from "../config";
import AuthContext from "../Authentication/Context/AuthContext";
import { ROLES } from "../Utils/roleAccess";

jest.mock("axios");

// Same grid-double pattern as WorkForceList.test.jsx/AllBills.test.jsx.
const gridProps = { current: null };

jest.mock("@ag-grid-community/react", () => ({
  AgGridReact: (props) => {
    gridProps.current = props;
    return <div data-testid="ag-grid" />;
  },
}));

jest.mock("ag-grid-enterprise", () => ({}));

const ASSIGNMENTS = [{ assignmentId: 1, projectName: "ProjA", startDate: "2026-01-01", endDate: "2026-01-31" }];
const ENTRIES = [{ assignmentId: 1, workDate: "2026-01-10", hours: 8, status: "Submitted" }];

beforeEach(() => {
  axios.get.mockImplementation((url) => {
    if (url.includes("assignmentsForEmployee")) return Promise.resolve({ data: ASSIGNMENTS });
    if (url.includes("getByEmployeeAndRange")) return Promise.resolve({ data: ENTRIES });
    return Promise.resolve({ data: [] });
  });
});

afterEach(() => {
  gridProps.current = null;
  jest.clearAllMocks();
});

const renderSummary = async (role) => {
  render(
    <AuthContext.Provider value={{ user: { role } }}>
      <MemoryRouter>
        <EmployeeTimesheetSummary employeeId={7} />
      </MemoryRouter>
    </AuthContext.Provider>,
  );
  await waitFor(() => expect(gridProps.current?.rowData?.length).toBe(1));
};

const actionsCellRenderer = () =>
  gridProps.current.columnDefs.find((c) => c.colId === "actions").cellRenderer;

const itemKeys = (element) => element.props.children[0].props.menu.items.map((i) => i.key);

describe("EmployeeTimesheetSummary — Approve/Reopen are ADMIN-only", () => {
  it("includes Approve and Reopen for an ADMIN", async () => {
    await renderSummary(ROLES.ADMIN);
    const row = gridProps.current.rowData[0];
    const element = actionsCellRenderer()({ data: row });
    expect(itemKeys(element)).toEqual(expect.arrayContaining(["approve", "reopen"]));
  });

  it("omits Approve and Reopen for ACCOUNTING", async () => {
    await renderSummary(ROLES.ACCOUNTING);
    const row = gridProps.current.rowData[0];
    const element = actionsCellRenderer()({ data: row });
    expect(itemKeys(element)).toEqual(["submit", "reject"]);
  });

  it("renders nothing for a group header row (no params.data)", async () => {
    await renderSummary(ROLES.ADMIN);
    expect(actionsCellRenderer()({ data: undefined })).toBeNull();
  });
});
