import React, { useState, useEffect, useMemo, useRef } from "react";
import { AgGridReact } from "@ag-grid-community/react";
import { Card, Select, Tag, Tooltip, Button, Empty } from "antd";
import { WarningFilled, CheckCircleFilled, ReloadOutlined } from "@ant-design/icons";
import axios from "axios";
import dayjs from "dayjs";
import API_ENDPOINTS from "../config";
import { sizeColumnsForHeader } from "../Utils/agGridColumnSizing";
import "ag-grid-enterprise";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import { getCellCopyContextMenuItems } from "../Utils/agGridCellCopy";

// Cross-references the three places this app records an employee's hours
// independently for a given payroll pay period — PayrollSummary (what they
// were paid for), TimeSheet (what they logged), and Bills (what was
// invoiced to the client, prorated from its own billing window onto this
// pay period — see HoursReportController) — and flags Payroll vs Timesheet
// pairs that disagree by more than an hour (Invoiced Hours is shown for
// reference only; it's an estimate, not part of the discrepancy check).
// Mirrors MonthlyTimesheets' employee picker (default = every employee),
// but the period picker is real payroll pay periods rather than a calendar
// month, since that's the boundary PayrollSummary and TimeSheet both need
// to be sliced against consistently.
const HOURS_FIELDS = [
  { field: "payrollHours", headerName: "Payroll Hours" },
  { field: "timesheetHours", headerName: "Timesheet Hours" },
  { field: "invoicedHours", headerName: "Invoiced Hours (Est.)" },
];

const round1 = (n) => Math.round((n || 0) * 10) / 10;

const DiscrepancyCell = (params) => {
  const row = params.data;
  if (!row) return null;
  if (!row.hasDiscrepancy) {
    return (
      <Tooltip title="Payroll and Timesheet hours agree within 1 hour">
        <CheckCircleFilled style={{ color: "#389e0d" }} />
      </Tooltip>
    );
  }
  return (
    <Tooltip title={row.discrepancyDetail}>
      <Tag icon={<WarningFilled />} color="error">
        Discrepancy
      </Tag>
    </Tooltip>
  );
};

const HoursReport = () => {
  const gridRef = useRef(null);
  const [employees, setEmployees] = useState([]);
  const [payPeriods, setPayPeriods] = useState([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null);
  const [selectedPayPeriodId, setSelectedPayPeriodId] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    axios
      .get(API_ENDPOINTS.getAllEmployees)
      .then((res) => setEmployees(res.data || []))
      .catch((err) => console.error("Error fetching employees:", err));

    fetchPayPeriods();
  }, []);

  const fetchPayPeriods = () => {
    axios
      .get(API_ENDPOINTS.getPayPeriods)
      .then((res) => {
        const sorted = (res.data || []).slice().sort((a, b) => (a.startDate < b.startDate ? 1 : -1));
        setPayPeriods(sorted);
        // Default to the most recent pay period so the report shows
        // something useful immediately, rather than starting blank.
        setSelectedPayPeriodId((prev) => prev ?? (sorted.length > 0 ? sorted[0].payPeriodId : null));
      })
      .catch((err) => console.error("Error fetching pay periods:", err));
  };

  const employeeOptions = useMemo(
    () =>
      employees
        .map((e) => ({ value: e.employeeId, label: `${e.firstName} ${e.lastName}` }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [employees],
  );

  const payPeriodOptions = useMemo(
    () =>
      payPeriods.map((p) => ({
        value: p.payPeriodId,
        label: `${dayjs(p.startDate).format("MMM D")} - ${dayjs(p.endDate).format("MMM D, YYYY")}`,
      })),
    [payPeriods],
  );

  const fetchReport = () => {
    if (!selectedPayPeriodId) {
      setRows([]);
      return;
    }
    setLoading(true);
    axios
      .get(API_ENDPOINTS.getHoursReport(selectedPayPeriodId, selectedEmployeeId))
      .then((res) => {
        // Hide employees with zero activity across all three sources this
        // period — nothing to reconcile, just noise in a report meant to
        // surface real discrepancies.
        const withActivity = (res.data || []).filter(
          (r) => (r.payrollHours || 0) !== 0 || (r.timesheetHours || 0) !== 0 || (r.invoicedHours || 0) !== 0,
        );
        setRows(withActivity);
      })
      .catch((err) => {
        console.error("Error fetching hours report:", err);
        setRows([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(fetchReport, [selectedPayPeriodId, selectedEmployeeId]);

  const columnDefs = useMemo(
    () =>
      sizeColumnsForHeader([
        { headerName: "Employee", field: "employeeName", minWidth: 180, valueGetter: (params) => params.data?.employeeName },
        ...HOURS_FIELDS.map(({ field, headerName }) => ({
          headerName,
          field,
          valueFormatter: (params) => round1(params.value),
          cellStyle: { textAlign: "right" },
          valueGetter: (params) => params.data?.[field],
          filterParams: { valueFormatter: (params) => round1(params.value) },
        })),
        {
          headerName: "Discrepancy",
          colId: "discrepancy",
          sortable: false,
          filter: false,
          cellRenderer: DiscrepancyCell,
        },
      ]),
    [],
  );

  const selectedPeriod = payPeriods.find((p) => p.payPeriodId === selectedPayPeriodId);
  const discrepancyCount = rows.filter((r) => r.hasDiscrepancy).length;

  return (
    <div style={{ padding: 16, height: "100%", display: "flex", flexDirection: "column" }}>
      <Card style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <Button icon={<ReloadOutlined />} onClick={fetchReport}>
            Refresh
          </Button>
          <Select
            showSearch
            allowClear
            style={{ width: 220 }}
            placeholder="All employees"
            value={selectedEmployeeId}
            onChange={setSelectedEmployeeId}
            options={employeeOptions}
            optionFilterProp="label"
          />
          <Select
            showSearch
            style={{ width: 260 }}
            placeholder="Pick a pay period"
            value={selectedPayPeriodId}
            onChange={setSelectedPayPeriodId}
            options={payPeriodOptions}
            optionFilterProp="label"
          />
          {selectedPeriod && <Tag>Pay date: {dayjs(selectedPeriod.payDate).format("MMM D, YYYY")}</Tag>}
          {rows.length > 0 && (
            <Tag color={discrepancyCount > 0 ? "error" : "success"}>
              {discrepancyCount} of {rows.length} with a discrepancy
            </Tag>
          )}
          <div style={{ fontSize: 12, color: "#888" }}>
            Discrepancy is flagged when Payroll Hours and Timesheet Hours differ by more than 1 hour — both are
            exact, independently-recorded figures. Invoiced Hours is shown for reference only: it's prorated
            from each bill's own billing window onto this pay period's date range, so it's an estimate and
            isn't included in the discrepancy check. Employees with zero hours across all three sources this
            period are hidden.
          </div>
        </div>
      </Card>

      <div className="ag-theme-alpine" style={{ flex: 1, minHeight: 0 }}>
        {rows.length === 0 && !loading ? (
          <Card>
            <Empty description={selectedPayPeriodId ? "No activity for this selection" : "Pick a pay period to get started"} />
          </Card>
        ) : (
          <AgGridReact
            getContextMenuItems={getCellCopyContextMenuItems}
            enableCellTextSelection={true}
            ensureDomOrder={true}
            ref={gridRef}
            rowData={rows}
            loading={loading}
            columnDefs={columnDefs}
            defaultColDef={{ minWidth: 100, resizable: true, sortable: true, filter: "agSetColumnFilter" }}
            rowHeight={48}
            getRowStyle={(params) => (params.data?.hasDiscrepancy ? { background: "#fff1f0" } : null)}
            pagination={true}
            paginationPageSize={100}
            paginationPageSizeSelector={[20, 50, 100]}
            domLayout="normal"
            popupParent={document.body}
          />
        )}
      </div>
    </div>
  );
};

export default HoursReport;
