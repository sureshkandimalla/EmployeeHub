import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import axios from "axios";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import TimesheetEntry from "./TimesheetEntry";
import API_ENDPOINTS from "../config";
import AuthContext from "../Authentication/Context/AuthContext";
import { ROLES } from "../Utils/roleAccess";

jest.mock("axios");

const EMPLOYEE = { employeeId: 1, firstName: "Jane", lastName: "Doe", companyName: "" };
const ASSIGNMENT = { assignmentId: 10, projectId: 5, projectName: "ProjA", startDate: "2026-01-01", endDate: "2026-12-31" };

const mockFetches = (dayStatus) => {
  axios.get.mockImplementation((url) => {
    if (url === API_ENDPOINTS.getAllEmployees) return Promise.resolve({ data: [EMPLOYEE] });
    if (url === API_ENDPOINTS.assignmentsForEmployee(1)) return Promise.resolve({ data: [ASSIGNMENT] });
    if (url === API_ENDPOINTS.getTimesheetByAssignmentAndMonth(10, "2026-01")) {
      return Promise.resolve({
        data: dayStatus ? [{ workDate: "2026-01-05", hours: 8, timesheetId: 1, status: dayStatus }] : [],
      });
    }
    return Promise.resolve({ data: [] });
  });
};

afterEach(() => jest.clearAllMocks());

const renderEntry = async (dayStatus, role = ROLES.ACCOUNTING) => {
  mockFetches(dayStatus);
  render(
    <AuthContext.Provider value={{ user: { role } }}>
      <MemoryRouter
        initialEntries={[
          { pathname: "/timesheets/entry", state: { employeeId: 1, assignmentId: 10, yearMonth: "2026-01" } },
        ]}
      >
        <Routes>
          <Route path="/timesheets/entry" element={<TimesheetEntry />} />
          <Route path="/generateInvoice" element={<div>Generate Invoice Page</div>} />
          <Route path="/timesheets" element={<div>Timesheets Landing</div>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
  const expectedStatus = dayStatus === "Approved" ? "Approved" : dayStatus === "Submitted" ? "Submitted" : "Draft";
  // Generate Invoice's own text renders immediately (it's static markup) —
  // wait for the Status tag instead, since that only reflects its final
  // value once the employee->assignment->month fetch chain has resolved.
  await waitFor(() => expect(screen.getByText(expectedStatus)).toBeInTheDocument());
};

describe("TimesheetEntry — Generate Invoice is gated on the month being Approved", () => {
  it("disables Generate Invoice while the month is Draft", async () => {
    await renderEntry(null);
    expect(screen.getByRole("button", { name: /generate invoice/i })).toBeDisabled();
  });

  it("disables Generate Invoice while the month is only Submitted", async () => {
    await renderEntry("Submitted");
    expect(screen.getByRole("button", { name: /generate invoice/i })).toBeDisabled();
  });

  it("enables Generate Invoice once the month is Approved", async () => {
    await renderEntry("Approved");
    await waitFor(() => expect(screen.getByRole("button", { name: /generate invoice/i })).toBeEnabled());
  });

  it("navigates to /generateInvoice when clicked with an Approved month", async () => {
    await renderEntry("Approved");
    axios.get.mockImplementation((url) => {
      if (url === API_ENDPOINTS.activeProjectsForInvoiceByEmployee(1)) {
        return Promise.resolve({ data: [{ employeeName: "Jane Doe", invoiceId: null }] });
      }
      return Promise.resolve({ data: [] });
    });

    await userEvent.click(screen.getByRole("button", { name: /generate invoice/i }));
    await waitFor(() => expect(screen.getByText("Generate Invoice Page")).toBeInTheDocument());
  });
});

describe("TimesheetEntry — Approve/Reopen are ADMIN-only", () => {
  it("hides Approve/Reopen for a non-ADMIN role", async () => {
    await renderEntry("Submitted", ROLES.ACCOUNTING);
    expect(screen.queryByRole("button", { name: /approve/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /reopen/i })).not.toBeInTheDocument();
  });

  it("shows Approve/Reopen for ADMIN", async () => {
    await renderEntry("Submitted", ROLES.ADMIN);
    expect(screen.getByRole("button", { name: /approve/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reopen/i })).toBeInTheDocument();
  });
});
