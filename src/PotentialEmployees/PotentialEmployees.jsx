import React, { useState, useEffect,useCallback, useRef, useMemo } from "react";
import { AgGridReact } from "@ag-grid-community/react";
import { Button, Drawer, Card, Modal, message, notification } from "antd";
import { PlusOutlined, SaveOutlined, FileExcelOutlined, ReloadOutlined  } from "@ant-design/icons";
import "ag-grid-enterprise";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import NewPotentialEmployee from "./NewPotentialEmployee";
import "./PotentialEmployees.css";
import axios from "axios";
import API_ENDPOINTS from "../config";
import { sizeColumnsForHeader } from "../Utils/agGridColumnSizing";
import { formatDateMDY } from "../Utils/dateFormat";
import NotesActionButton from "../Notes/NotesActionButton";
import NotesModal from "../Notes/NotesModal";
import { buildRowActions } from "../Notes/rowActions";
import GridToolbar from "../Utils/GridToolbar";
import { getCellCopyContextMenuItems } from "../Utils/agGridCellCopy";

const PotentialEmployees = () => {
  const [searchText, setSearchText] = useState("");
  const [rowData, setRowData] = useState([]);
  const [open, setOpen] = useState(false);
  const gridRef = useRef(null); // Reference for Ag-Grid
  const [updatedRows, setUpdatedRows] = useState([]); // Store edited rows
  const [noteModalRow, setNoteModalRow] = useState(null);

  const handleArchivePotentialEmployee = (row) => {
    axios
      .post(API_ENDPOINTS.savePotentialEmployees, [{ ...row, status: "Archived" }])
      .then(() => {
        message.success("Record archived");
        fetchPotentialEmployees();
      })
      .catch(() => message.error("Failed to archive record. Please try again."));
  };

  const handleDeletePotentialEmployee = (row) => {
    Modal.confirm({
      title: `Delete "${row.firstName || ""} ${row.lastName || ""}"?`,
      content: "This permanently removes this record. This can't be undone.",
      okText: "Delete",
      okType: "danger",
      cancelText: "Cancel",
      onOk: () =>
        axios
          .delete(API_ENDPOINTS.deletePotentialEmployee(row.peId))
          .then(() => {
            message.success("Record deleted");
            fetchPotentialEmployees();
          })
          .catch(() => message.error("Failed to delete record. Please try again.")),
    });
  };

  // Fetch employee data
  useEffect(() => {
    fetchPotentialEmployees();
  }, []);

  const fetchPotentialEmployees = () => {
    fetch(API_ENDPOINTS.getAllPotentialEmployees)
      .then((response) => response.json())
      .then((data) => setRowData(data))
      .catch((error) => console.error("Error fetching data:", error));
  };

  const excelStyles = [
    {
      id: "cell",
      alignment: {
        vertical: "Center",
      },
    },         
    {
      id: "darkGreyBackground",
      interior: {
        color: "#E7E4EC",
        pattern: "Solid",
      },
      font: {
        fontName: "Calibri Light",
        color: "#006400",
      },
    },
    {
      id: "blueUnderline",
      font: {
        fontName: "Calibri Light",    
        color: "#0000EE",     
      },
    }
  ];

  // Define editable columns
  const getColumnsDefList = () => {
    var columns = [
      {
        headerName: "First Name",
        field: "firstName",
        editable: true,
        filter: "agSetColumnFilter",
        floatingFilter: false,
        valueGetter: (params) => params.data?.firstName,
        valueSetter: (params) => {
          params.data.firstName = params.newValue;
          return true;
        },
      },
      {
        headerName: "Last Name",
        field: "lastName",
        editable: true,
        filter: "agSetColumnFilter",
        valueGetter: (params) => params.data?.lastName,
        valueSetter: (params) => {
          params.data.lastName = params.newValue;
          return true;
        },
      },
      { 
        headerName: "Gender", 
        field: "gender", 
        editable: true, 
        cellEditor: "agSelectCellEditor", // Enables dropdown selection
        cellEditorParams: {
          values: ["Male", "Female"] // Dropdown options
        }
      },
      {
        headerName: "Company",
        field: "company",
        editable: true,
        filter: "agSetColumnFilter",
        cellEditor: "agSelectCellEditor", // Enables dropdown selection
        cellEditorParams: {
          values: ["Bean", "Code9", "IDA"] // Dropdown options
        },
        valueGetter: (params) => params.data?.company,
        valueSetter: (params) => {
          params.data.company = params.newValue;
          return true;
        },
      },
      {
        headerName: "Visa Type",
        field: "visaType",
        editable: true,
        filter: "agSetColumnFilter",
        cellEditor: "agSelectCellEditor", // Enables dropdown selection
        cellEditorParams: {
          values: ["Cap", "H1B-Transfer"] // Dropdown options
        },
        valueGetter: (params) => params.data?.visaType,
        valueSetter: (params) => {
          params.data.visaType = params.newValue;
          return true;
        },
      },
      {
        headerName: "Year",
        field: "year",
        editable: true,
        filter: "agSetColumnFilter",
        valueGetter: (params) => params.data?.year,
        valueSetter: (params) => {
          params.data.year = params.newValue;
          return true;
        },
      },
      { 
        headerName: "Status", 
        field: "status", 
        editable: true, 
        cellEditor: "agSelectCellEditor", // Enables dropdown selection
        cellEditorParams: {
          values: ["Submitted","Waiting on 129 Approval","Petition Approved",
            "Yet to Book Slot"," Visa Slot Booked", "221G","In USA","Visa Not Needed","Visa Approved","Archived"] // Dropdown options
        }
      },
      { 
        headerName: "Current Location", 
        field: "currentLocation", 
        editable: true, 
        cellEditor: "agSelectCellEditor",
        cellEditorParams: {
          values: ["UK", "India", "NZ", "USA"] // Dropdown options
        }
      },
      {
        headerName: "Referred By",
        field: "referredBy",
        editable: true,
        filter: "agSetColumnFilter",
        valueGetter: (params) => params.data?.referredBy,
        valueSetter: (params) => {
          params.data.referredBy = params.newValue;
          return true;
        },
      },
      {
        headerName: "Email",
        field: "emailId",
        editable: true,
        filter: "agSetColumnFilter" ,
        cellClassRules: {
          blueUnderline: (params) => params.colDef.field === "emailId"
        },
        valueGetter: (params) => params.data?.emailId,
        valueSetter: (params) => {
          params.data.emailId = params.newValue;
          return true;
        },
      },
      {
        headerName: "Phone",
        field: "phone",
        editable: true,
        filter: "agSetColumnFilter",
        valueGetter: (params) => params.data?.phone,
        valueSetter: (params) => {
          params.data.phone = params.newValue;
          return true;
        },
      },
      {
        headerName: "DOB",
        field: "dob",
        editable: true,
        filter: "agSetColumnFilter",
        valueFormatter: (params) => formatDateMDY(params.value),
        valueGetter: (params) => params.data?.dob,
        valueSetter: (params) => {
          params.data.dob = params.newValue;
          return true;
        },
        filterParams: { treeList: false, valueFormatter: (params) => formatDateMDY(params.value) },
      },
      {
        headerName: "Primary Skills",
        field: "primarySkills",
        editable: true,
        filter: "agSetColumnFilter",
        valueGetter: (params) => params.data?.primarySkills,
        valueSetter: (params) => {
          params.data.primarySkills = params.newValue;
          return true;
        },
      },
      {
        headerName: "Secondary Skills",
        field: "secondarySkills",
        editable: true,
        filter: "agSetColumnFilter",
        valueGetter: (params) => params.data?.secondarySkills,
        valueSetter: (params) => {
          params.data.secondarySkills = params.newValue;
          return true;
        },
      },
      {
        headerName: "Work Country",
        field: "workCountry",
        editable: true,
        filter: "agSetColumnFilter",
        valueGetter: (params) => params.data?.workCountry,
        valueSetter: (params) => {
          params.data.workCountry = params.newValue;
          return true;
        },
      },
      {
        headerName: "Start Date",
        field: "startDate",
        editable: true,
        filter: "agSetColumnFilter",
        valueFormatter: (params) => formatDateMDY(params.value),
        valueGetter: (params) => params.data?.startDate,
        valueSetter: (params) => {
          params.data.startDate = params.newValue;
          return true;
        },
        filterParams: { treeList: false, valueFormatter: (params) => formatDateMDY(params.value) },
      },
      {
        headerName: "End Date",
        field: "endDate",
        editable: true,
        filter: "agSetColumnFilter",
        valueFormatter: (params) => formatDateMDY(params.value),
        valueGetter: (params) => params.data?.endDate,
        valueSetter: (params) => {
          params.data.endDate = params.newValue;
          return true;
        },
        filterParams: { treeList: false, valueFormatter: (params) => formatDateMDY(params.value) },
      },
      {
        colId: "action",
        headerName: "Action",
        pinned: "right",
        sortable: false,
        filter: false,
        editable: false,
        cellRenderer: (params) => {
          if (!params.data) return null;
          return (
            <NotesActionButton
              onOpenNotes={() => setNoteModalRow(params.data)}
              extraActions={buildRowActions({
                onArchive: () => handleArchivePotentialEmployee(params.data),
                onDelete: () => handleDeletePotentialEmployee(params.data),
                entityType: "PotentialEmployee",
                entityId: params.data.peId,
                entityLabel: `${params.data.firstName || ""} ${params.data.lastName || ""}`.trim(),
              })}
            />
          );
        },
      },
    ];
    return columns;
};


  // Capture edited rows
  const onCellEditingStopped = (event) => {
    const updatedRow = event.data;
    setUpdatedRows((prevRows) => {
      const existingRowIndex = prevRows.findIndex((row) => row.id === updatedRow.id);
      if (existingRowIndex !== -1) {
        prevRows[existingRowIndex] = updatedRow;
        return [...prevRows];
      }
      return [...prevRows, updatedRow];
    });
  };

  // Save edited rows to backend
  const saveUpdatedRows = async () => {
    if (updatedRows.length === 0) {
      notification.info({ message: "No changes to save" });
      return;
    }

    try {
      const response = await fetch(API_ENDPOINTS.savePotentialEmployees, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedRows),
      });

      if (response.ok) {
        notification.success({ message: "Changes saved successfully!" });
        fetchPotentialEmployees(); // Refresh data after saving
        setUpdatedRows([]); // Clear updated rows
      } else {
        throw new Error("Failed to save changes");
      }
    } catch (error) {
      console.error("Error saving data:", error);
      notification.error({ message: "Error saving changes. Try again." });
    }
  };

  const filterData = () => {
    if (!searchText) return rowData;
    return rowData.filter((row) =>
      Object.values(row).some((value) =>
        String(value).toLowerCase().includes(searchText.toLowerCase())
      )
    );
  };

   const onBtnExportDataAsExcel = useCallback(() => {
      if (gridRef.current) {
        gridRef.current.exportDataAsExcel();
      }
    }, []);
  
  const handleCloseDrawer = (action) => {
    setOpen(false);
    if (action === "submit") fetchPotentialEmployees();
  };

  // sizeColumnsForHeader returns a brand-new array/objects every call; memoize
  // it so AG Grid doesn't see a new columnDefs reference (and reset each
  // column's applied filter) on every re-render.
  const sizedColumnDefs = useMemo(() => sizeColumnsForHeader(getColumnsDefList()), []);

  return (
    <div
        style={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden", 
        }}
      >
    <div className="ag-theme-alpine project-List-grid">
    <Card className="employeeTableCard" style={{ height: "100%" }}>
      <Drawer title="Customer Onboarding" placement="right" size="large" onClose={handleCloseDrawer} open={open}>
        <NewPotentialEmployee onClose={handleCloseDrawer} />
      </Drawer>

      <GridToolbar className="workforce-search-container">
        <Button
          type="default"
          icon={<ReloadOutlined />}
          onClick={fetchPotentialEmployees}
          style={{ marginRight: "10px" }}
        >
          Refresh
        </Button>
        <input
          type="text"
          placeholder="Search..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
        />
        <Button
      type="default"
      icon={<FileExcelOutlined />}
      onClick={onBtnExportDataAsExcel}
      style={{ marginRight: "10px" }}
    >
      Export to Excel
    </Button>
        <Button type="primary" onClick={() => setOpen(true)} style={{ marginRight: "10px" }}>
          <PlusOutlined /> Add New Employee
        </Button>
        {updatedRows.length > 0 && (
          <Button type="primary" ghost icon={<SaveOutlined />} onClick={saveUpdatedRows}>
            Save Changes
          </Button>
        )}
      </GridToolbar>
      <div className= "pemployee-grid-wrapper">
      <AgGridReact
        getContextMenuItems={getCellCopyContextMenuItems}
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
        columnDefs={sizedColumnDefs}
        domLayout="normal"
        pagination={true}
        paginationPageSize={100}
        paginationPageSizeSelector={[100,200, 300]}
        onCellEditingStopped={onCellEditingStopped}
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
        enableBrowserTooltips={true} 
        popupParent={document.body}  
        excelStyles={excelStyles}       
      />
      </div>
    </Card>
    </div>
    <NotesModal
      open={!!noteModalRow}
      entityType="PotentialEmployee"
      entityId={noteModalRow?.peId}
      title={noteModalRow ? `${noteModalRow.firstName || ""} ${noteModalRow.lastName || ""}`.trim() : ""}
      onClose={() => setNoteModalRow(null)}
    />
    </div>
  );
};

export default PotentialEmployees;
