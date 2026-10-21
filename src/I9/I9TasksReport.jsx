import { useEffect, useState } from "react";
import { AgGridReact } from "@ag-grid-community/react";
import { Button, Tag } from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import axios from "axios";
import "ag-grid-enterprise";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import API_ENDPOINTS from "../config";
import { formatDateMDY } from "../Utils/dateFormat";
import { sizeColumnsForHeader } from "../Utils/agGridColumnSizing";
import GridToolbar from "../Utils/GridToolbar";

const PRIORITY_COLOR = { HIGH: "error", MEDIUM: "warning", LOW: "default" };

// Every open I-9 compliance task (spec section 8) across every employee —
// read-only; there is no generic Task/notification dashboard anywhere
// else in this app (see i9-rules.md), and a daily High-priority digest of
// the same data already goes to HR/IMMIGRATION via
// NotificationService#checkI9Compliance. This grid is the full picture,
// not just High priority.
export default function I9TasksReport() {
  const [tasks, setTasks] = useState([]);
  const [employeesById, setEmployeesById] = useState({});
  const [loading, setLoading] = useState(false);

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      axios.get(API_ENDPOINTS.getI9Tasks).then((res) => res.data || []),
      axios.get(API_ENDPOINTS.getAllEmployees).then((res) => res.data || []),
    ])
      .then(([taskData, employees]) => {
        setTasks(taskData);
        setEmployeesById(Object.fromEntries(employees.map((e) => [e.employeeId, e])));
      })
      .finally(() => setLoading(false));
  };

  useEffect(fetchData, []);

  const rowData = tasks.map((t) => {
    const emp = employeesById[t.employeeId];
    return {
      ...t,
      employeeName: emp ? `${emp.firstName || ""} ${emp.lastName || ""}`.trim() : `Employee #${t.employeeId}`,
    };
  });

  const columnDefs = [
    { field: "employeeName", headerName: "Employee", pinned: "left", filter: "agSetColumnFilter" },
    { field: "label", headerName: "Task", filter: "agSetColumnFilter" },
    {
      field: "priority",
      headerName: "Priority",
      filter: "agSetColumnFilter",
      cellRenderer: (p) => <Tag color={PRIORITY_COLOR[p.value] || "default"}>{p.value}</Tag>,
    },
    { field: "due", headerName: "Due", filter: "agSetColumnFilter", valueFormatter: (p) => formatDateMDY(p.value) },
    { field: "whereToFix", headerName: "Where to fix", filter: "agSetColumnFilter" },
  ];

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div className="ag-theme-alpine project-List-grid">
        <GridToolbar className="workforce-search-container">
          <Button type="default" icon={<ReloadOutlined />} onClick={fetchData} loading={loading} style={{ marginRight: "10px" }}>
            Refresh
          </Button>
        </GridToolbar>
        <div className="project-grid-wrapper">
          <AgGridReact
            rowData={rowData}
            columnDefs={sizeColumnsForHeader(columnDefs)}
            defaultColDef={{ minWidth: 100, resizable: true, filter: "agSetColumnFilter" }}
            domLayout="normal"
            animateRows={true}
            pagination={true}
            paginationPageSize={100}
            paginationPageSizeSelector={[20, 50, 100]}
            loading={loading}
            overlayNoRowsTemplate="No open I-9 compliance tasks"
          />
        </div>
      </div>
    </div>
  );
}
