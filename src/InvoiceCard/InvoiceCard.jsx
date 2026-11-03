// InvoiceCard.js
import React, { useState, useEffect, useRef } from "react";
import { Row, Input, Space, Radio, Button } from "antd";
import { SearchOutlined, ReloadOutlined } from "@ant-design/icons";
import { AgGridReact } from "@ag-grid-community/react";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import axios from "axios";
import API_ENDPOINTS from "../config";
import { sizeColumnsForHeader } from "../Utils/agGridColumnSizing";
import CustomHeader from "../CustomHeader/CustomHeader";
import "./InvoiceCard.css";
import { getCellCopyContextMenuItems } from "../Utils/agGridCellCopy";
const { Search } = Input;

const InvoiceCard = () => {
  const gridApi = useRef(null);
  const [rowData, setRowData] = useState([]);
  const [invoiceStatus, setInvoiceStatus] = useState("viewAll");
  const [searchText, setSearchText] = useState("");
  const columnsList = [
    "Invoice Id",
    "Project Id",
    "InvoiceMonth",
    "Billing",
    "Hours",
    "Total",
    "Invoice PaidAmount",
    "Invoice Date",
    "status",
  ];

  // Custom filter function for the search input
  const handleFilterChange = (value) => {
    gridApi.current.setQuickFilter(value);
  };
  const onChange = (e) => {
    console.log(`radio checked:${e.target.value}`);
    setInvoiceStatus(e.target.value);
  };

  useEffect(() => {
    fetchData();
  }, [invoiceStatus]);

  const fetchData = () => {
    //default status =viewAll
    const today = new Date();
    const formattedDate = today.toISOString().split("T")[0];
    axios
      .get(
        API_ENDPOINTS.getAllInvoices,
        {
          //params: {
          //selectedDate:'2023-11-01',//formattedDate,
          //status: invoiceStatus
          // }
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
      return { ...dataObj };
    });
    return updatedData || [];
  };

  const getColumnsDefList = (
    columnsList,
    isSortable,
    isEditable,
    hasFilter,
  ) => {
    let columns = columnsList.map((column) => {
      let fieldValue = column.split(" ").join("");
      fieldValue = fieldValue[0].toLowerCase() + fieldValue.slice(1);
      if (fieldValue.toLowerCase() === "dob") {
        fieldValue = fieldValue.toLowerCase();
      }

      let updatedColumn = column === "DOB" ? "Date of Birth" : column;
      updatedColumn = column;
      /* if(column == 'startDate' )
          updatedColumn='Employment Start Date';
      else if(column == 'endDate')
          updatedColumn='Employment End Date';*/

      return {
        headerName: updatedColumn,
        field: fieldValue,
        sortable: isSortable,
        editable: true,
        filter: "agSetColumnFilter",
        tooltipValueGetter: (params) => params.value,
        cellRenderer: (params) => {
          return params.value;
        },
        //tooltipComponent: 'customTooltip',
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
  // Grid column definitions

  return (
    <>
      <div className="invoiceCardFilters">
        <Row justify="space-between">
          <Radio.Group onChange={onChange} defaultValue="viewAll" size="large">
            <Radio.Button value="viewAll">View All</Radio.Button>
            <Radio.Button value="pending">Pending</Radio.Button>
            <Radio.Button value="upcoming">Upcoming</Radio.Button>
            <Radio.Button value="overdue">Over Due</Radio.Button>
          </Radio.Group>
          <Space>
            <Button
              type="default"
              icon={<ReloadOutlined />}
              onClick={fetchData}
            >
              Refresh
            </Button>
            <Space.Compact size="large">
              <Input
                addonBefore={<SearchOutlined />}
                placeholder="Search..."
                value={searchText}
                onChange={handleSearchInputChange}
              />
            </Space.Compact>
          </Space>
        </Row>
      </div>
      <div className="ag-theme-alpine employee-List-grid">
        <AgGridReact
          getContextMenuItems={getCellCopyContextMenuItems}
          enableCellTextSelection={true}
          ensureDomOrder={true}
          ref={gridApi}
          onGridReady={(params) => {
            gridApi.current = params.api;
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
          columnDefs={sizeColumnsForHeader(getColumnsDefList(columnsList, true, false))}
          domLayout="autoHeight"
          defaultColDef={{
            minWidth: 100,
            maxWidth: 220,
            resizable: true,
            filter: "agSetColumnFilter",
            cellClassRules: {
              darkGreyBackground: (params) => params.node?.rowIndex !== undefined && params.node.rowIndex % 2 === 1,
            },
          }}
          hiddenByDefault={false}
          rowGroupPanelShow="always"
          pivotPanelShow="always"
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
          paginationPageSize={8}
          paginationPageSizeSelector={[8, 20, 50]}
          enableBrowserTooltips={true}
          popupParent={document.body}
        />
      </div>
    </>
  );
};

export default InvoiceCard;
