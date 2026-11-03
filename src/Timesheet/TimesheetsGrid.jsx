import { useEffect, useState } from "react";
import { AgGridReact } from "@ag-grid-community/react";
import { Button, Tag } from "antd";
import { PlusOutlined, ReloadOutlined } from "@ant-design/icons";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "ag-grid-enterprise";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import API_ENDPOINTS from "../config";
import { formatDateMDY } from "../Utils/dateFormat";
import { sizeColumnsForHeader } from "../Utils/agGridColumnSizing";
import GridToolbar from "../Utils/GridToolbar";

const STATUS_COLOR = { Draft: "default", Submitted: "gold", Rejected: "red", Approved: "green" };

// Landing view of the Timesheets page — one row per employee/project/month
// across every timesheet ever entered. "Add New Timesheet" and clicking a
// row both open TimesheetEntry.jsx (the day-by-day entry grid, at
// /timesheets/entry), the latter pre-filled via the same route-state
// pre-selection mechanism GenerateInvoiceDetails' "Timesheet" link already
// uses.
export default function TimesheetsGrid() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchData = () => {
    setLoading(true);
    axios
      .get(API_ENDPOINTS.getTimesheetSummary)
      .then((response) => setRows(response.data || []))
      .catch((error) => console.error("Error fetching timesheet summary:", error))
      .finally(() => setLoading(false));
  };

  useEffect(fetchData, []);

  const openEntry = (row) => {
    navigate("/timesheets/entry", {
      state: row
        ? { employeeId: row.employeeId, assignmentId: row.assignmentId, yearMonth: row.yearMonth }
        : undefined,
    });
  };

  const columnDefs = [
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
    { field: "employeeName", headerName: "Employee", pinned: "left", filter: "agSetColumnFilter" },
    { field: "employeeId", headerName: "Employee ID", filter: "agSetColumnFilter" },
    { field: "employeeEmail", headerName: "Employee Email", filter: "agSetColumnFilter" },
    { field: "projectName", headerName: "Project", filter: "agSetColumnFilter" },
    { field: "yearMonth", headerName: "Month", filter: "agSetColumnFilter" },
    { field: "totalHours", headerName: "Total Hours", filter: "agNumberColumnFilter" },
    {
      field: "status",
      headerName: "Status",
      filter: "agSetColumnFilter",
      cellRenderer: (p) => <Tag color={STATUS_COLOR[p.value]}>{p.value}</Tag>,
    },
    {
      field: "lastUpdated",
      headerName: "Last Updated",
      filter: "agDateColumnFilter",
      valueFormatter: (p) => formatDateMDY(p.value),
      sort: "desc",
    },
  ];

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div className="ag-theme-alpine project-List-grid">
        <GridToolbar className="workforce-search-container">
          <Button type="default" icon={<ReloadOutlined />} onClick={fetchData} loading={loading} style={{ marginRight: "10px" }}>
            Refresh
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openEntry(null)}>
            Add New Timesheet
          </Button>
        </GridToolbar>
        <div className="project-grid-wrapper">
          <AgGridReact
            rowData={rows}
            columnDefs={sizeColumnsForHeader(columnDefs)}
            defaultColDef={{ minWidth: 100, resizable: true, filter: "agSetColumnFilter" }}
            domLayout="normal"
            animateRows={true}
            pagination={true}
            paginationPageSize={100}
            paginationPageSizeSelector={[20, 50, 100]}
            loading={loading}
            onRowClicked={(e) => openEntry(e.data)}
            rowStyle={{ cursor: "pointer" }}
            overlayNoRowsTemplate="No timesheets entered yet"
          />
        </div>
      </div>
    </div>
  );
}
