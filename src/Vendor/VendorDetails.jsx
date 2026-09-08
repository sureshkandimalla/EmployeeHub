import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { AgGridReact } from "@ag-grid-community/react";
import { Card, Button, Drawer, Modal, message } from "antd";
import { PlusOutlined, FileExcelOutlined, ReloadOutlined, SaveOutlined, CloseOutlined } from "@ant-design/icons";
import axios from "axios";
import { Link, useLocation } from "react-router-dom";
import "ag-grid-enterprise";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import "./Vendor.css";
import NewVendor from "./NewVendor";
import API_ENDPOINTS, { vendorTypeList, vendorStatusList, paymentTermsList } from "../config";
import { sizeColumnsForHeader } from "../Utils/agGridColumnSizing";
import { formatDateMDY } from "../Utils/dateFormat";
import NotesActionButton from "../Notes/NotesActionButton";
import NotesModal from "../Notes/NotesModal";
import { buildRowActions } from "../Notes/rowActions";
import GridToolbar from "../Utils/GridToolbar";

const columnsList = [
  { headerName: "Vendor Id", field: "vendorId", type: "number" },
  { headerName: "Name", field: "vendorCompanyName", type: "text" },
  { headerName: "Email", field: "vendorEmail", type: "text" },
  { headerName: "Phone", field: "vendorPhone", type: "text" },
  { headerName: "Vendor Type", field: "vendorType", type: "select", options: vendorTypeList },
  { headerName: "Status", field: "vendorStatus", type: "select", options: vendorStatusList },
  { headerName: "ein", field: "ein", type: "text" },
  { headerName: "Website", field: "website", type: "text" },
  { headerName: "Start Date", field: "vendorStartDate", type: "date" },
  { headerName: "End Date", field: "vendorEndDate", type: "date" },
  { headerName: "Payment Terms", field: "paymentTerms", type: "select", options: paymentTermsList },
  { headerName: "Payment Policy", field: "paymentPolicy", type: "text" },
];

// Mirrors the exact predicates VendorDashboard.jsx uses to compute its feed
// card counts, so "Review all" always lands on a grid whose row count
// matches the number shown on the card it was clicked from.
const DAY_MS = 24 * 60 * 60 * 1000;
const DASHBOARD_FILTER_LABELS = { active: "Active", pending: "Pending", expiring: "Expiring in 90 Days" };
const matchesDashboardFilter = (vendor, dashboardFilter) => {
  if (!dashboardFilter) return true;
  if (dashboardFilter === "active") return vendor.vendorStatus === "Active";
  if (dashboardFilter === "pending") return vendor.vendorStatus === "Pending";
  if (dashboardFilter === "expiring") {
    if (!vendor.vendorEndDate) return false;
    const [y, m, d] = vendor.vendorEndDate.split("-").map(Number);
    if (!y || !m) return false;
    const end = new Date(y, m - 1, d || 1);
    const today = new Date();
    const in90Days = new Date(today.getTime() + 90 * DAY_MS);
    return end >= today && end <= in90Days;
  }
  return true;
};

const VendorDetails = () => {
  const gridRef = useRef(null);
  const location = useLocation();
  const [searchText, setSearchText] = useState("");
  const [rowData, setRowData] = useState([]);
  const [dashboardFilter, setDashboardFilter] = useState(location.state?.dashboardFilter || null);

  useEffect(() => {
    if (location.state?.dashboardFilter) setDashboardFilter(location.state.dashboardFilter);
  }, [location.state]);
  const [open, setOpen] = useState(false);
  const [modifiedRows, setModifiedRows] = useState({});
  const [noteModalRow, setNoteModalRow] = useState(null);

  const onCellValueChanged = (params) => {
    const vendorId = params.data?.vendorId;
    if (vendorId === undefined || vendorId === null) return;
    setModifiedRows((prev) => ({ ...prev, [vendorId]: params.data }));
  };

  const handleSaveChanges = () => {
    const rows = Object.values(modifiedRows);
    if (rows.length === 0) return;
    Promise.all(rows.map((row) => axios.put(API_ENDPOINTS.vendorsById(row.vendorId), row)))
      .then(() => {
        setModifiedRows({});
        fetchData();
      })
      .catch((error) => {
        console.error("Error saving vendor changes:", error);
      });
  };

  const handleCancelChanges = () => {
    setModifiedRows({});
    fetchData();
  };

  const fetchData = () => {
    fetch(API_ENDPOINTS.getAllVendors)
      .then((response) => response.json())
      .then((data) => {
        setRowData(getFlattenedData(data));
      })
      .catch((error) => console.error("Error fetching data:", error));
  };

  const handleArchiveVendor = (row) => {
    axios
      .put(API_ENDPOINTS.vendorsById(row.vendorId), { ...row, vendorStatus: "Archived" })
      .then(() => {
        message.success("Vendor archived");
        fetchData();
      })
      .catch(() => message.error("Failed to archive vendor. Please try again."));
  };

  const handleDeleteVendor = (row) => {
    Modal.confirm({
      title: `Delete "${row.vendorCompanyName || row.vendorId}"?`,
      content: "This permanently removes this vendor record. This can't be undone.",
      okText: "Delete",
      okType: "danger",
      cancelText: "Cancel",
      onOk: () =>
        axios
          .delete(API_ENDPOINTS.deleteVendor(row.vendorId))
          .then(() => {
            message.success("Vendor deleted");
            fetchData();
          })
          .catch(() => message.error("Failed to delete vendor. It may still be referenced elsewhere (assignments, etc.).")),
    });
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getFlattenedData = (data) => {
    let updatedData = data.map((dataObj) => {
      return { ...dataObj };
    });
    return updatedData || [];
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
        color: "#000000",
      },
    },
    {
      id: "blueUnderline",
      font: {
        fontName: "Calibri Light",
        color: "#0000EE",
      },
    },
  ];

  const getColumnsDefList = (columnsList, isSortable) => {
    return columnsList.map(({ headerName, field, type, options }) => {
      // Every column uses the checkbox/select-values Set Filter — kept
      // consistent across every grid in the app rather than per-type
      // filter widgets (contains/equals/etc.).
      const columnFilter = "agSetColumnFilter";

      const isIdColumn = field === "vendorId";
      const isSelect = type === "select";
      const autoWidth = type === "date" || field === "vendorStatus" || isIdColumn ? 145 : 170;

      return {
        headerName,
        field,
        sortable: isSortable,
        editable: true,
        cellEditor: isSelect ? "agSelectCellEditor" : undefined,
        cellEditorParams: isSelect ? { values: options.map((o) => o.value) } : undefined,
        headerClass: isIdColumn ? "ag-center-cols" : "ag-header-cell",
        filter: columnFilter,
        minWidth: autoWidth,
        suppressSizeToFit: true,
        tooltipValueGetter: (params) => params.value,
        cellClassRules: {
          darkGreyBackground: (params) =>
            params.node?.rowIndex !== undefined && params.node.rowIndex % 2 === 1,
          blueUnderline: (params) => params.colDef.field === "vendorEmail",
          centerAlign: (params) => params.colDef.field === "vendorId",
        },
        cellClass: isIdColumn ? "ag-center-cols" : undefined,
        cellStyle: isIdColumn ? { textAlign: "center" } : undefined,
        valueFormatter: type === "date" ? (params) => formatDateMDY(params.value) : undefined,
        cellRenderer:
          field === "vendorCompanyName"
            ? (params) => (
                <Link to="/vendorFullDetails" state={{ rowData: params.data }}>
                  {params.value}
                </Link>
              )
            : undefined,
        tooltipShowDelay: 0,
      };
    });
  };

  const handleSearchInputChange = (event) => {
    setSearchText(event.target.value);
  };

  const onBtnExportDataAsExcel = useCallback(() => {
    if (gridRef.current) {
      gridRef.current.exportDataAsExcel();
    }
  }, []);

  const filterData = () => {
    const source = Array.isArray(rowData) ? rowData : [];
    const dashboardFiltered = dashboardFilter
      ? source.filter((row) => matchesDashboardFilter(row, dashboardFilter))
      : source;
    if (!searchText) {
      return dashboardFiltered;
    }

    return dashboardFiltered.filter((row) =>
      Object.values(row || {}).some((value) =>
        String(value).toLowerCase().includes(searchText.toLowerCase()),
      ),
    );
  };

  const addNewVendor = () => {
    setOpen(true);
  };

  // Left-nav "Create > Vendors > Vendor" links here with ?new=1 to land
  // straight on the add-vendor drawer instead of just the grid.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("new") === "1") {
      setOpen(true);
    }
  }, []);

  const onClose = () => {
    setOpen(false);
  };

  // compute columnDefs once per rowData change
  const vendorColumnDefs = useMemo(() => {
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
          darkGreyBackground: (params) =>
            params.node?.rowIndex !== undefined && params.node.rowIndex % 2 === 1,
        },
      },
      ...getColumnsDefList(columnsList, true),
      {
        colId: "action",
        headerName: "Action",
        pinned: "right",
        sortable: false,
        filter: false,
        editable: false,
        suppressSizeToFit: true,
        cellClassRules: {
          darkGreyBackground: (params) =>
            params.node?.rowIndex !== undefined && params.node.rowIndex % 2 === 1,
        },
        cellRenderer: (params) => {
          if (!params.data) return null;
          return (
            <NotesActionButton
              onOpenNotes={() => setNoteModalRow(params.data)}
              extraActions={buildRowActions({
                onArchive: () => handleArchiveVendor(params.data),
                onDelete: () => handleDeleteVendor(params.data),
                entityType: "Vendor",
                entityId: params.data.vendorId,
                entityLabel: params.data.vendorCompanyName,
              })}
            />
          );
        },
      },
    ];
  }, [rowData]);

  // Append any additional fields present in service response that are not in the default columns
  const combinedColumnDefs = useMemo(() => {
    try {
      const base = Array.isArray(vendorColumnDefs) ? [...vendorColumnDefs] : [];
      if (!Array.isArray(rowData) || rowData.length === 0) return base;
      const sample = rowData[0] || {};
      const existingFields = new Set(base.map((c) => c.field).filter(Boolean));
      const extraKeys = Object.keys(sample).filter((k) => {
        if (existingFields.has(k) || k.startsWith("__")) return false;
        const v = sample[k];
        return v === null || ["string", "number", "boolean"].includes(typeof v);
      });
      const extras = extraKeys.map((k) => ({
        headerName: k.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase()),
        field: k,
        sortable: true,
        filter: "agSetColumnFilter",
        resizable: true,
        minWidth: 120,
        cellClassRules: {
          darkGreyBackground: (params) =>
            params.node?.rowIndex !== undefined && params.node.rowIndex % 2 === 1,
        },
      }));
      return [...base, ...extras];
    } catch (e) {
      return vendorColumnDefs;
    }
  }, [vendorColumnDefs, rowData]);

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <div className="ag-theme-alpine vendor-List-grid">
      <Card style={{ height: "100%", marginBottom: 0, display: "flex", flexDirection: "column" }} styles={{ body: { flex: 1, minHeight: 0, display: "flex", flexDirection: "column" } }}>
        <Drawer
          title={`Vendor Onboarding`}
          placement="right"
          size="large"
          onClose={onClose}
          open={open}
        >
          <NewVendor />
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
            type="default"
            icon={<FileExcelOutlined />}
            onClick={onBtnExportDataAsExcel}
            style={{ marginLeft: "10px" }}
          >
            Export to Excel
          </Button>
          {dashboardFilter && (
            <span
              style={{
                marginLeft: 10,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                background: "#e6f4ff",
                color: "#1677ff",
                padding: "4px 10px",
                borderRadius: 16,
                fontSize: 13,
              }}
            >
              Filter: {DASHBOARD_FILTER_LABELS[dashboardFilter]}
              <CloseOutlined style={{ cursor: "pointer", fontSize: 11 }} onClick={() => setDashboardFilter(null)} />
            </span>
          )}
          <Button
            type="primary"
            className="button-vendor"
            onClick={addNewVendor}
            style={{ marginLeft: "10px" }}
          >
            <PlusOutlined /> Add New Vendor
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
        <div className="vendor-grid-wrapper" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
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
            onCellValueChanged={onCellValueChanged}
            autoSizeStrategy={{ type: "fitCellContents" }}
            rowHeight={48}
            rowData={filterData()}
            columnDefs={sizeColumnsForHeader(combinedColumnDefs)}
            defaultColDef={{
              resizable: true,
              filter: "agSetColumnFilter",
              minWidth: 100,
              maxWidth: 220,
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
            pagination={true}
            paginationPageSize={100}
            paginationPageSizeSelector={[20, 50, 100]}
            domLayout="normal"
            enableBrowserTooltips={true}
            popupParent={document.body}
            excelStyles={excelStyles}
          />
        </div>
      </Card>
      </div>
      <NotesModal
        open={!!noteModalRow}
        entityType="Vendor"
        entityId={noteModalRow?.vendorId}
        title={noteModalRow?.vendorCompanyName}
        onClose={() => setNoteModalRow(null)}
      />
    </div>
  );
};

export default VendorDetails;
