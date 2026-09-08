import React, { useState, useEffect, useRef } from "react";
import API_ENDPOINTS from "../config";
import { sizeColumnsForHeader } from "../Utils/agGridColumnSizing";
import { AgGridReact } from "@ag-grid-community/react";
import { Button, Drawer } from "antd";
import { PlusOutlined, ReloadOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "ag-grid-enterprise";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import "react-datepicker/dist/react-datepicker.css";
import AdjustmentForm from "./AdjustmentForm";
import { formatCurrency } from "../Utils/CurrencyFormatter";
import { formatDateMDY } from "../Utils/dateFormat";
import { useFilteredTotalsRow } from "../Utils/useFilteredTotalsRow";
import GridToolbar from "../Utils/GridToolbar";

const AdjustementDetails = ({ employeeId, isCollapsed }) => {
  const gridRef = useRef(null);
  const [searchText, setSearchText] = useState("");
  const [selectedDate, setSelectedDate] = useState(null);
  const [rowData, setRowData] = useState();
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
    setRowData([])
    // Used two ways: with an employeeId (embedded in EmployeeFullDetailsComponent,
    // scoped to that one employee) or standalone from the left-nav "Adjustments"
    // page, which has no employeeId and shows every adjustment instead.
    const url = employeeId
      ? `${API_ENDPOINTS.findAdjustmentsByEmployeeId}?id=${employeeId}`
      : API_ENDPOINTS.getAllAdjustments;
    axios.get(url)
      .then(response => {
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

  const getColumnsDefList = (isSortable, isEditable, hasFilter) => {
    var columns = [
      {
        headerName: "Adjustment Id",
        field: "adjustmentId",
        sortable: isSortable,
        valueFormatter: (params) => {
          // Check if this row is the pinned bottom row and show "Total"
          return params.node.rowPinned === "bottom" ? "Total" : params.value;
        },
      },
      { headerName: "FromName", field: "fromName", sortable: isSortable },
      { headerName: "ToName", field: "toName", sortable: isSortable },
      {
        headerName: "Amount",
        field: "amount",
        sortable: isSortable,
        valueFormatter: (params) => formatCurrency(params.value), // Format with dollar sign
      },
      {
        headerName: "AdjustmentType",
        field: "adjustmentType",
        sortable: isSortable,
        filter: "agSetColumnFilter",
      },
      { headerName: "Notes", field: "notes", sortable: isSortable, width: 550 },
      {
        headerName: "AdjustmentDate",
        field: "adjustmentDate",
        sortable: isSortable,
        filter: "agSetColumnFilter",
        valueFormatter: (params) => formatDateMDY(params.value),
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

  const [open, setOpen] = useState(false);

  const addNewInvoice = () => {
    setOpen(true);
  };
  const onClose = (action) => {
    setOpen(false);
    if (action === "submit") {
      fetchData(); // Fetch data if submit
    }
  };

  useEffect(() => {
    if (rowData && rowData.length > 0) {
      setPinnedBottomRowData([
        {
          adjustmentId: "Total",
          amount: rowData.reduce((sum, row) => sum + (row.amount || 0), 0),
        },
      ]);
    }
  }, [rowData]);

  // Top row: same total, but only over rows currently passing both the
  // search box and every AG Grid column filter.
  const { pinnedTopRowData, onModelUpdated } = useFilteredTotalsRow((rows) => ({
    adjustmentId: "Filtered Total",
    amount: rows.reduce((sum, row) => sum + (row.amount || 0), 0),
  }));

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
      <Drawer
        title={`Add Adjustments`}
        placement="right"
        size="large"
        onClose={onClose}
        open={open}
      >
        <AdjustmentForm onClose={onClose} />
      </Drawer>
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
          style={{ marginLeft: "20px" }}
          type="primary"
          className="button-customer"
          onClick={addNewInvoice}
        >
          <PlusOutlined /> Add New Adjustment
        </Button>
      </GridToolbar>
      <div  className={`assignment-grid-wrapper ${!isCollapsed ? "ag-grid-collapsed" : "ag-grid-expanded"}`}>
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
        defaultToolPanel="columns"
        pagination={true}
        paginationPageSize={100}
        paginationPageSizeSelector={[100,200, 300]}
        domLayout="normal"
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

export default AdjustementDetails;
