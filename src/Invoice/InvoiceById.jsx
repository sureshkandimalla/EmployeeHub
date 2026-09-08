import React, { useState, useEffect, useRef } from "react";
import API_ENDPOINTS from "../config";
import { sizeColumnsForHeader } from "../Utils/agGridColumnSizing";
import { formatMonthYear, formatDateMDY } from "../Utils/dateFormat";
import { AgGridReact } from "@ag-grid-community/react";
import axios from "axios";
import "ag-grid-enterprise";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import "react-datepicker/dist/react-datepicker.css";
import { PlusOutlined, ReloadOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { Button } from "antd";
import { formatCurrency } from "../Utils/CurrencyFormatter";
import { useFilteredTotalsRow } from "../Utils/useFilteredTotalsRow";
import GridToolbar from "../Utils/GridToolbar";
import "./InvoiceById.css";

const InvoiceById = ({ url, employeeId, isCollapsed }) => {
  const [searchText, setSearchText] = useState("");
  const [rowData, setRowData] = useState([]);
  const [pinnedBottomRowData, setPinnedBottomRowData] = useState([]);
  const navigate = useNavigate();

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
    console.log(url);
    axios
      .get(url, {
        params: {
          // selectedDate: '2023-11-01',//formattedDate,
          //status: 'viewAll'
        },
      })
      .then((response) => {
        console.log(response.data);
        setRowData(getFlattenedData(response.data));
      })
      .catch((error) => {
        console.error(error);
      });
  };

  const getRowStyle = (params) => {
    if (params.node.rowPinned) {
      return { backgroundColor: "#d3f4ff", fontWeight: "bold" }; // Custom inline style for pinned rows
    }
    return null;
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
        headerName: "Invoice #",
        field: "invoiceNumber",
        sortable: isSortable,
        valueFormatter: (params) => {
          return params.node.rowPinned === "bottom" ? "Total" : params.value;
        },
      },
      { headerName: "Project Id", field: "projectId", sortable: isSortable },
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
        headerName: "Invoice PaidAmount",
        field: "invoicePaidAmount",
        sortable: isSortable,
        valueFormatter: (params) => formatCurrency(params.value), // Format with dollar sign
      },
      { headerName: "Start Date", field: "startDate", sortable: isSortable, valueFormatter: (params) => formatDateMDY(params.value) },
      { headerName: "End Date", field: "endDate", sortable: isSortable, valueFormatter: (params) => formatDateMDY(params.value) },
      {
        headerName: "Status",
        field: "status",
      },
    ];
    return columns;
  };

  const gridOptions = {
    pagination: true,
    paginationPageSize: 10, // Number of rows to show per page
    domLayout: "autoHeight",
  };

  const handleSearchInputChange = (event) => {
    setSearchText(event.target.value);
  };

  const filterData = () => {
    if (!searchText) {
      return rowData;
    }

    return rowData.filter((row) =>
      Object.values(row).some((value) =>
        String(value).toLowerCase().includes(searchText.toLowerCase()),
      ),
    );
  };

  const generateInvoice = () => {
    // Any additional logic can go here
    navigate("/generateInvoice", {
      state: {
        url: API_ENDPOINTS.activeProjectsForInvoiceByEmployee(employeeId),
      },
    });
  };

  const sumInvoiceByIdRows = (rows, label) => ({
    invoiceNumber: label,
    hours: rows.reduce((sum, row) => sum + (row.hours || 0), 0),
    total: rows.reduce((sum, row) => sum + (row.total || 0), 0),
    invoicePaidAmount: rows.reduce((sum, row) => sum + (row.invoicePaidAmount || 0), 0),
    actions: null,
  });

  useEffect(() => {
    if (rowData && rowData.length > 0) {
      setPinnedBottomRowData([sumInvoiceByIdRows(rowData, "Total")]);
    }
  }, [rowData]);

  // Top row: same totals, but only over rows currently passing both the
  // search box and every AG Grid column filter.
  const { pinnedTopRowData, onModelUpdated } = useFilteredTotalsRow((rows) =>
    sumInvoiceByIdRows(rows, "Filtered Total"),
  );

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
          onClick={fetchData}
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
          type="primary"
          style={{ marginLeft: "10px" }}
          className="button-customer"
          onClick={generateInvoice}
        >
          <PlusOutlined /> Generate Invoice
        </Button>
      </GridToolbar>
      <div  className={`invoice-grid-wrapper ${!isCollapsed ? "ag-grid-collapsed" : "ag-grid-expanded"}`}>
      <AgGridReact
        enableCellTextSelection={true}
        ensureDomOrder={true}
        onSortChanged={(params) => params.api.refreshCells({ force: true })}
        onFilterChanged={(params) => params.api.refreshCells({ force: true })}
        onModelUpdated={onModelUpdated}
        onFirstDataRendered={(params) => {
          try { params.api.autoSizeAllColumns(); } catch (e) {}
        }}
        autoSizeStrategy={{ type: "fitCellContents" }}
        rowData={filterData()}
        columnDefs={sizeColumnsForHeader(getColumnsDefList(true))}
        gridOptions={gridOptions}
        defaultColDef={{
          minWidth: 100,
          maxWidth: 220,
          resizable: true,
          filter: "agSetColumnFilter",
          floatingFilter: false,
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
        defaultToolPanel="columns"       
        domLayout="normal"
        pagination={true}        
        paginationPageSize={100}
        paginationPageSizeSelector={[100,200, 300]}
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

export default InvoiceById;
