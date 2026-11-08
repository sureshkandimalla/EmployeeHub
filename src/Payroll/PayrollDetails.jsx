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
      },
      { headerName: "Employee Id", field: "employeeId", sortable: true, hide: true },
      {
        headerName: "Employee Name",
        field: "employeeName",
        sortable: true,
        minWidth: 180,
        pinned: "left",
        enableRowGroup: true,
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
        sortable: true,
        valueFormatter: formatDateCell,
        // Without this, AG Grid's Set Filter auto-detects the raw ISO date
        // string and switches to tree mode (Year > Month > Day) — which
        // silently fails to toggle checkboxes for this column's data shape.
        // treeList: false keeps it a plain flat list, same as every other
        // working Set Filter column in this grid.
        filterParams: { treeList: false },
      },
      { headerName: "Hours", field: "hours", sortable: true, aggFunc: "sum" },
      {
        headerName: "Total Paid",
        field: "totalPaid",
        sortable: true,
        aggFunc: "sum",
        valueFormatter: (params) => formatCurrency(params.value),
      },
      {
        headerName: "Net Pay",
        field: "netPay",
        sortable: true,
        aggFunc: "sum",
        valueFormatter: (params) => formatCurrency(params.value),
      },
      {
        headerName: "Tax Withheld",
        field: "taxWithheld",
        sortable: true,
        aggFunc: "sum",
        valueFormatter: (params) => formatCurrency(params.value),
      },
      {
        headerName: "Deductions",
        field: "deductions",
        sortable: true,
        aggFunc: "sum",
        valueFormatter: (params) => formatCurrency(params.value),
      },
      {
        headerName: "Employer Liability",
        field: "employerLiability",
        sortable: true,
        aggFunc: "sum",
        valueFormatter: (params) => formatCurrency(params.value),
      },
      { headerName: "Pay Period", field: "payPeriodId", sortable: true, hide: true },
      { headerName: "Department", field: "department", sortable: true, enableRowGroup: true },
      {
        headerName: "Pay Cycle Start",
        field: "payPeriodStartDate",
        sortable: true,
        valueFormatter: formatDateCell,
        filterParams: { treeList: false },
      },
      {
        headerName: "Pay Cycle End",
        field: "payPeriodEndDate",
        sortable: true,
        valueFormatter: formatDateCell,
        filterParams: { treeList: false },
      },
      { headerName: "Status", field: "status", sortable: true, enableRowGroup: true },
    ],
    [employeeId],
  );

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
            columnDefs={sizeColumnsForHeader(columnDefs)}
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
