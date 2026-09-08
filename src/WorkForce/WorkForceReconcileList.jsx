import React, { useState, useEffect, useRef, useMemo } from "react";
import { sizeColumnsForHeader } from "../Utils/agGridColumnSizing";
import { AgGridReact } from "@ag-grid-community/react";
import { Button } from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import { Link } from "react-router-dom";
import "ag-grid-enterprise";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import "./WorkForceList.css";
import { formatCurrency } from "../Utils/CurrencyFormatter";
import { formatDateMDY } from "../Utils/dateFormat";
import GridToolbar from "../Utils/GridToolbar";

const WorkForceReconcileList = ({ employees, isCollapsed, onRefresh }) => {
  const gridRef = useRef(null);
  const [searchText, setSearchText] = useState("");
  const [rowData, setRowData] = useState([]);
  const columnsList = [
    "First Name",
    "Last Name",
    "Income",
    "Expense",
    "Status",
    "Visa",
    "StartDate",
    "EndDate",
    "Annual Pay",
    "Email Id",
    "Phone",
    "DOB",
    "Employment Type"
  ];

  useEffect(() => {
    setRowData(Array.isArray(employees) ? employees : []);
  }, [employees]);

  const getColumnsDefList = (columnsList, isSortable) => {
    let columns = columnsList.map((column) => {
      let fieldValue = column.split(" ").join("");
      fieldValue = fieldValue[0].toLowerCase() + fieldValue.slice(1);
      if (
        fieldValue.toLowerCase() === "ssn" ||
        fieldValue.toLowerCase() === "dob"
      ) {
        fieldValue = fieldValue.toLowerCase();
      }

      let updatedColumn = column === "DOB" ? "Date of Birth" : column;
      updatedColumn = column;
      // Every column uses the checkbox/select-values Set Filter — kept
      // consistent across every grid in the app rather than per-type
      // filter widgets (contains/equals/etc.).
      const columnFilter = "agSetColumnFilter";
      let autoWidth = 0;
      if (column == "Visa") {
        autoWidth = 100;
      } else if (
        column == "Status" ||
        column == "StartDate" ||
        column == "EndDate" ||
        column == "Annual Pay" ||
        column == "Income" ||
        column == "Expense" ||
        column == "SSN"
      ) {
        autoWidth = 145;
      } else {
        const maxDataLength =
          rowData && rowData.length > 0
            ? rowData.reduce((max, row) => {
                const valueLength = row[fieldValue]
                  ? row[fieldValue].toString().length
                  : 0;
                return Math.max(max, valueLength);
              }, column.length)
            : column.length;

        const charWidth = 8;
        const maxAllowedWidth = 25 * charWidth;       
        autoWidth = Math.min(maxDataLength * charWidth + 30, maxAllowedWidth);
      }

      const isPinnedColumn = column === "First Name" || column === "Last Name";

      return {
        headerName: updatedColumn,
        field: fieldValue,
        sortable: isSortable,
        editable: true,
        headerClass: "ag-header-cell",
        filter: columnFilter,
        minWidth: autoWidth,
        pinned: isPinnedColumn ? "left" : undefined,
        lockPinned: isPinnedColumn,
        suppressSizeToFit: true,
        tooltipValueGetter: (params) => params.value,
        cellClassRules: {
          darkGreyBackground: (params) => {
            return params.node?.rowIndex !== undefined && params.node.rowIndex % 2 === 1;
          }          
        },
        cellRenderer: (params) => {
          if (column === "First Name" || column === "Last Name") {
            return (
              <Link to="/employeeFullDetails" state={{ rowData: params.data }}>
                {params.value}
              </Link>
            );
          } else if (params.colDef.field === "annualPay") {
            return formatCurrency(params.value);
          } 
          else if (params.colDef.field === "income") {
            return formatCurrency(params.value);
          }
          else if (params.colDef.field === "expense") {
            return formatCurrency(params.value);
          }
          else if (["startDate", "endDate", "dob"].includes(params.colDef.field)) {
            return formatDateMDY(params.value);
          } else {
            return params.value;
          }
        },
        tooltipShowDelay: 0,
      };
    });
    return columns;
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

  const CustomTooltip = (props) => {
    return (
      <div style={{ color: "red", background: "yellow", padding: "5px" }}>
        {props.value}
      </div>
    );
  };

  const reconcileColumnDefs = useMemo(() => {
    return [
      {
        headerName: "#",
        valueGetter: (params) => params.node.rowIndex + 1,
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
        headerClass: "ag-center-cols",
        cellClassRules: {
          darkGreyBackground: (params) => params.node?.rowIndex !== undefined && params.node.rowIndex % 2 === 1,
        },
      },
      ...getColumnsDefList(columnsList, true, false),
    ];
  }, [rowData]);

  return (
    <div className="ag-theme-alpine workforce-container">
      <GridToolbar className="workforce-search-container">
        <Button
          type="default"
          icon={<ReloadOutlined />}
          onClick={onRefresh}
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
      </GridToolbar>
      <div  className={`ag-workforce-grid-wrapper ${!isCollapsed ? "ag-grid-collapsed" : "ag-grid-expanded"}`}>
        <AgGridReact
          enableCellTextSelection={true}
          ensureDomOrder={true}
          ref={gridRef}
          onGridReady={(params) => {
            gridRef.current = params.api;
          }}
          onSortChanged={(params) => params.api.refreshCells({ force: true })}
          onFilterChanged={(params) => params.api.refreshCells({ force: true })}
          onFirstDataRendered={(params) => {
            try { params.api.autoSizeAllColumns(); } catch (e) {}
          }}
          autoSizeStrategy={{ type: "fitCellContents" }}
          rowHeight={48}
          rowData={filterData()}
          frameworkComponents={{ customTooltip: CustomTooltip }}
          columnDefs={sizeColumnsForHeader(reconcileColumnDefs)}
          defaultColDef={{
            minWidth: 100,
            maxWidth: 220,
            resizable: true,
            filter: "agSetColumnFilter",
          }}
          hiddenByDefault={false}
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
          pagination={true}
          paginationPageSize={100}
          paginationPageSizeSelector={[20, 50, 100]}
          domLayout="normal"            
          enableBrowserTooltips={true} 
          popupParent={document.body}   
        />
      </div>
    </div>
  );
};

export default WorkForceReconcileList;
