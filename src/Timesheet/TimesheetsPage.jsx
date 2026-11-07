import { Tabs } from "antd";
import TimesheetsGrid from "./TimesheetsGrid";
import TimesheetInvoiceFrequencyReport from "./TimesheetInvoiceFrequencyReport";
import "./TimesheetsPage.css";

// /timesheets landing page — a tab for the existing Timesheets grid
// (unchanged) plus a new "By Invoice Frequency" tab that buckets the same
// timesheet data by each project's actual invoice frequency instead of a
// calendar month, for comparing against Invoices.
export default function TimesheetsPage() {
  const items = [
    { key: "all", label: "Timesheets", children: <TimesheetsGrid /> },
    { key: "byInvoiceFrequency", label: "By Invoice Frequency", children: <TimesheetInvoiceFrequencyReport /> },
  ];

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <Tabs className="timesheets-page-tabs" defaultActiveKey="all" items={items} destroyInactiveTabPane />
    </div>
  );
}
