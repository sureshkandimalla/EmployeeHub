import React, { useState, useEffect, useRef, useMemo } from "react";
import { AgGridReact } from "@ag-grid-community/react";
import { Button, Card } from "antd";
import { DownloadOutlined, ReloadOutlined } from "@ant-design/icons";
import axios from "axios";
import API_ENDPOINTS from "../config";
import { sizeColumnsForHeader } from "../Utils/agGridColumnSizing";
import "ag-grid-enterprise";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import { formatCurrency } from "../Utils/CurrencyFormatter";
import { formatDate } from "../Utils/dateFormat";
import { useFilteredTotalsRow } from "../Utils/useFilteredTotalsRow";
import { getCellCopyContextMenuItems } from "../Utils/agGridCellCopy";

const PayrollDetails = ({ rowData: externalRowData, onRefresh, employeeId, isCollapsed, gridHeight = "calc(100vh - 500px)" }) => {
  const [searchText, setSearchText] = useState("");
  const [internalRowData, setInternalRowData] = useState([]);
  const gridRef = useRef(null);

  const rowData = employeeId ? internalRowData : (externalRowData || []);

  useEffect(() => {
    if (employeeId) {
      fetchData();
    }
  }, [employeeId]);

  const fetchData = () => {
    axios
      .get(API_ENDPOINTS.getPayrollsForEmp(employeeId))
      .then((response) => setInternalRowData(response.data || []))
      .catch((error) => console.error("Error fetching payroll:", error));
  };

  const formatDateCell = (params) => formatDate(params.value);

  const columnDefs = useMemo(
    () => [
      {
        headerName: "Payroll Summary Id",
        field: "payrollSummaryId",
        sortable: true,
        minWidth: 160,
        hide: true,
        valueFormatter: (params) => params.value,
        valueGetter: (params) => params.data?.payrollSummaryId,
      },
      {
        headerName: "Employee Id",
        field: "employeeId",
        sortable: true,
        hide: true,
        valueGetter: (params) => params.data?.employeeId,
      },
      {
        headerName: "Employee Name",
        field: "employeeName",
        sortable: true,
        minWidth: 180,
        pinned: "left",
        enableRowGroup: true,
        valueGetter: (params) => params.data?.employeeName,
      },
      {
        headerName: "Year",
        field: "checkDate",
        colId: "checkYear",
        sortable: true,
        enableRowGroup: true,
        filter: "agSetColumnFilter",
        valueGetter: (params) =>
          params.data?.checkDate ? params.data.checkDate.substring(0, 4) : null,
        valueFormatter: (params) =>
          params.node.rowPinned ? "" : params.value,
      },
      {
        headerName: "Pay Check Date",
        field: "checkDate",
        // Distinct from the Year column's own colId ("checkYear") even
        // though both read the "checkDate" field — cheap to keep, no
        // downside.
        colId: "payCheckDate",
        sortable: true,
        valueFormatter: formatDateCell,
        // The actual fix, confirmed live by toggling checkboxes before and
        // after: a plain `field` with no valueGetter left this column's
        // Set Filter checkboxes completely inert — clicking one (even via
        // a direct element-ref click, bypassing screen coordinates
        // entirely) never changed the filter or the grid's totals. Adding
        // this valueGetter — even though it returns the exact same value
        // `field: "checkDate"` already would — is what made the checkboxes
        // start working. The Year column, whose filter always worked,
        // also has a valueGetter; this one didn't.
        valueGetter: (params) => params.data?.checkDate,
        filterParams: {
          // Set Filter auto-detects a raw ISO date string and switches to
          // tree mode (Year > Month > Day) by default; this keeps it a
          // plain flat list instead, matching Year's own filter.
          treeList: false,
          // The valueGetter above means the filter list no longer applies
          // this column's own cellRenderer-side valueFormatter
          // automatically — restate it here so the list still shows
          // "Apr 15, 2025" instead of the raw "2025-04-15".
          valueFormatter: formatDateCell,
        },
      },
      {
        headerName: "Hours",
        field: "hours",
        sortable: true,
        aggFunc: "sum",
        valueGetter: (params) => params.data?.hours,
      },
      {
        headerName: "Total Paid",
        field: "totalPaid",
        sortable: true,
        aggFunc: "sum",
        valueFormatter: (params) => formatCurrency(params.value),
        valueGetter: (params) => params.data?.totalPaid,
        filterParams: { valueFormatter: (params) => formatCurrency(params.value) },
      },
      {
        headerName: "Net Pay",
        field: "netPay",
        sortable: true,
        aggFunc: "sum",
        valueFormatter: (params) => formatCurrency(params.value),
        valueGetter: (params) => params.data?.netPay,
        filterParams: { valueFormatter: (params) => formatCurrency(params.value) },
      },
      {
        headerName: "Tax Withheld",
        field: "taxWithheld",
        sortable: true,
        aggFunc: "sum",
        valueFormatter: (params) => formatCurrency(params.value),
        valueGetter: (params) => params.data?.taxWithheld,
        filterParams: { valueFormatter: (params) => formatCurrency(params.value) },
      },
      {
        headerName: "Deductions",
        field: "deductions",
        sortable: true,
        aggFunc: "sum",
        valueFormatter: (params) => formatCurrency(params.value),
        valueGetter: (params) => params.data?.deductions,
        filterParams: { valueFormatter: (params) => formatCurrency(params.value) },
      },
      {
        headerName: "Employer Liability",
        field: "employerLiability",
        sortable: true,
        aggFunc: "sum",
        valueFormatter: (params) => formatCurrency(params.value),
        valueGetter: (params) => params.data?.employerLiability,
        filterParams: { valueFormatter: (params) => formatCurrency(params.value) },
      },
      {
        headerName: "Pay Period",
        field: "payPeriodId",
        sortable: true,
        hide: true,
        valueGetter: (params) => params.data?.payPeriodId,
      },
      {
        headerName: "Department",
        field: "department",
        sortable: true,
        enableRowGroup: true,
        valueGetter: (params) => params.data?.department,
      },
      {
        headerName: "Pay Cycle Start",
        field: "payPeriodStartDate",
        sortable: true,
        valueFormatter: formatDateCell,
        // See the matching comment on Pay Check Date above — the
        // valueGetter is the actual fix for inert Set Filter checkboxes
        // on a bare date-string field; filterParams just keeps the list
        // flat and nicely formatted.
        valueGetter: (params) => params.data?.payPeriodStartDate,
        filterParams: { treeList: false, valueFormatter: formatDateCell },
      },
      {
        headerName: "Pay Cycle End",
        field: "payPeriodEndDate",
        sortable: true,
        valueFormatter: formatDateCell,
        valueGetter: (params) => params.data?.payPeriodEndDate,
        filterParams: { treeList: false, valueFormatter: formatDateCell },
      },
      {
        headerName: "Status",
        field: "status",
        sortable: true,
        enableRowGroup: true,
        valueGetter: (params) => params.data?.status,
      },
    ],
    [employeeId],
  );

  // sizeColumnsForHeader returns a brand-new array (and brand-new column
  // objects) on every call. Without memoizing it here, AG Grid sees a new
  // columnDefs reference on every re-render of this component — including
  // the re-render that setPinnedTopRowData below triggers on every filter
  // change — and resets each column's applied filter state right after the
  // user sets it, making Set Filter unselects look like they don't work.
  const sizedColumnDefs = useMemo(() => sizeColumnsForHeader(columnDefs), [columnDefs]);

  const sumPayrollRows = (rows, label) => ({
    payrollSummaryId: label,
    totalPaid: rows.reduce((sum, row) => sum + (row.totalPaid || 0), 0),
    hours: rows.reduce((sum, row) => sum + (row.hours || 0), 0),
    taxWithheld: rows.reduce((sum, row) => sum + (row.taxWithheld || 0), 0),
    deductions: rows.reduce((sum, row) => sum + (row.deductions || 0), 0),
    netPay: rows.reduce((sum, row) => sum + (row.netPay || 0), 0),
    employerLiability: rows.reduce((sum, row) => sum + (row.employerLiability || 0), 0),
  });

  // Bottom row: grand total, regardless of the search box or any AG Grid
  // column filter.
  const pinnedBottomRowData = useMemo(
    () => (rowData.length > 0 ? [sumPayrollRows(rowData, "Total")] : []),
    [rowData],
  );

  // Top row: same totals, but only over rows currently passing both the
  // search box (quickFilterText) and every AG Grid column filter.
  const { pinnedTopRowData, onModelUpdated } = useFilteredTotalsRow((rows) =>
    sumPayrollRows(rows, "Filtered Total"),
  );

  const handleExport = () => {
    if (gridRef.current?.api) {
      gridRef.current.api.exportDataAsExcel({
        fileName: "payroll_summary.xlsx",
      });
    }
  };

  const getRowStyle = (params) => {
    if (params.node.rowPinned) {
      return { backgroundColor: "#d3f4ff", fontWeight: "bold" };
    }
    return null;
  };

  return (
    <div
      className="ag-theme-alpine employee-List-grid"
      style={{ flex: 1, height: "100%", overflow: "hidden" }}
    >
      <Card className="employeeTableCard" style={{ height: "100%", overflow: "hidden" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 8,
          }}
        >
          <div style={{ display: "flex", alignItems: "center" }}>
            {(onRefresh || employeeId) && (
              <Button
                style={{ marginRight: "10px" }}
                type="default"
                icon={<ReloadOutlined />}
                onClick={employeeId ? fetchData : onRefresh}
              >
                Refresh
              </Button>
            )}
            <input
              type="text"
              placeholder="Search..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
            <Button
              style={{ marginLeft: "8px" }}
              icon={<DownloadOutlined />}
              onClick={handleExport}
            >
              Export Excel
            </Button>
          </div>
        </div>

        <div
          style={{
            height: gridHeight,
            minHeight: 300,
            width: "100%",
            overflow: "hidden",
            transition: "height 0.3s ease-in-out",
          }}
        >
          <AgGridReact
            getContextMenuItems={getCellCopyContextMenuItems}
            enableCellTextSelection={true}
            ensureDomOrder={true}
            ref={gridRef}
            onSortChanged={(params) => params.api.refreshCells({ force: true })}
            onFilterChanged={(params) => params.api.refreshCells({ force: true })}
            onModelUpdated={onModelUpdated}
            onFirstDataRendered={(params) => {
              try { params.api.autoSizeAllColumns(); } catch (e) {}
            }}
            autoSizeStrategy={{ type: "fitCellContents" }}
            rowHeight={48}
            rowData={rowData}
            quickFilterText={searchText}
            columnDefs={sizedColumnDefs}
            pinnedTopRowData={pinnedTopRowData}
            pinnedBottomRowData={pinnedBottomRowData}
            defaultColDef={{
              minWidth: 100,
              maxWidth: 220,
              resizable: true,
              filter: "agSetColumnFilter",
              floatingFilter: false,
              enableRowGroup: true,
              headerClass: "ag-header-cell",
              cellClassRules: {
                darkGreyBackground: (params) =>
                  params.node?.rowIndex !== undefined &&
                  params.node.rowIndex % 2 === 1,
              },
            }}
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
            sortable={true}
            rowGroupPanelShow="always"
            domLayout="normal"
            pagination={true}
            paginationPageSize={100}
            paginationPageSizeSelector={[100, 200, 300]}
            getRowStyle={getRowStyle}
            popupParent={document.body}
          />
        </div>
      </Card>
    </div>
  );
};

export default PayrollDetails;
