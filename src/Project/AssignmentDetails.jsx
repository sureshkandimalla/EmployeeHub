import API_ENDPOINTS from "../config";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { sizeColumnsForHeader } from "../Utils/agGridColumnSizing";
import { AgGridReact } from "@ag-grid-community/react";
import "@ag-grid-community/styles/ag-grid.css";
import "./ProjectGrid.css";
import { PlusOutlined, ReloadOutlined, SaveOutlined, CloseOutlined } from "@ant-design/icons";
import { Button, Drawer, message } from "antd";
import axios from "axios";
import "./ProjectGrid.css";
import "@ag-grid-community/styles/ag-theme-alpine.css";
import AssignmentForm from "./AssignmentForm";
import { formatCurrency } from "../Utils/CurrencyFormatter";
import { formatDateMDY } from "../Utils/dateFormat";
import GridToolbar from "../Utils/GridToolbar";
import "./AssignmentDetails.css"

const AssignmentDetails = ({ projectId, isCollapsed }) => {
  console.log(projectId);
  //  const [rowData, setRowData] = useState();
  const [rowData, setRowData] = useState([]);
  const [searchText, setSearchText] = useState("");
  const [modifiedRows, setModifiedRows] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  const addNewProject = () => {
    setOpen(true);
  };

  const onClose = () => {
    setOpen(false);
  };

  const [open, setOpen] = useState(false);

  const fetchData = async () => {
    try {
      const response = await fetch(API_ENDPOINTS.assignmentsForProject(projectId));
      const data = await response.json();
      const flattendData = getFlattenedData(data);
      setRowData(flattendData);
      setModifiedRows({});
      console.log(flattendData);
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };

  const onCellValueChanged = useCallback((params) => {
    const assignmentId = params.data?.assignmentId;
    if (assignmentId === undefined || assignmentId === null) return;
    setModifiedRows((prev) => ({ ...prev, [assignmentId]: params.data }));
  }, []);

  const handleCancelChanges = () => {
    setModifiedRows({});
    fetchData();
  };

  const saveChanges = useCallback(() => {
    const rows = Object.values(modifiedRows);
    if (rows.length === 0) return;
    setIsSaving(true);
    Promise.all(
      rows.map((row) => axios.put(API_ENDPOINTS.assignmentsById(row.assignmentId), row)),
    )
      .then(() => {
        message.success(`${rows.length} assignment(s) saved successfully`);
        setModifiedRows({});
        fetchData();
      })
      .catch(() => {
        message.error("One or more assignments failed to save. Please try again.");
      })
      .finally(() => setIsSaving(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modifiedRows]);

  useEffect(() => {
    fetchData();
  }, []);

  const getFlattenedData = (data) => {
    let updatedData = data?.map((dataObj) => {
      return { ...dataObj };

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

  const getColumnsDefList = (isSortable, isEditable, hasFilter) => {
    /// const columnsList = ['Project Name', 'Project Id ','Employee Id', 'Employee Name', 'Client', 'Customer','Bill Rate', 'Invoice Terms','startDate','endDate','Status','Employee Pay','Expenses','Bean Expenses','Bean Net','Total Hours';
    var columns = [
      { headerName: "Assignment Id", field: "assignmentId" },
      {
        headerName: "Assignment Type",
        field: "assignmentType",
        sortable: isSortable,
        editable: false,
        filter: "agSetColumnFilter",
      },
      {
        headerName: "Employee Name",
        field: "employeeName",
        cellRenderer: (params) =>
          params.data?.firstName + " " + params.data?.lastName,
      },
      {
        headerName: "Wage",
        field: "wage",
        sortable: isSortable,
        editable: true,
        filter: "agSetColumnFilter",
        valueFormatter: (params) => formatCurrency(params.value),
      },
      {
        headerName: "Status",
        field: "status",
        sortable: isSortable,
        editable: true,
        filter: "agSetColumnFilter",
      },
      //{ headerName: 'Client', field: 'clientName',sortable: isSortable, editable: true, filter: 'agTextColumnFilter' },
      //{ headerName: 'Customer', field: 'customerName', sortable: isSortable, editable: true, filter: 'agTextColumnFilter' },
      //{ headerName: 'Bill Rate', field: 'billRate', sortable: isSortable, editable: true, filter: 'agTextColumnFilter' },
      {
        headerName: "Project Start Date",
        field: "startDate",
        sortable: isSortable,
        editable: true,
        filter: "agSetColumnFilter",
        valueFormatter: (params) => formatDateMDY(params.value),
      },
      {
        headerName: "Project End Date",
        field: "endDate",
        sortable: isSortable,
        editable: true,
        filter: "agSetColumnFilter",
        valueFormatter: (params) => formatDateMDY(params.value),
      },
    ];
    return columns;
  };

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
          <Drawer
            title={`Create New Assignment`}
            placement="right"
            size="large"
            onClose={onClose}
            open={open}
          >
            <AssignmentForm onClose={onClose} />
          </Drawer>
          <Button
            type="primary"
            className="button-customer"
            onClick={addNewProject}
          >
            <PlusOutlined /> Add New Assignment
          </Button>
          {Object.keys(modifiedRows).length > 0 && (
            <>
              <Button
                type="primary"
                ghost
                icon={<SaveOutlined />}
                onClick={saveChanges}
                loading={isSaving}
                style={{ marginLeft: "10px" }}
              >
                Save Changes
              </Button>
              <Button
                icon={<CloseOutlined />}
                onClick={handleCancelChanges}
                style={{ marginLeft: "10px" }}
              >
                Cancel
              </Button>
            </>
          )}
        </GridToolbar>
        <div  className={`assignment-grid-wrapper ${!isCollapsed ? "ag-grid-collapsed" : "ag-grid-expanded"}`}>
        <AgGridReact
          enableCellTextSelection={true}
          ensureDomOrder={true}
          onCellValueChanged={onCellValueChanged}
          onSortChanged={(params) => params.api.refreshCells({ force: true })}
          onFilterChanged={(params) => params.api.refreshCells({ force: true })}
          onFirstDataRendered={(params) => {
            try { params.api.autoSizeAllColumns(); } catch (e) {}
          }}
          autoSizeStrategy={{ type: "fitCellContents" }}
          rowData={filterData()}
          columnDefs={sizeColumnsForHeader(getColumnsDefList(true, false))}
          defaultColDef={{
            minWidth: 100,
            maxWidth: 220,
            resizable: true,
            filter: false,
            floatingFilter: false,
            cellClassRules: {
              darkGreyBackground: (params) => params.node?.rowIndex !== undefined && params.node.rowIndex % 2 === 1,
            }
          }}
          hiddenByDefault={false}
          rowGroupPanelShow="never"
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
          enableBrowserTooltips={true} 
          popupParent={document.body} 
        />
        </div>
      </div>
      </div>
    </>
  );
};

export default AssignmentDetails;
