import { useEffect, useState } from "react";
import { AgGridReact } from "@ag-grid-community/react";
import { Button } from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import axios from "axios";
import "ag-grid-enterprise";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import API_ENDPOINTS from "../config";
import { formatCurrency } from "../Utils/CurrencyFormatter";
import { formatDateMDY, formatMonthYear } from "../Utils/dateFormat";
import { sizeColumnsForHeader } from "../Utils/agGridColumnSizing";
import GridToolbar from "../Utils/GridToolbar";

// Three independent checks on how Bills stay in sync with the Invoice they
// were generated from (see InvoiceService's bill-sync logic): a bill whose
// invoiceId is missing or points at an invoice that no longer exists, an
// invoice with no bill referencing it at all, and an invoice/bill pair
// whose hours disagree (e.g. an invoice hand-edited after its bills were
// already created). Backed by GET /api/v1/reports/billing-integrity
// (ADMIN/ACCOUNTING only), which does the cross-referencing server-side.
const gridDefaults = {
  domLayout: "autoHeight",
  defaultColDef: { minWidth: 100, resizable: true, filter: "agSetColumnFilter" },
  enableCellTextSelection: true,
  animateRows: true,
};

function ReportSection({ title, emptyLabel, rowData, columnDefs }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <h3 style={{ marginBottom: 8 }}>
        {title} ({rowData.length})
      </h3>
      {rowData.length === 0 ? (
        <div style={{ color: "#666", fontStyle: "italic", padding: "8px 0" }}>{emptyLabel}</div>
      ) : (
        <div className="ag-theme-alpine">
          <AgGridReact
            {...gridDefaults}
            rowData={rowData}
            columnDefs={sizeColumnsForHeader(columnDefs)}
            onFirstDataRendered={(params) => {
              try {
                params.api.autoSizeAllColumns();
              } catch (e) {}
            }}
          />
        </div>
      )}
    </div>
  );
}

export default function BillingIntegrityReport() {
  const [report, setReport] = useState({
    billsWithoutInvoice: [],
    invoicesWithoutBills: [],
    hoursDiscrepancies: [],
  });
  const [loading, setLoading] = useState(false);

  const fetchData = () => {
    setLoading(true);
    axios
      .get(API_ENDPOINTS.billingIntegrityReport)
      .then(({ data }) => setReport(data || {}))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, []);

  const billsWithoutInvoiceColumns = [
    { field: "billId", headerName: "Bill Id" },
    { field: "employeeId", headerName: "Employee Id" },
    { field: "projectId", headerName: "Project Id" },
    { field: "invoiceId", headerName: "Invoice Id (dangling)" },
    { field: "hours", headerName: "Hours" },
    { field: "total", headerName: "Total", valueFormatter: (p) => formatCurrency(p.value) },
    { field: "billDate", headerName: "Bill Date", valueFormatter: (p) => formatDateMDY(p.value) },
    { field: "status", headerName: "Status" },
  ];

  const invoicesWithoutBillsColumns = [
    { field: "id", headerName: "Invoice Id" },
    { field: "invoiceNumber", headerName: "Invoice Number" },
    { field: "projectId", headerName: "Project Id" },
    { field: "invoiceMonth", headerName: "Invoice Month", valueFormatter: (p) => formatMonthYear(p.value) },
    { field: "hours", headerName: "Hours" },
    { field: "total", headerName: "Total", valueFormatter: (p) => formatCurrency(p.value) },
    { field: "status", headerName: "Status" },
  ];

  const hoursDiscrepancyColumns = [
    { field: "invoiceId", headerName: "Invoice Id" },
    { field: "invoiceNumber", headerName: "Invoice Number" },
    { field: "projectId", headerName: "Project Id" },
    { field: "invoiceHours", headerName: "Invoice Hours" },
    { field: "billedHours", headerName: "Billed Hours (sum of bills)" },
    {
      field: "difference",
      headerName: "Difference (Invoice - Billed)",
      cellStyle: (p) => (Math.abs(p.value) > 0.01 ? { color: "#c0392b", fontWeight: "bold" } : null),
    },
  ];

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "auto", padding: "0 4px" }}>
      <GridToolbar className="workforce-search-container">
        <Button type="default" icon={<ReloadOutlined />} onClick={fetchData} loading={loading} style={{ marginRight: "10px" }}>
          Refresh
        </Button>
      </GridToolbar>

      <ReportSection
        title="Bills Without a Valid Invoice"
        emptyLabel="Every bill has a valid invoice."
        rowData={report.billsWithoutInvoice || []}
        columnDefs={billsWithoutInvoiceColumns}
      />

      <ReportSection
        title="Invoices With No Bills"
        emptyLabel="Every invoice has at least one bill."
        rowData={report.invoicesWithoutBills || []}
        columnDefs={invoicesWithoutBillsColumns}
      />

      <ReportSection
        title="Invoice vs. Billed Hours Discrepancies"
        emptyLabel="Every invoice's hours match the sum of its bills' hours."
        rowData={report.hoursDiscrepancies || []}
        columnDefs={hoursDiscrepancyColumns}
      />
    </div>
  );
}
