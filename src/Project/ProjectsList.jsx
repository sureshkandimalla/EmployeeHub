import React, { useState, useEffect, useRef } from "react";
import { sizeColumnsForHeader } from "../Utils/agGridColumnSizing";
import { AgGridReact } from "@ag-grid-community/react";
import { Button, Modal, message } from "antd";
import {
  ReloadOutlined,
  SaveOutlined,
  CloseOutlined,
  ExclamationCircleFilled,
  FilePdfOutlined,
  PlusCircleOutlined,
} from "@ant-design/icons";
import { Link } from "react-router-dom";
import axios from "axios";
import API_ENDPOINTS, { paymentTermsList } from "../config";
import "ag-grid-enterprise";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import "./ProjectList.css";
import {
  INVOICE_TERM_OPTIONS,
  invoiceTermLabel,
  invoiceTermCode,
} from "../Utils/invoiceTerm";
import DocumentsPanel from "../Documents/DocumentsPanel";
import { openDocumentInNewTab } from "../Documents/openDocument";
import NotesActionButton from "../Notes/NotesActionButton";
import NotesModal from "../Notes/NotesModal";
import { buildRowActions } from "../Notes/rowActions";
import GridToolbar from "../Utils/GridToolbar";
import { formatDateMDY } from "../Utils/dateFormat";

const ProjectList = ({ projectsList, isCollapsed, onRefresh }) => {
  console.log(projectsList);
  const gridRef = useRef(null);
  const [searchText, setSearchText] = useState("");
  const [rowData, setRowData] = useState([]);
  const [pinnedBottomRowData, setPinnedBottomRowData] = useState([]);
  const [pinnedTopRowData, setPinnedTopRowData] = useState([]);
  const [modifiedRows, setModifiedRows] = useState({});
  // Purchase Orders live on the work order (Wage), not the project — a
  // project with several work orders has a PO per work order. Here we show
  // the most recent work order's PO as "the" project PO; the WorkOrders tab
  // (WorkOrderDetails.jsx) shows every work order's own PO individually.
  const [poDocByWageId, setPoDocByWageId] = useState({});
  const [poModalWageId, setPoModalWageId] = useState(null);
  const [noteModalRow, setNoteModalRow] = useState(null);

  const handleArchiveProject = (row) => {
    axios
      .put(API_ENDPOINTS.projectsById(row.projectId), { ...row, status: "Archived" })
      .then(() => {
        message.success("Project archived");
        onRefresh?.();
      })
      .catch(() => message.error("Failed to archive project. Please try again."));
  };

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

  // getProjects returns one flattened row per (project, work order) pair, so
  // a multi-work-order project spans several rows here, each with its own
  // wageId. Group them back by projectId and keep the highest wageId (the
  // most recently created work order) as "the" work order for that project.
  const latestWageIdByProject = React.useMemo(() => {
    const byProject = {};
    (rowData || []).forEach((row) => {
      if (!row.projectId || !row.wageId) return;
      if (!byProject[row.projectId] || row.wageId > byProject[row.projectId]) {
        byProject[row.projectId] = row.wageId;
      }
    });
    return byProject;
  }, [rowData]);

  const onCellValueChanged = (params) => {
    const projectId = params.data?.projectId;
    if (projectId === undefined || projectId === null) return;
    setModifiedRows((prev) => ({ ...prev, [projectId]: params.data }));
  };

  const handleSaveChanges = () => {
    const rows = Object.values(modifiedRows);
    if (rows.length === 0) return;
    // Bill Rate / Start Date / End Date shown here actually live on the
    // project's Wage record (not the Project entity itself), so those go to
    // the Wage endpoint; everything else editable goes to the Project one.
    const requests = rows.flatMap((row) => {
      const projectUpdate = axios.put(API_ENDPOINTS.projectsById(row.projectId), row);
      if (!row.wageId) return [projectUpdate];
      const wageUpdate = axios.put(API_ENDPOINTS.wagesById(row.wageId), {
        wage: row.billRate,
        startDate: row.startDate,
        endDate: row.endDate,
      });
      return [projectUpdate, wageUpdate];
    });
    Promise.all(requests)
      .then(() => {
        setModifiedRows({});
        onRefresh?.();
      })
      .catch((error) => {
        console.error("Error saving project changes:", error);
      });
  };

  const handleCancelChanges = () => {
    setModifiedRows({});
    onRefresh?.();
  };

  const doDeleteProject = (projectId) => {
    axios
      .delete(API_ENDPOINTS.projectsById(projectId))
      .then(() => {
        message.success("Project deleted");
        onRefresh?.();
      })
      .catch((error) => {
        console.error("Error deleting project:", error);
        message.error("Failed to delete project. Please try again.");
      });
  };

  const handleDeleteProject = (row) => {
    axios
      .get(API_ENDPOINTS.projectDeletionImpact(row.projectId))
      .then(({ data }) => {
        const { invoices = 0, bills = 0, assignments = 0 } = data || {};
        const hasReferences = invoices > 0 || bills > 0 || assignments > 0;
        Modal.confirm({
          title: `Delete "${row.projectName}"?`,
          icon: <ExclamationCircleFilled />,
          content: hasReferences ? (
            <div>
              <p>This project has:</p>
              <ul>
                {invoices > 0 && <li>{invoices} invoice(s)</li>}
                {bills > 0 && <li>{bills} bill(s)</li>}
                {assignments > 0 && <li>{assignments} assignment(s)</li>}
              </ul>
              <p>Deleting it will permanently delete all of these too. Do you really want to delete it?</p>
            </div>
          ) : (
            "This project has no invoices, bills, or assignments. Are you sure you want to delete it?"
          ),
          okText: "Delete",
          okType: "danger",
          cancelText: "Cancel",
          onOk: () => doDeleteProject(row.projectId),
        });
      })
      .catch((error) => {
        console.error("Error checking project references:", error);
        message.error("Couldn't check what this project references. Please try again.");
      });
  };

  useEffect(() => {
    setRowData((prevState) => (projectsList ? [...projectsList] : prevState));
  }, [projectsList]);

  // Sums the same set of columns the bottom Total row uses, over whatever
  // list of rows is passed in — reused for both the grand total (bottom,
  // every row) and the filtered total (top, only what's currently visible).
  const sumTotals = (rows) => ({
    billRate: rows.reduce((sum, row) => sum + (row.billRate || 0), 0),
    net: rows.reduce((sum, row) => sum + (row.net || 0), 0),
    employeePay: rows.reduce((sum, row) => sum + (row.employeePay || 0), 0),
    expenseExternal: rows.reduce((sum, row) => sum + (row.expenseExternal || 0), 0),
    expenseInternal: rows.reduce((sum, row) => sum + (row.expenseInternal || 0), 0),
  });

  useEffect(() => {
    if (rowData && rowData.length > 0) {
      setPinnedBottomRowData([{ projectName: "Total", ...sumTotals(rowData) }]);
    }
  }, [rowData]);

  // Top pinned row — same totals, but only over rows currently passing both
  // the search box and every AG Grid column filter. onModelUpdated fires
  // whenever the grid's displayed rows change for any reason (rowData prop
  // changing via the search box, a column filter being applied, etc.), so
  // it's the one hook that covers every "filtered" case.
  const updateFilteredTotals = (params) => {
    const visibleRows = [];
    params.api.forEachNodeAfterFilter((node) => {
      if (node.data) visibleRows.push(node.data);
    });
    const next = visibleRows.length > 0 ? [{ projectName: "Filtered Total", ...sumTotals(visibleRows) }] : [];
    // Setting pinnedTopRowData itself triggers another onModelUpdated, so
    // bail out (same reference) once the computed totals stop changing —
    // otherwise this feeds back into itself forever.
    setPinnedTopRowData((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
  };

  const getColumnsDefList = (isSortable) => {
    var columns = [
      {
        colId: "rowNum",
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
      {
        headerName: "Employee Name",
        field: "employeeName",
        cellRenderer: (params) => {
          // Group rows (e.g. when grouped by another column) have no
          // params.data — just show nothing rather than crashing.
          if (!params.data) return null;
          const rowData = params.data;
          return (
            <Link to="/employeeFullDetails" state={{ rowData }}>
              {" "}
              {rowData.employeeName}{" "}
            </Link>
          );
        },
        sortable: isSortable,
        editable: false,
        filter: "agSetColumnFilter",
      },
      {
        headerName: "Project Name",
        field: "projectName",
        cellRenderer: (params) => {
          // Group rows (e.g. when grouped by another column) have no
          // params.data — just show nothing rather than crashing.
          if (!params.data) return null;
          const rowData = params.data;
          return (
            <Link to="/projectFullDetails" state={{ rowData }}>
              {" "}
              {rowData.projectName}
            </Link>
          );
        },
        sortable: isSortable,
        editable: true,
        filter: "agSetColumnFilter",
      },
      {
        headerName: "Customer Name",
        field: "customerName",
        sortable: isSortable,
        editable: false,
        filter: "agSetColumnFilter",
      },
      {
        headerName: "Status",
        field: "status",
        sortable: isSortable,
        editable: true,
        filter: "agSetColumnFilter",
        cellEditor: "agSelectCellEditor",
        cellEditorParams: {
          values: ["Active", "Yet to Start", "Closed", "Inactive", "Archived"],
        },
      },
      {
        headerName: "Payment Term",
        field: "paymentTerm",
        sortable: isSortable,
        editable: true,
        filter: "agSetColumnFilter",
        cellEditor: "agSelectCellEditor",
        cellEditorParams: {
          values: paymentTermsList.map((option) => option.value),
        },
      },
      {
        headerName: "Bill Rate",
        field: "billRate",
        sortable: isSortable,
        editable: true,
        filter: "agSetColumnFilter",
        aggFunc: "sum",
        valueFormatter: (params) =>
          `$${params.value ? params.value.toFixed(2) : "0.00"}`,
      },
      {
        headerName: "Bean Net Internal",
        field: "net",
        sortable: isSortable,
        editable: false,
        filter: "agSetColumnFilter",
        aggFunc: "sum",
        valueFormatter: (params) =>
          `$${params.value ? params.value.toFixed(2) : "0.00"}`,
      },
      {
        headerName: "Employee pay Rate",
        field: "employeePay",
        sortable: isSortable,
        editable: false,
        filter: "agSetColumnFilter",
        aggFunc: "sum",
        valueFormatter: (params) =>
          `$${params.value ? params.value.toFixed(2) : "0.00"}`,
      },
      {
        headerName: "External",
        field: "expenseExternal",
        sortable: isSortable,
        editable: false,
        filter: "agSetColumnFilter",
        aggFunc: "sum",
        valueFormatter: (params) =>
          `$${params.value ? params.value.toFixed(2) : "0.00"}`,
      },
      {
        headerName: "Taxes",
        field: "expenseInternal",
        sortable: isSortable,
        editable: false,
        filter: "agSetColumnFilter",
        aggFunc: "sum",
        valueFormatter: (params) =>
          `$${params.value ? params.value.toFixed(2) : "0.00"}`,
      },
      {
        headerName: "Client",
        field: "clientName",
        sortable: isSortable,
        editable: true,
        filter: "agSetColumnFilter",
        // Backend entity field is "client" (see ProjectController#updateProject),
        // grid/domain field is "clientName" — keep both in sync on edit so the
        // PUT payload (the whole row) carries the key the backend reads.
        valueSetter: (params) => {
          params.data.clientName = params.newValue;
          params.data.client = params.newValue;
          return true;
        },
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
      {
        headerName: "Invoice Terms",
        field: "invoiceTerm",
        sortable: isSortable,
        editable: true,
        filter: "agSetColumnFilter",
        // Backend stores/edits a numeric code; grid always shows/edits the text label.
        valueGetter: (params) => invoiceTermLabel(params.data?.invoiceTerm),
        valueSetter: (params) => {
          params.data.invoiceTerm = invoiceTermCode(params.newValue);
          return true;
        },
        cellEditor: "agSelectCellEditor",
        cellEditorParams: {
          values: INVOICE_TERM_OPTIONS.map((option) => option.label),
        },
      },
      {
        headerName: "Company",
        field: "companyName",
        sortable: isSortable,
        editable: false,
        filter: "agSetColumnFilter",
      },
      {
        headerName: "Project Id",
        field: "projectId",
        sortable: isSortable,
        editable: false,
        filter: "agSetColumnFilter",
      },
      {
        headerName: "Action",
        field: "action",
        sortable: false,
        filter: false,
        editable: false,
        cellRenderer: (params) => {
          // Pinned total rows and group rows have no params.data.
          if (!params.data || params.node.rowPinned) return null;
          return (
            <NotesActionButton
              onOpenNotes={() => setNoteModalRow(params.data)}
              extraActions={buildRowActions({
                onArchive: () => handleArchiveProject(params.data),
                // Keeps the richer deletion-impact-preview confirm dialog
                // (invoices/bills/assignments counts) instead of the plain
                // "are you sure" other grids use — Projects cascade-delete
                // real financial records, so it warrants the extra detail.
                onDelete: () => handleDeleteProject(params.data),
                entityType: "Project",
                entityId: params.data.projectId,
                entityLabel: params.data.projectName,
              })}
            />
          );
        },
      },
      {
        headerName: "PO",
        field: "purchaseOrder",
        sortable: false,
        filter: false,
        editable: false,
        cellRenderer: (params) => {
          if (!params.data || params.node.rowPinned) return null;
          const wageId = latestWageIdByProject[params.data.projectId] ?? params.data.wageId;
          const doc = wageId ? poDocByWageId[wageId] : null;
          return (
            <Button
              type="text"
              icon={doc ? <FilePdfOutlined style={{ color: "#e64a3b" }} /> : <PlusCircleOutlined />}
              title={doc ? "Open Purchase Order" : "Add Purchase Order (latest work order)"}
              disabled={!wageId}
              onClick={() =>
                doc ? openDocumentInNewTab(doc.id) : setPoModalWageId(wageId)
              }
            />
          );
        },
      },
    ];
    return columns;
  };

  const handleSearchInputChange = (event) => {
    setSearchText(event.target.value);
  };

  const filterData = () => {
    if (!searchText) {
      console.log(rowData)
      return rowData;
    }

    return rowData.filter((row) =>
      Object.values(row).some((value) =>
        String(value).toLowerCase().includes(searchText.toLowerCase())
      )
    );
  };
  return (
    <div className="ag-theme-alpine project-List-grid">
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
      <div className={`project-grid-wrapper ${!isCollapsed ? "ag-grid-collapsed" : "ag-grid-expanded"}`}>
        <AgGridReact
          ref={gridRef}
          enableCellTextSelection={true}
          ensureDomOrder={true}
          onGridReady={(params) => {
            gridRef.current = params.api;
          }}
          onCellValueChanged={onCellValueChanged}
          onSortChanged={(params) => params.api.refreshCells({ force: true })}
          onFilterChanged={(params) => params.api.refreshCells({ force: true })}
          onModelUpdated={updateFilteredTotals}
          onFirstDataRendered={(params) => {
            try { params.api.autoSizeAllColumns(); } catch (e) {}
          }}
          autoSizeStrategy={{ type: "fitCellContents" }}
          rowHeight={48}
          rowData={filterData()}
          enableFilter={true}
          columnDefs={sizeColumnsForHeader(getColumnsDefList(true))}
          defaultColDef={{
            minWidth: 100,
            maxWidth: 220,
            resizable: true,
            filter: "agSetColumnFilter",
            enableRowGroup: true,
            headerClass: "ag-header-cell",
            cellClassRules: {
              darkGreyBackground: (params) => params.node?.rowIndex !== undefined && params.node.rowIndex % 2 === 1,
            }
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
          pagination={true}
          paginationPageSize={100}
          paginationPageSizeSelector={[20, 50, 100]}
          domLayout="normal"
          pinnedTopRowData={pinnedTopRowData}
          pinnedBottomRowData={pinnedBottomRowData}
          enableBrowserTooltips={true}
          popupParent={document.body}
        />
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
      <NotesModal
        open={!!noteModalRow}
        entityType="Project"
        entityId={noteModalRow?.projectId}
        title={noteModalRow?.projectName}
        onClose={() => setNoteModalRow(null)}
      />
    </div>
  );
};

export default ProjectList;
