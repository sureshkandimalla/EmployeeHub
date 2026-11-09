import React, { useState, useEffect, useMemo, useRef } from "react";
import { AgGridReact } from "@ag-grid-community/react";
import { Card, Select, Button, Tag, Tooltip, Input } from "antd";
import { ReloadOutlined, DownloadOutlined } from "@ant-design/icons";
import axios from "axios";
import API_ENDPOINTS from "../config";
import { formatCurrency } from "../Utils/CurrencyFormatter";
import { formatDate } from "../Utils/dateFormat";
import { sizeColumnsForHeader } from "../Utils/agGridColumnSizing";
import { useFilteredTotalsRow } from "../Utils/useFilteredTotalsRow";
import "ag-grid-enterprise";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import { getCellCopyContextMenuItems } from "../Utils/agGridCellCopy";

const { Option } = Select;

// For a selected Pay Period, lists everyone eligible for payroll — every
// assignment whose own active window overlaps that period at all (not
// "currently active"; a pay period is frequently in the past) — with hours
// pulled from already-logged timesheets for that period. Read-only: this
// is a cross-check/preview, not where PayrollSummary records get created
// (those still come from the provider's payroll export, via Payroll
// Summary's existing CSV/XLSX import).
const PayrollEligibility = () => {
  const gridRef = useRef(null);
  const [payPeriods, setPayPeriods] = useState([]);
  const [selectedPayPeriodId, setSelectedPayPeriodId] = useState(null);
  const [rowData, setRowData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");

  useEffect(() => {
    axios
      .get(API_ENDPOINTS.getPayPeriods)
      .then((response) => {
        const periods = (response.data || []).sort((a, b) => (b.payDate || "").localeCompare(a.payDate || ""));
        setPayPeriods(periods);

        const today = new Date().toISOString().slice(0, 10);
        const byPayDateAsc = [...periods].sort((a, b) => (a.payDate || "").localeCompare(b.payDate || ""));
        const upcoming = byPayDateAsc.find((p) => p.payDate >= today);
        const defaultPeriod = upcoming || byPayDateAsc[byPayDateAsc.length - 1];
        if (defaultPeriod) setSelectedPayPeriodId(defaultPeriod.payPeriodId);
      })
      .catch((error) => console.error("Error fetching pay periods:", error));
  }, []);

  const selectedPayPeriod = useMemo(
    () => payPeriods.find((p) => p.payPeriodId === selectedPayPeriodId),
    [payPeriods, selectedPayPeriodId],
  );

  useEffect(() => {
    if (selectedPayPeriod) fetchEligibility();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPayPeriod]);

  const fetchEligibility = () => {
    const { payPeriodId, startDate, endDate, payDate } = selectedPayPeriod;
    const today = new Date().toISOString().slice(0, 10);
    const isPastPeriod = payDate && payDate < today;
    setLoading(true);

    const requests = [
      axios.get(API_ENDPOINTS.getAssignmentsEligibleForPeriod(startDate, endDate)),
      axios.get(API_ENDPOINTS.getTimesheetsByRange(startDate, endDate)),
    ];
    if (isPastPeriod) {
      requests.push(axios.get(API_ENDPOINTS.getPayrollSummaryByPayPeriod(payPeriodId)));
    }

    Promise.all(requests)
      .then(([assignmentsResponse, timesheetsResponse, payrollSummaryResponse]) => {
        const assignments = assignmentsResponse.data || [];
        const entries = timesheetsResponse.data || [];

        const hoursByAssignment = {};
        entries.forEach((e) => {
          hoursByAssignment[e.assignmentId] = (hoursByAssignment[e.assignmentId] || 0) + (e.hours || 0);
        });

        // PayrollSummary records are one-per-employee for the pay period (not
        // one-per-project), so the actual/gross figures get attached to only
        // the first row for that employee below — otherwise an employee with
        // concurrent assignments would have their actual pay double-counted
        // in the totals row.
        const actualByEmployee = {};
        (payrollSummaryResponse?.data || []).forEach((ps) => {
          if (!ps.employeeId) return;
          const existing = actualByEmployee[ps.employeeId] || {
            hours: 0,
            grossAmount: 0,
            employerContribution: 0,
            paymentType: null,
          };
          existing.hours += ps.hours || 0;
          existing.grossAmount += ps.totalPaid || 0;
          existing.employerContribution += ps.employerLiability || 0;
          existing.paymentType = existing.paymentType || ps.paymentDetails || null;
          actualByEmployee[ps.employeeId] = existing;
        });

        const employeeIdsWithActualAssigned = new Set();
        const rows = assignments.map((a) => {
          const row = {
            assignmentId: a.assignmentId,
            employeeId: a.employeeId,
            employeeName: a.employeeName,
            employeeType: a.employeeType,
            taxTerm: a.taxTerm,
            companyName: a.companyName,
            projectName: a.projectName,
            customerName: a.customerName,
            assignmentStartDate: a.startDate,
            assignmentEndDate: a.endDate,
            wage: a.wage,
            hours: hoursByAssignment[a.assignmentId] || 0,
          };
          if (isPastPeriod) {
            const actual = actualByEmployee[a.employeeId];
            if (actual && !employeeIdsWithActualAssigned.has(a.employeeId)) {
              row.actualHours = actual.hours;
              row.grossAmount = actual.grossAmount;
              row.employerContribution = actual.employerContribution;
              row.paymentType = actual.paymentType;
              employeeIdsWithActualAssigned.add(a.employeeId);
            }
          }
          return row;
        });
        rows.sort((r1, r2) => r1.employeeName.localeCompare(r2.employeeName));
        setRowData(rows);
      })
      .catch((error) => console.error("Error fetching payroll eligibility:", error))
      .finally(() => setLoading(false));
  };

  const columnDefs = useMemo(
    () => [
      {
        colId: "rowNum",
        headerName: "#",
        valueGetter: (params) => (params.node.rowPinned ? "" : params.node.rowIndex + 1),
        width: 120,
        minWidth: 120,
        maxWidth: 120,
        pinned: "left",
        lockPosition: true,
        suppressMovable: true,
        sortable: false,
        filter: false,
        editable: false,
        suppressSizeToFit: true,
        cellStyle: { textAlign: "center", fontWeight: 500 },
      },
      { headerName: "Employee", field: "employeeName", sortable: true, minWidth: 180, enableRowGroup: true, valueGetter: (params) => params.data?.employeeName },
      { headerName: "Employee Type", field: "employeeType", sortable: true, enableRowGroup: true, valueGetter: (params) => params.data?.employeeType },
      { headerName: "Tax Term", field: "taxTerm", sortable: true, enableRowGroup: true, valueGetter: (params) => params.data?.taxTerm },
      { headerName: "Company", field: "companyName", sortable: true, enableRowGroup: true, valueGetter: (params) => params.data?.companyName },
      { headerName: "Customer", field: "customerName", sortable: true, minWidth: 160, enableRowGroup: true, valueGetter: (params) => params.data?.customerName },
      {
        headerName: "Bill Rate",
        field: "wage",
        sortable: true,
        valueFormatter: (params) => formatCurrency(params.value),
        valueGetter: (params) => params.data?.wage,
        filterParams: { valueFormatter: (params) => formatCurrency(params.value) },
      },
      {
        headerName: "Actual Hrs",
        field: "hours",
        sortable: true,
        aggFunc: "sum",
        cellStyle: { fontWeight: "bold" },
        valueGetter: (params) => params.data?.hours,
      },
      {
        headerName: "Amount",
        colId: "amount",
        valueGetter: (params) =>
          params.node.rowPinned ? params.data.amount : (params.data.wage || 0) * (params.data.hours || 0),
        sortable: true,
        aggFunc: "sum",
        valueFormatter: (params) => (params.value != null ? formatCurrency(params.value) : ""),
      },
      {
        headerName: "Payroll Hrs",
        field: "actualHours",
        sortable: true,
        aggFunc: "sum",
        valueGetter: (params) => params.data?.actualHours,
      },
      {
        headerName: "Payroll Amount",
        field: "grossAmount",
        sortable: true,
        aggFunc: "sum",
        minWidth: 150,
        valueFormatter: (params) => (params.value != null ? formatCurrency(params.value) : ""),
        valueGetter: (params) => params.data?.grossAmount,
        filterParams: { valueFormatter: (params) => (params.value != null ? formatCurrency(params.value) : "") },
      },
      {
        headerName: "Employer Contribution",
        field: "employerContribution",
        sortable: true,
        aggFunc: "sum",
        minWidth: 170,
        valueFormatter: (params) => (params.value != null ? formatCurrency(params.value) : ""),
        valueGetter: (params) => params.data?.employerContribution,
        filterParams: { valueFormatter: (params) => (params.value != null ? formatCurrency(params.value) : "") },
      },
      {
        headerName: "Payment Type",
        field: "paymentType",
        sortable: true,
        minWidth: 130,
        valueGetter: (params) => params.data?.paymentType,
      },
      {
        headerName: "Assignment Start",
        field: "assignmentStartDate",
        sortable: true,
        valueFormatter: (params) => formatDate(params.value),
        valueGetter: (params) => params.data?.assignmentStartDate,
        filterParams: { treeList: false, valueFormatter: (params) => formatDate(params.value) },
      },
      {
        headerName: "Assignment End",
        field: "assignmentEndDate",
        sortable: true,
        valueFormatter: (params) => formatDate(params.value),
        valueGetter: (params) => params.data?.assignmentEndDate,
        filterParams: { treeList: false, valueFormatter: (params) => formatDate(params.value) },
      },
    ],
    [],
  );

  // sizeColumnsForHeader returns a brand-new array/objects every call; memoize
  // it so AG Grid doesn't see a new columnDefs reference (and reset each
  // column's applied filter) on every re-render — including the one
  // setPinnedTopRowData triggers on every filter change via onModelUpdated.
  const sizedColumnDefs = useMemo(() => sizeColumnsForHeader(columnDefs), [columnDefs]);

  const filteredRowData = useMemo(() => {
    if (!searchText) return rowData;
    return rowData.filter((row) =>
      Object.values(row).some((value) => String(value).toLowerCase().includes(searchText.toLowerCase())),
    );
  }, [rowData, searchText]);

  const sumEligibilityRows = (rows, label) => ({
    employeeName: label,
    hours: rows.reduce((sum, row) => sum + (row.hours || 0), 0),
    amount: rows.reduce((sum, row) => sum + (row.wage || 0) * (row.hours || 0), 0),
    actualHours: rows.reduce((sum, row) => sum + (row.actualHours || 0), 0),
    grossAmount: rows.reduce((sum, row) => sum + (row.grossAmount || 0), 0),
    employerContribution: rows.reduce((sum, row) => sum + (row.employerContribution || 0), 0),
  });

  // Bottom row: grand total for the selected pay period, regardless of the
  // search box or any AG Grid column filter.
  const pinnedBottomRowData = useMemo(
    () => (rowData.length > 0 ? [sumEligibilityRows(rowData, "Total")] : []),
    [rowData],
  );

  // Top row: same totals, but only over rows currently passing both the
  // search box and every AG Grid column filter.
  const { pinnedTopRowData, onModelUpdated } = useFilteredTotalsRow((rows) =>
    sumEligibilityRows(rows, "Filtered Total"),
  );

  const getRowStyle = (params) => {
    if (params.node.rowPinned) {
      return { backgroundColor: "#d3f4ff", fontWeight: "bold" };
    }
    return null;
  };

  const handleExport = () => {
    if (gridRef.current?.api) {
      gridRef.current.api.exportDataAsExcel({ fileName: "payroll_eligibility.xlsx" });
    }
  };

  return (
    <div style={{ padding: 16, height: "100%", display: "flex", flexDirection: "column" }}>
      <Card style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ minWidth: 200 }}>
            <div style={{ marginBottom: 4 }}>Pay Date</div>
            <Tooltip title="Everyone whose assignment overlaps the selected pay period at all, with hours summed from whatever's already been logged in Timesheets for that date range. This is a preview only — it doesn't create or save Payroll Summary records.">
              <Select
                showSearch
                style={{ width: "100%" }}
                placeholder="Select pay date"
                value={selectedPayPeriodId}
                onChange={setSelectedPayPeriodId}
                optionFilterProp="children"
                filterOption={(input, option) => (option.children || "").toLowerCase().includes(input.toLowerCase())}
              >
                {payPeriods.map((p) => (
                  <Option key={p.payPeriodId} value={p.payPeriodId}>
                    {formatDate(p.payDate)}
                  </Option>
                ))}
              </Select>
            </Tooltip>
          </div>
          {selectedPayPeriod && (
            <>
              <div>
                <div style={{ marginBottom: 4, color: "#888" }}>Payroll Start</div>
                <Tag style={{ fontSize: 13, padding: "4px 10px" }}>{formatDate(selectedPayPeriod.startDate)}</Tag>
              </div>
              <div>
                <div style={{ marginBottom: 4, color: "#888" }}>Payroll End</div>
                <Tag style={{ fontSize: 13, padding: "4px 10px" }}>{formatDate(selectedPayPeriod.endDate)}</Tag>
              </div>
            </>
          )}
          <Input
            placeholder="Search..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 220, marginTop: 20 }}
            allowClear
          />
          <Button icon={<ReloadOutlined />} onClick={fetchEligibility} disabled={!selectedPayPeriod} style={{ marginTop: 20 }}>
            Refresh
          </Button>
          <Button icon={<DownloadOutlined />} onClick={handleExport} disabled={rowData.length === 0} style={{ marginTop: 20 }}>
            Export Excel
          </Button>
        </div>
      </Card>

      <div className="ag-theme-alpine" style={{ flex: 1, minHeight: 0 }}>
        <AgGridReact
          getContextMenuItems={getCellCopyContextMenuItems}
          enableCellTextSelection={true}
          ensureDomOrder={true}
          ref={gridRef}
          rowData={filteredRowData}
          columnDefs={sizedColumnDefs}
          onModelUpdated={onModelUpdated}
          pinnedTopRowData={pinnedTopRowData}
          pinnedBottomRowData={pinnedBottomRowData}
          loading={loading}
          defaultColDef={{ resizable: true, filter: "agSetColumnFilter", enableRowGroup: true }}
          rowGroupPanelShow="always"
          domLayout="normal"
          pagination
          paginationPageSize={100}
          paginationPageSizeSelector={[100, 200, 300]}
          getRowStyle={getRowStyle}
          sideBar={{
            toolPanels: [
              {
                id: "columns",
                labelDefault: "Columns",
                labelKey: "columns",
                iconKey: "columns",
                toolPanel: "agColumnsToolPanel",
                toolPanelParams: {
                  suppressRowGroups: false,
                  suppressValues: true,
                  suppressPivots: false,
                  suppressPivotMode: true,
                  suppressColumnFilter: true,
                  suppressColumnSelectAll: true,
                  suppressColumnExpandAll: true,
                },
              },
            ],
          }}
          popupParent={document.body}
        />
      </div>
    </div>
  );
};

export default PayrollEligibility;
