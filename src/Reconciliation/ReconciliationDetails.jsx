import { useEffect, useRef, useState } from "react";
import { AgGridReact } from "@ag-grid-community/react";
import { Button } from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import "ag-grid-enterprise";
import axios from "axios";
import { formatCurrency } from "../Utils/CurrencyFormatter";
import { formatDateMDY } from "../Utils/dateFormat";
import API_ENDPOINTS from "../config";
import { sizeColumnsForHeader } from "../Utils/agGridColumnSizing";
import { useFilteredTotalsRow } from "../Utils/useFilteredTotalsRow";
import GridToolbar from "../Utils/GridToolbar";
import "./ReconciliationDetails.css"

export default function ReconciliationDetails({ employeeId }) {
  const gridRef = useRef(null);
  const [rowData, setRowData] = useState([]);
  const [pinnedBottomRowData, setPinnedBottomRowData] = useState([]);


  const isInitialRender = useRef(true);

  useEffect(() => {
    if (isInitialRender.current) {
      fetchData();
    } else {
      isInitialRender.current = false;
    }
  }, []);

  const fetchData = () => {
    axios
      .get(
        `${API_ENDPOINTS.reconcileRecords}/${employeeId}`,
        {
          params: {
            // selectedDate: '2023-11-01',//formattedDate,
            //status: 'viewAll'
          },
        },
      )
      .then((response) => {
        console.log(response.data);
        setRowData(getFlattenedData(response.data));
      })
      .catch((error) => {
        console.error(error);
      });
  };

  const getFlattenedData = (data) => {
    let updatedData = data.map((dataObj) => {
      //return { ...dataObj, ...dataObj.employeeAddress[0], ...dataObj.employeeAssignments[0] }
      return { ...dataObj };
    });
    return updatedData || [];
  };

    const sumReconciliationRows = (rows, label) => ({
      description: label,
      hours: rows.reduce((sum, row) => sum + (row.hours || 0), 0),
      income: rows.reduce((sum, row) => sum + (row.income || 0), 0),
      expense: rows.reduce((sum, row) => sum + (row.expense || 0), 0),
      invoiceTotal: rows.reduce((sum, row) => sum + (row.invoiceTotal || 0), 0),
      invoicePaidAmount: rows.reduce((sum, row) => sum + (row.invoicePaidAmount || 0), 0),
      projectBilling: rows.reduce((sum, row) => sum + (row.projectBilling || 0), 0),
      wage: rows.reduce((sum, row) => sum + (row.wage || 0), 0),
      actions: null,
    });

    useEffect(() => {
      if (rowData && rowData.length > 0) {
        setPinnedBottomRowData([sumReconciliationRows(rowData, "Total")]);
      }
    }, [rowData]);

    // Top row: same totals, but only over rows currently passing every
    // AG Grid column filter (this grid has no separate search box).
    const { pinnedTopRowData, onModelUpdated } = useFilteredTotalsRow((rows) =>
      sumReconciliationRows(rows, "Filtered Total"),
    );
  const columnDefs = [
    {
      field: "description",
      headerName: "Description",
      cellRenderer: "agGroupCellRenderer",
    },
    { field: "hours", headerName: "Hours", filter: "agSetColumnFilter" },
    {
      field: "income",
      headerName: "Income",
      valueFormatter: (params) => formatCurrency(params.value),
      filter: "agSetColumnFilter",
    },
    {
      field: "expense",
      headerName: "Expense",
      valueFormatter: (params) => formatCurrency(params.value),
      filter: "agSetColumnFilter",
    },
    {
      field: "invoiceTotal",
      headerName: "Invoice Total",
      valueFormatter: (params) => formatCurrency(params.value),
      filter: "agSetColumnFilter",
    },
    {
      field: "invoicePaidAmount",
      headerName: "Invoice Paid Amount",
      valueFormatter: (params) => formatCurrency(params.value),
      filter: "agSetColumnFilter",
    },
    {
      field: "projectBilling",
      headerName: "Project Billing",
      filter: "agSetColumnFilter",
      valueFormatter: (params) => formatCurrency(params.value),
    },
    {
      field: "wage",
      headerName: "Wage",
      valueFormatter: (params) => formatCurrency(params.value),
      filter: "agSetColumnFilter",
    },
    
    { field: "startDate", headerName: "Start Date", filter: "agSetColumnFilter", valueFormatter: (params) => formatDateMDY(params.value) },
    { field: "endDate", headerName: "End Date", filter: "agSetColumnFilter", valueFormatter: (params) => formatDateMDY(params.value) },
  ];

  const getRowStyle = (params) => {
    if (params.node.rowPinned) {
      return { backgroundColor: "#d3f4ff", fontWeight: "bold" }; // Custom inline style for pinned rows
    }
    return null;
  };

  const detailCellRendererParams = {
    detailGridOptions: {
      domLayout: 'autoHeight',
      columnDefs: [
        {
          field: "description",
          headerName: "Expense Description",
          filter: "agSetColumnFilter",
        },
        { field: "hours", headerName: "Hours", filter: "agSetColumnFilter" },
        {
          field: "wage",
          headerName: "Wage",
          valueFormatter: (params) => formatCurrency(params.value),
          filter: "agSetColumnFilter",
        },
        {
          field: "total",
          headerName: "Total Expense",
          valueFormatter: (params) => formatCurrency(params.value),
          filter: "agSetColumnFilter",
        },
        { field: "expenseType", headerName: "Expense Type", filter: "agSetColumnFilter" },
        { field: "startDate", headerName: "Start Date", filter: "agSetColumnFilter", valueFormatter: (params) => formatDateMDY(params.value) },
        { field: "endDate", headerName: "End Date", filter: "agSetColumnFilter", valueFormatter: (params) => formatDateMDY(params.value) },
      ],
      defaultColDef: {
        flex: 1,
        minWidth: 20,
        resizable: true,
      }
    },
    getDetailRowData: (params) => {
      console.log(params)
      params.successCallback(params.data.expenseRecords);
    },   
  };

  return ( 
    <div
    style={{
      height: "100%",
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
    }}>
    <div className="ag-theme-alpine project-List-grid">
      <GridToolbar className="workforce-search-container">
        <Button
          type="default"
          icon={<ReloadOutlined />}
          onClick={fetchData}
          style={{ marginRight: "10px" }}
        >
          Refresh
        </Button>
      </GridToolbar>
      <div className= "project-grid-wrapper">
      <AgGridReact
        enableCellTextSelection={true}
        ensureDomOrder={true}
        ref={gridRef}
        onGridReady={(params) => {
          gridRef.current = params.api;
        }}
        onSortChanged={(params) => params.api.refreshCells({ force: true })}
        onFilterChanged={(params) => params.api.refreshCells({ force: true })}
        onModelUpdated={onModelUpdated}
        onFirstDataRendered={(params) => {
          try { params.api.autoSizeAllColumns(); } catch (e) {}
        }}
        autoSizeStrategy={{ type: "fitCellContents" }}
        rowHeight={48}
        rowData={rowData}
        columnDefs={sizeColumnsForHeader(columnDefs)}
        masterDetail={true}
        detailCellRendererParams={detailCellRendererParams}
        pinnedTopRowData={pinnedTopRowData}
        pinnedBottomRowData={pinnedBottomRowData}
        getRowStyle={getRowStyle}
        defaultColDef={{
          minWidth: 100,
          maxWidth: 220,
          resizable: true,
          filter: "agSetColumnFilter",
          headerClass: "ag-header-cell",
          cellClassRules: {
            darkGreyBackground: (params) => params.node?.rowIndex !== undefined && params.node.rowIndex % 2 === 1,
          }
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
                suppressRowGroups: true,
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
        domLayout="normal"
        enableBrowserTooltips={true}
        popupParent={document.body}
        animateRows={true}
        pagination={true}
        paginationPageSize={100}
        paginationPageSizeSelector={[20, 50, 100]}
        detailRowAutoHeight={true}
      />
      </div>
    </div>  
    </div>  
  );
}
