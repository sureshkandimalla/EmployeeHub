import React, { useState, useEffect, useRef, useMemo } from "react";
import { AgGridReact } from "@ag-grid-community/react";
import { Button, Card, Upload, message } from "antd";
import { DownloadOutlined, ReloadOutlined, UploadOutlined } from "@ant-design/icons";
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

const HealthInsuranceDetails = ({ rowData: externalRowData, onRefresh, employeeId, gridHeight = "calc(100vh - 500px)" }) => {
  const [searchText, setSearchText] = useState("");
  const [internalRowData, setInternalRowData] = useState([]);
  const [uploading, setUploading] = useState(false);
  const gridRef = useRef(null);

  const rowData = employeeId ? internalRowData : (externalRowData || []);

  useEffect(() => {
    if (employeeId) {
      fetchData();
    }
  }, [employeeId]);

  const fetchData = () => {
    axios
      .get(API_ENDPOINTS.getHealthInsuranceForEmp(employeeId))
      .then((response) => setInternalRowData(response.data || []))
      .catch((error) => console.error("Error fetching health insurance:", error));
  };

  const formatDateCell = (params) => formatDate(params.value);

  const handleUpload = ({ file }) => {
    const formData = new FormData();
    formData.append("file", file);
    setUploading(true);
    axios
      .post(API_ENDPOINTS.importHealthInsuranceCsv, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((response) => {
        const { imported, unmatchedEmployeeCount } = response.data || {};
        message.success(
          `Imported ${imported ?? 0} record(s).` +
            (unmatchedEmployeeCount ? ` ${unmatchedEmployeeCount} employee name(s) unmatched.` : "")
        );
        (employeeId ? fetchData : onRefresh)?.();
      })
      .catch((error) => {
        console.error("Error uploading health insurance CSV:", error);
        message.error("Upload failed: " + (error.response?.data?.message || error.message));
      })
      .finally(() => setUploading(false));
  };

  const columnDefs = useMemo(
    () => [
      { headerName: "Health Insurance Id", field: "healthInsuranceId", sortable: true, hide: true },
      {
        headerName: "Employee Name",
        field: "employeeName",
        sortable: true,
        minWidth: 180,
        pinned: "left",
        enableRowGroup: true,
      },
      { headerName: "Employee Id", field: "employeeId", sortable: true, enableRowGroup: true },
      { headerName: "Group Id", field: "groupId", sortable: true, enableRowGroup: true },
      {
        headerName: "Date of Bill",
        field: "dateOfBill",
        sortable: true,
        valueFormatter: formatDateCell,
      },
      {
        headerName: "Due Date",
        field: "dueDate",
        sortable: true,
        valueFormatter: formatDateCell,
      },
      { headerName: "UMI", field: "umi", sortable: true },
      {
        headerName: "Claim Prefund",
        field: "claimPrefund",
        sortable: true,
        aggFunc: "sum",
        valueFormatter: (params) => formatCurrency(params.value),
      },
      {
        headerName: "Specific Stop Loss",
        field: "specificStopLoss",
        sortable: true,
        aggFunc: "sum",
        valueFormatter: (params) => formatCurrency(params.value),
      },
      {
        headerName: "Aggregate Stop Loss",
        field: "aggregateStopLoss",
        sortable: true,
        aggFunc: "sum",
        valueFormatter: (params) => formatCurrency(params.value),
      },
      {
        headerName: "Admin Fee",
        field: "adminFee",
        sortable: true,
        aggFunc: "sum",
        valueFormatter: (params) => formatCurrency(params.value),
      },
      {
        headerName: "Total",
        field: "total",
        sortable: true,
        aggFunc: "sum",
        valueFormatter: (params) => formatCurrency(params.value),
      },
      { headerName: "Comment", field: "comment", sortable: true },
    ],
    [employeeId],
  );

  const sumHealthInsuranceRows = (rows, label) => ({
    healthInsuranceId: label,
    claimPrefund: rows.reduce((sum, row) => sum + (row.claimPrefund || 0), 0),
    specificStopLoss: rows.reduce((sum, row) => sum + (row.specificStopLoss || 0), 0),
    aggregateStopLoss: rows.reduce((sum, row) => sum + (row.aggregateStopLoss || 0), 0),
    adminFee: rows.reduce((sum, row) => sum + (row.adminFee || 0), 0),
    total: rows.reduce((sum, row) => sum + (row.total || 0), 0),
  });

  // Bottom row: grand total across every record, regardless of the search
  // box or any AG Grid column filter.
  const pinnedBottomRowData = useMemo(
    () => (rowData.length > 0 ? [sumHealthInsuranceRows(rowData, "Total")] : []),
    [rowData],
  );

  // Top row: same totals, but only over rows currently passing both the
  // search box (quickFilterText) and every AG Grid column filter.
  const { pinnedTopRowData, onModelUpdated } = useFilteredTotalsRow((rows) =>
    sumHealthInsuranceRows(rows, "Filtered Total"),
  );

  const handleExport = () => {
    if (gridRef.current?.api) {
      gridRef.current.api.exportDataAsExcel({
        fileName: "health_insurance.xlsx",
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
            <Upload
              accept=".csv"
              showUploadList={false}
              customRequest={handleUpload}
            >
              <Button
                style={{ marginLeft: "8px" }}
                icon={<UploadOutlined />}
                loading={uploading}
              >
                Upload CSV
              </Button>
            </Upload>
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

export default HealthInsuranceDetails;
