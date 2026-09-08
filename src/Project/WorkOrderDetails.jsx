import React, { useState, useEffect, useRef } from "react";
import { AgGridReact } from "@ag-grid-community/react";
import "@ag-grid-community/styles/ag-grid.css";
import "./ProjectGrid.css";
import { sizeColumnsForHeader } from "../Utils/agGridColumnSizing";
import { PlusOutlined, ReloadOutlined, SaveOutlined, CloseOutlined, FilePdfOutlined, PlusCircleOutlined } from "@ant-design/icons";
import { Button, Drawer, Modal } from "antd";
import axios from "axios";
import API_ENDPOINTS from "../config";
import "@ag-grid-community/styles/ag-theme-alpine.css";
import WorkOrderForm from "./WorkOrderForm";
import { formatCurrency } from "../Utils/CurrencyFormatter";
import { formatDateMDY } from "../Utils/dateFormat";
import "./WorkOrderDetails.css";
import DocumentsPanel from "../Documents/DocumentsPanel";
import { openDocumentInNewTab } from "../Documents/openDocument";
import GridToolbar from "../Utils/GridToolbar";
const WorkOrderDetails = ({ rowData, isCollapsed, onRefresh }) => {
  console.log(rowData);
  //  const [rowData, setRowData] = useState();
  const [responseData, setResponseData] = useState();
  const [searchText, setSearchText] = useState("");
  const [modifiedRows, setModifiedRows] = useState({});
  // Which work orders already have a Purchase Order (and which document,
  // so the PDF icon can open it directly) — one call for the whole grid
  // (see DocumentController#list, entityId omitted) instead of one per row.
  const [poDocByWageId, setPoDocByWageId] = useState({});
  const [poModalWageId, setPoModalWageId] = useState(null);

  const fetchPoDocuments = () => {
    axios
      .get(API_ENDPOINTS.getAllDocumentsForType("WorkOrderPO"))
      .then(({ data }) => {
        const byWageId = {};
        (data || []).forEach((doc) => {
          if (!byWageId[doc.entityId] || doc.id > byWageId[doc.entityId].id) {
            byWageId[doc.entityId] = doc;
          }
        });
        setPoDocByWageId(byWageId);
      })
      .catch(() => setPoDocByWageId({}));
  };

  useEffect(fetchPoDocuments, []);

  const onCellValueChanged = (params) => {
    const wageId = params.data?.wageId;
    if (wageId === undefined || wageId === null) return;
    setModifiedRows((prev) => ({ ...prev, [wageId]: params.data }));
  };

  const handleSaveChanges = () => {
    const rows = Object.values(modifiedRows);
    if (rows.length === 0) return;
    const requests = rows.map((row) =>
      axios.put(API_ENDPOINTS.wagesById(row.wageId), {
        wage: row.wage,
        startDate: row.startDate,
        endDate: row.endDate,
      }),
    );
    Promise.all(requests)
      .then(() => {
        setModifiedRows({});
        onRefresh?.();
      })
      .catch((error) => {
        console.error("Error saving work order changes:", error);
      });
  };

  const handleCancelChanges = () => {
    setModifiedRows({});
    onRefresh?.();
  };

  const addNewProject = () => {
    setOpen(true);
  };

  const onClose = () => {
    setOpen(false);
    onRefresh?.();
    fetchPoDocuments();
  };

  const [open, setOpen] = useState(false);

  useEffect(() => {
    console.log("rowData:", rowData);
    setResponseData(rowData);
  }, [rowData]);

  const getFlattenedData = (data) => {
    let updatedData = data.map((dataObj) => {
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
      { headerName: "Wage Id", field: "wageId" },
      {
        headerName: "Wage Type",
        field: "wageType",
        sortable: isSortable,
        editable: false,
        filter: "agSetColumnFilter",
      },
      {
        headerName: "Bill Rate",
        field: "wage",
        sortable: isSortable,
        editable: true,
        filter: "agSetColumnFilter",
        valueFormatter: (params) => formatCurrency(params.value),
      },
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
      // { headerName: 'Wage', field: 'wage', sortable: isSortable, editable: true, filter: 'agTextColumnFilter' },
      {
        headerName: "PO",
        field: "purchaseOrder",
        sortable: false,
        filter: false,
        editable: false,
        cellRenderer: (params) => {
          if (!params.data) return null;
          const doc = poDocByWageId[params.data.wageId];
          return (
            <Button
              type="text"
              icon={doc ? <FilePdfOutlined style={{ color: "#e64a3b" }} /> : <PlusCircleOutlined />}
              title={doc ? "Open Purchase Order" : "Add Purchase Order"}
              onClick={() =>
                doc ? openDocumentInNewTab(doc.id) : setPoModalWageId(params.data.wageId)
              }
            />
          );
        },
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
          <Drawer
            title={`Create New WorkOrder`}
            placement="right"
            size="large"
            onClose={onClose}
            open={open}
          >
            <WorkOrderForm onClose={onClose} />
          </Drawer>
          <Button
            type="primary"
            className="button-customer"
            onClick={addNewProject}
          >
            <PlusOutlined /> Add New WorkOrder
          </Button>
          {Object.keys(modifiedRows).length > 0 && (
            <>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                onClick={handleSaveChanges}
                style={{ marginLeft: "10px" }}
              >
                Save
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
        <div  className={`workOrder-grid-wrapper ${!isCollapsed ? "ag-grid-collapsed" : "ag-grid-expanded"}`}>
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
          domLayout="normal"
          defaultColDef={{
            minWidth: 100,
            maxWidth: 220,
            resizable: true,
            filter: false,
            floatingFilter: false,
            cellClassRules: {
              darkGreyBackground: (params) => params.node?.rowIndex !== undefined && params.node.rowIndex % 2 === 0,
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
          pagination={true}        
          paginationPageSize={100}
          paginationPageSizeSelector={[100,200, 300]}
          enableBrowserTooltips={true} 
          popupParent={document.body} 
        />
        </div>
      </div>
      </div>
      <Modal
        title="Purchase Order"
        open={poModalWageId !== null}
        onCancel={() => {
          setPoModalWageId(null);
          fetchPoDocuments();
        }}
        footer={null}
      >
        {poModalWageId !== null && (
          <DocumentsPanel entityType="WorkOrderPO" entityId={poModalWageId} />
        )}
      </Modal>
    </>
  );
};

export default WorkOrderDetails;
