import React, { useEffect, useState } from "react";
import axios from "axios";
import API_ENDPOINTS from "../config";
import GenerateInvoiceDetails from "./GenerateInvoiceDetails";

// Company-wide "what's eligible to invoice but hasn't been submitted yet"
// view — the exact same bulk path Invoice Details' own "Generate Invoice"
// button (with no employee/project/customer scoping) and its Invoice
// Alerts bell already use, just as its own page instead of requiring a
// trip through Invoice Details first. No month is passed, so
// GenerateInvoiceDetails shows the full not-yet-invoiced backlog across
// every period through today, not just the current month.
const UnsubmittedInvoices = () => {
  const [employeeIds, setEmployeeIds] = useState(null); // null = still loading

  useEffect(() => {
    Promise.all([
      axios.get(API_ENDPOINTS.getProjects).then((response) => response.data || []),
      axios.get(API_ENDPOINTS.getAllEmployees).then((response) => response.data || []),
    ])
      .then(([projects, employees]) => {
        // Referral-company employees aren't run through invoicing — same
        // exclusion InvoiceDetails.jsx applies to its own Invoice Alerts.
        const referralIds = new Set(
          employees
            .filter((emp) => (emp.companyName || "").trim().toLowerCase() === "referral")
            .map((emp) => emp.employeeId),
        );
        const ids = Array.from(
          new Set(
            projects
              .map((p) => p.employeeId)
              .filter(Boolean)
              .filter((id) => !referralIds.has(id)),
          ),
        );
        setEmployeeIds(ids);
      })
      .catch((error) => {
        console.error("Error loading employees for Unsubmitted Invoices:", error);
        setEmployeeIds([]);
      });
  }, []);

  if (employeeIds === null) {
    return <div style={{ padding: 16 }}>Loading...</div>;
  }

  return <GenerateInvoiceDetails employeeIds={employeeIds} />;
};

export default UnsubmittedInvoices;
