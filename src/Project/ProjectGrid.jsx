import React, { useState, useMemo, useEffect } from "react";
import { sizeColumnsForHeader } from "../Utils/agGridColumnSizing";
import API_ENDPOINTS from "../config";
import { createRoot } from "react-dom/client";
import { AgGridReact } from "@ag-grid-community/react";
import { Button, Drawer } from "antd";
import { PlusOutlined, ReloadOutlined } from "@ant-design/icons";
import "@ag-grid-community/styles/ag-grid.css";
import "./ProjectGrid.css";
import { invoiceTermLabel } from "../Utils/invoiceTerm";
import { formatDateMDY } from "../Utils/dateFormat";
import ProjectOnBoardingForm from "../OnBoardingComponent/ProjectOnBoarding";
import NewCustomer from "../Customer/NewCustomer";
import GridToolbar from "../Utils/GridToolbar";

const ProjectGrid = ({ employeeId, customerId, isCollapsed }) => {
  const [searchText, setSearchText] = useState("");
  const [rowData, setRowData] = useState([]);
  const [projectDrawerOpen, setProjectDrawerOpen] = useState(false);
  const [customerDrawerOpen, setCustomerDrawerOpen] = useState(false);
  const columnDefs = [
    {
      headerName: "Employee Name",
      field: "employee.firstName",
      valueGetter: (params) =>
        `${params.data?.employee?.firstName || ""} ${params.data?.employee?.lastName || ""}`,
      filter: "agSetColumnFilter",
    },
    {
      headerName: "Client Name",
      field: "client",
      cellRenderer: (params) => params.data?.customer?.customerCompanyName,
      filter: "agSetColumnFilter",
    },
    {
      headerName: "Bill Rate",
      field: "billRates",
      cellRenderer: (params) => {
        const rate = params.data?.billRates?.[0]?.wage;
        return rate != null ? `$${rate.toFixed(2)}` : "N/A";
      },
      filter: "agSetColumnFilter",
    },
    {
      headerName: "Invoice Term",
      field: "invoiceTerm",
      valueFormatter: (params) => invoiceTermLabel(params.value),
      filter: "agSetColumnFilter",
    },
    { headerName: "Payment Term", field: "paymentTerm", filter: "agSetColumnFilter" },
    { headerName: "Start Date", field: "startDate", filter: "agSetColumnFilter", valueFormatter: (params) => formatDateMDY(params.value) },
    { headerName: "End Date", field: "endDate", filter: "agSetColumnFilter", valueFormatter: (params) => formatDateMDY(params.value) },
    { headerName: "Status", field: "status", filter: "agSetColumnFilter" },
  ];

  const fetchData = () => {
    const url = customerId
      ? API_ENDPOINTS.projectsByCustomerId(customerId)
      : API_ENDPOINTS.projectsByEmployeeId(employeeId);
    fetch(url)
      .then((response) => response.json())
      .then((data) => {
        const transformedData = flattenObject(data);
        setRowData(transformedData);
        console.log(transformedData);
      })
      .catch((error) => console.error("Error fetching data:", error));
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const flattenObject = (data) => {
    let updatedData = data?.map((dataObj) => {
      return {
        ...dataObj,
      };

      // return { ...dataObj,...dataObj.assignments[0],...dataObj.employee.firstName.value, ...dataObj.employee.employeeAssignments[0],...dataObj.customer,...dataObj.billRates[0] }
    });
    console.log(updatedData);
    return updatedData || [];
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
  // const gridOptions = {
  //     onGridReady: (params) => {
  //       // Automatically size all columns to fit content on grid load
  //       const allColumnIds = [];
  //       params.columnApi.getAllColumns().forEach((column) => {
  //         allColumnIds.push(column.getColId());
  //       });
  //       params.columnApi.autoSizeColumns(allColumnIds); // Auto-size columns to content
  //     }
  //   };
  return (
    <>
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
        title="Project Onboarding"
        placement="right"
        size="large"
        onClose={() => {
          setProjectDrawerOpen(false);
          fetchData();
        }}
        open={projectDrawerOpen}
      >
        <ProjectOnBoardingForm />
      </Drawer>
      <Drawer
        title="Customer Onboarding"
        placement="right"
        size="large"
        onClose={() => {
          setCustomerDrawerOpen(false);
          fetchData();
        }}
        open={customerDrawerOpen}
      >
        <NewCustomer />
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
          type="primary"
          className="button-customer"
          onClick={() => setProjectDrawerOpen(true)}
          style={{ marginLeft: "10px" }}
        >
          <PlusOutlined /> Add New Project
        </Button>
        <Button
          type="primary"
          className="button-customer"
          onClick={() => setCustomerDrawerOpen(true)}
          style={{ marginLeft: "10px" }}
        >
          <PlusOutlined /> Add New Customer
        </Button>
      </GridToolbar>
      <div  className={`project-grid-wrapper ${!isCollapsed ? "ag-grid-collapsed" : "ag-grid-expanded"}`}>
      <AgGridReact
        enableCellTextSelection={true}
        ensureDomOrder={true}
        onFirstDataRendered={(params) => {
          try { params.api.autoSizeAllColumns(); } catch (e) {}
        }}
        autoSizeStrategy={{ type: "fitCellContents" }}
        rowData={filterData()}
        frameworkComponents={{ customTooltip: CustomTooltip }}
        columnDefs={sizeColumnsForHeader(columnDefs)}
        domLayout="normal"
        defaultColDef={{
          minWidth: 100,
          maxWidth: 220,
          resizable: true,
          filter: false,
          floatingFilter: false,
          enableRowGroup: true,
        }}
        hiddenByDefault={false}
        rowGroupPanelShow="always"
        pivotPanelShow="always"
        sortable={true}
        defaultToolPanel="columns"
        pagination={true}
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
        paginationPageSize={100}
        gridOptions
        // Set pinned bottom row data here
      />
      </div>
    </div>
    </div>
    </>
  );
};

export default ProjectGrid;
