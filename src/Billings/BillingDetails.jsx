import React, { useState, useEffect, useRef } from "react";
import API_ENDPOINTS from "../config";
import { sizeColumnsForHeader } from "../Utils/agGridColumnSizing";
import { formatMonthYear, formatDateMDY } from "../Utils/dateFormat";
import { AgGridReact } from "@ag-grid-community/react";
import { Button } from "antd";
import { ReloadOutlined, FileExcelOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "ag-grid-enterprise";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import "react-datepicker/dist/react-datepicker.css";
import { formatCurrency } from "../Utils/CurrencyFormatter";
import { useFilteredTotalsRow } from "../Utils/useFilteredTotalsRow";
import GridToolbar from "../Utils/GridToolbar";
import "./BillingDetails.css"

const BillingDetails = ({ url, isCollapsed, onRefresh }) => {
  const gridRef = useRef(null);
  const [searchText, setSearchText] = useState("");
  const [rowData, setRowData] = useState([]);
  const navigate = useNavigate();
  const [pinnedBottomRowData, setPinnedBottomRowData] = useState([]);

  //  const columnsList = ['Customer Id', 'Company Name', 'Email Id', 'Phone', 'Status', 'ein', 'Website','startDate','endDate' ];
  const isInitialRender = useRef(true);

  useEffect(() => {
    if (isInitialRender.current) {
      fetchData();
    } else {
      isInitialRender.current = false;
    }
  }, []);

  const fetchData = () => {
    //default status =viewAll
    setRowData([]);
    const today = new Date();
    axios
      .get(url, {
        params: {
          // selectedDate: '2023-11-01',//formattedDate,
          //status: 'viewAll'
        },
      })
      .then((response) => {
        console.log(response.data);
        const data = getFlattenedData(response.data);
        setRowData(data);
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

  const getColumnsDefList = (isSortable, isEditable, hasFilter) => {
    var columns = [
      {
        headerName: "Description",
        field: "billType",
        sortable: isSortable,
        width: 250,
      },
      {
        headerName: "InvoiceMonth",
        field: "invoiceMonth",
        sortable: isSortable,
        valueFormatter: (params) => formatMonthYear(params.value),
      },
      {
        headerName: "Billing",
        field: "billing",
        sortable: isSortable,
        valueFormatter: (params) => {
          // Check if this is a pinned row
          if (params.node.rowPinned) {
            return params.value; // Return the raw value without formatting
          }

          // Apply formatting for non-pinned rows
          return formatCurrency(params.value);
        },
      },
      { headerName: "Hours", field: "hours", sortable: isSortable },
      {
        headerName: "Total",
        field: "total",
        sortable: isSortable,
        valueFormatter: (params) => formatCurrency(params.value), // Format with dollar sign
      },
      {
        headerName: "Bill PaidAmount",
        field: "billPaidAmount",
        sortable: isSortable,
        valueFormatter: (params) => formatCurrency(params.value), // Format with dollar sign
      },
      { headerName: "BillDate", field: "billDate", sortable: isSortable, valueFormatter: (params) => formatDateMDY(params.value) },
      { headerName: "Start Date", field: "startDate", sortable: isSortable, valueFormatter: (params) => formatDateMDY(params.value) },
      { headerName: "End Date", field: "endDate", sortable: isSortable, valueFormatter: (params) => formatDateMDY(params.value) },
      {
        headerName: "Payment Date",
        field: "paymentDate",
        sortable: isSortable,
        valueFormatter: (params) => formatDateMDY(params.value),
      },
      { headerName: "Status", field: "status", sortable: isSortable },
    ];
    return columns;
  };

  const gridOptions = {
    pagination: true,
    paginationPageSize: 10, // Number of rows to show per page
    domLayout: "normal",
  };

  const handleSearchInputChange = (event) => {
    setSearchText(event.target.value);
  };

  const onBtnExportDataAsExcel = () => {
    if (gridRef.current) {
      gridRef.current.exportDataAsExcel();
    }
  };

  const filterData = () => {
    if (!searchText) {
      return rowData;
    }

    return rowData.filter((row) =>
      Object.values(row).some((value) =>
        String(value).toLowerCase().includes(searchText.toLowerCase())
      )
    );
  };

  const sumBillRows = (rows, label) => ({
    billType: label,
    hours: rows.reduce((sum, row) => sum + (row.hours || 0), 0),
    total: rows.reduce((sum, row) => sum + (row.total || 0), 0),
    billPaidAmount: rows.reduce((sum, row) => sum + (row.billPaidAmount || 0), 0),
  });

  useEffect(() => {
    if (rowData && rowData.length > 0) {
      setPinnedBottomRowData([sumBillRows(rowData, "Total")]);
    }
  }, [rowData]);

  // Top row: same totals, but only over rows currently passing both the
  // search box and every AG Grid column filter.
  const { pinnedTopRowData, onModelUpdated } = useFilteredTotalsRow((rows) =>
    sumBillRows(rows, "Filtered Total"),
  );

  const getRowStyle = (params) => {
    if (params.node.rowPinned) {
      return { backgroundColor: "#d3f4ff", fontWeight: "bold" }; // Custom inline style for pinned rows
    }
    return null;
  };

  return (
    <div
  style={{
    height: "100%",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  }}
>
 
  <div className="ag-theme-alpine workforce-container">
    <GridToolbar className="workforce-search-container">
      <Button
        type="default"
        icon={<ReloadOutlined />}
        onClick={() => {
          fetchData();
          // When embedded (e.g. Project Full Details' "Bills" tab), also
          // refreshes the host page's own totals/chart.
          onRefresh?.();
        }}
        style={{ marginRight: "10px" }}
      >
        Refresh
      </Button>
      <input
        type="text"
        placeholder="Search..."
        value={searchText}
        onChange={handleSearchInputChange}
      />
      <Button
        type="default"
        icon={<FileExcelOutlined />}
        onClick={onBtnExportDataAsExcel}
        style={{ marginLeft: "10px" }}
      >
        Export to Excel
      </Button>
    </GridToolbar>

    <div
      className={`billing-grid-wrapper ${
        !isCollapsed ? "ag-grid-collapsed" : "ag-grid-expanded"
      }`}
    >
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
        rowData={filterData()}
        columnDefs={sizeColumnsForHeader(getColumnsDefList(true))}
        gridOptions={gridOptions}
        defaultColDef={{
          minWidth: 100,
          maxWidth: 220,
          resizable: true,
          filter: "agSetColumnFilter",
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
        sortable={true}
        domLayout="normal"
        pagination={true}
        paginationPageSize={100}
        paginationPageSizeSelector={[20, 50, 100]}
        pinnedTopRowData={pinnedTopRowData}
        pinnedBottomRowData={pinnedBottomRowData}
        getRowStyle={getRowStyle}
        enableBrowserTooltips={true}
        popupParent={document.body}
      />
    </div>
  </div>
</div>

  );
};

export default BillingDetails;
