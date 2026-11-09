import { useEffect, useMemo, useRef, useState } from "react";
import { AgGridReact } from "@ag-grid-community/react";
import { Button, Tag } from "antd";
import { ReloadOutlined, FileExcelOutlined } from "@ant-design/icons";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "ag-grid-enterprise";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import API_ENDPOINTS from "../config";
import { sizeColumnsForHeader } from "../Utils/agGridColumnSizing";
import { getCellCopyContextMenuItems, gridPopupParent } from "../Utils/agGridCellCopy";
import GridToolbar from "../Utils/GridToolbar";

const STATUS_COLOR = { Draft: "default", Submitted: "gold", Rejected: "red", Approved: "green", "No Timesheet": "default" };
const COMPARISON_COLOR = { Matched: "green", "No Invoice Yet": "red", "Hours Mismatch": "orange" };

// "By Invoice Frequency" tab on the Timesheets page — one row per
// (employee, assignment, invoice period), bucketed by each project's own
// invoice frequency (Weekly/Biweekly/Monthly/Semi-Monthly/...) instead of a
// calendar month, with the matching Invoice (if any) attached so timesheet
// hours and invoiced hours can be compared period-by-period.
export default function TimesheetInvoiceFrequencyReport() {
  const navigate = useNavigate();
  const gridRef = useRef(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");

  // Same route-state pre-selection TimesheetsGrid.jsx/UnsubmittedTimesheets.jsx
  // already use to jump into TimesheetEntry.jsx for one employee/assignment/
  // month at a time.
  const openEntry = (row) => {
    // No assignmentId on these rows (the report is Project/work-order
    // scoped, not Assignment-scoped) — TimesheetEntry.jsx falls back to
    // matching by projectId when assignmentId is absent.
    navigate("/timesheets/entry", {
      state: { employeeId: row.employeeId, projectId: row.projectId, yearMonth: row.yearMonth },
    });
  };

  const onBtnExportDataAsExcel = () => {
    if (gridRef.current) gridRef.current.exportDataAsExcel({ fileName: "timesheets-by-invoice-frequency.xlsx" });
  };

  const fetchData = () => {
    setLoading(true);
    axios
      .get(API_ENDPOINTS.getTimesheetsByInvoiceFrequency)
      .then((response) => setRows(response.data || []))
      .catch((error) => console.error("Error fetching timesheet/invoice frequency comparison:", error))
      .finally(() => setLoading(false));
  };

  useEffect(fetchData, []);

  const columnDefs = useMemo(
    () => [
    {
      colId: "rowNum",
      headerName: "#",
      valueGetter: (p) => p.node.rowIndex + 1,
      width: 70,
      minWidth: 70,
      maxWidth: 70,
      pinned: "left",
      lockPosition: true,
      suppressMovable: true,
      sortable: false,
      filter: false,
      editable: false,
      suppressSizeToFit: true,
      cellStyle: { textAlign: "center", fontWeight: 500 },
    },
    { field: "employeeName", headerName: "Employee", pinned: "left", filter: "agSetColumnFilter", valueGetter: (params) => params.data?.employeeName },
    { field: "projectName", headerName: "Project", filter: "agSetColumnFilter", valueGetter: (params) => params.data?.projectName },
    { field: "invoiceFrequency", headerName: "Invoice Frequency", filter: "agSetColumnFilter", valueGetter: (params) => params.data?.invoiceFrequency },
    { field: "periodStart", headerName: "Period Start", filter: "agDateColumnFilter" },
    { field: "periodEnd", headerName: "Period End", filter: "agDateColumnFilter" },
    { field: "timesheetHours", headerName: "Timesheet Hours", filter: "agNumberColumnFilter" },
    {
      field: "timesheetStatus",
      headerName: "Timesheet Status",
      filter: "agSetColumnFilter",
      valueGetter: (params) => params.data?.timesheetStatus,
      cellRenderer: (p) => (
        <Tag color={STATUS_COLOR[p.value]} style={{ cursor: "pointer" }} onClick={() => openEntry(p.data)}>
          {p.value}
        </Tag>
      ),
    },
    { field: "invoiceNumber", headerName: "Invoice #", filter: "agSetColumnFilter", valueGetter: (params) => params.data?.invoiceNumber },
    { field: "invoicedHours", headerName: "Invoiced Hours", filter: "agNumberColumnFilter" },
    { field: "invoiceStatus", headerName: "Invoice Status", filter: "agSetColumnFilter", valueGetter: (params) => params.data?.invoiceStatus },
    { field: "variance", headerName: "Variance", filter: "agNumberColumnFilter" },
    {
      field: "comparisonStatus",
      headerName: "Comparison",
      filter: "agSetColumnFilter",
      valueGetter: (params) => params.data?.comparisonStatus,
      cellRenderer: (p) => <Tag color={COMPARISON_COLOR[p.value]}>{p.value}</Tag>,
    },
    ],
    [openEntry],
  );

  // sizeColumnsForHeader returns a brand-new array/objects every call; memoize
  // it so AG Grid doesn't see a new columnDefs reference (and reset each
  // column's applied filter) on every re-render.
  const sizedColumnDefs = useMemo(() => sizeColumnsForHeader(columnDefs), [columnDefs]);

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div className="ag-theme-alpine project-List-grid">
        <GridToolbar className="workforce-search-container">
          <Button type="default" icon={<ReloadOutlined />} onClick={fetchData} loading={loading} style={{ marginRight: "10px" }}>
            Refresh
          </Button>
          <input
            type="text"
            placeholder="Search..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ marginRight: "10px" }}
          />
          <Button type="default" icon={<FileExcelOutlined />} onClick={onBtnExportDataAsExcel}>
            Export to Excel
          </Button>
        </GridToolbar>
        <div className="project-grid-wrapper">
          <AgGridReact
            ref={gridRef}
            rowData={rows}
            quickFilterText={searchText}
            columnDefs={sizedColumnDefs}
            defaultColDef={{ minWidth: 100, resizable: true, filter: "agSetColumnFilter" }}
            domLayout="normal"
            animateRows={true}
            pagination={true}
            paginationPageSize={100}
            paginationPageSizeSelector={[20, 50, 100]}
            loading={loading}
            getContextMenuItems={getCellCopyContextMenuItems}
            popupParent={gridPopupParent}
            overlayNoRowsTemplate="No completed invoice periods yet"
          />
        </div>
      </div>
    </div>
  );
}
