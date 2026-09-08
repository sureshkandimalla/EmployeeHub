import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { AgGridReact } from "@ag-grid-community/react";
import { Card, Button, Drawer, Modal, message } from "antd";
import { PlusOutlined, FileExcelOutlined, ReloadOutlined, SaveOutlined, CloseOutlined } from "@ant-design/icons";
import axios from "axios";
import { Link, useLocation } from "react-router-dom";
import "ag-grid-enterprise";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import "./Customer.css";
import NewCustomer from "./NewCustomer";
import API_ENDPOINTS, {
  currencyList,
  msaStatusList,
  billingMethodList,
  paymentTermsList,
} from "../config";
import { sizeColumnsForHeader } from "../Utils/agGridColumnSizing";
import { formatDateMDY } from "../Utils/dateFormat";
import GridToolbar from "../Utils/GridToolbar";
import NotesActionButton from "../Notes/NotesActionButton";
import NotesModal from "../Notes/NotesModal";
import { buildRowActions } from "../Notes/rowActions";

const columnsList = [
  { headerName: "Customer Id", field: "customerId", type: "number" },
  { headerName: "Name", field: "customerCompanyName", type: "text" },
  { headerName: "Email", field: "customerEmail", type: "text" },
  { headerName: "Phone", field: "customerPhone", type: "text" },
  { headerName: "Parent Company", field: "parentCompany", type: "text" },
  { headerName: "Billing Contact", field: "billingContact", type: "text" },
  { headerName: "Accounts Payable Contact", field: "apContact", type: "text" },
  { headerName: "MSA Status", field: "msaStatus", type: "select", options: msaStatusList },
  { headerName: "Status", field: "customerStatus", type: "text" },
  { headerName: "Customer Contact Email", field: "customerContactEmail", type: "text" },
  { headerName: "Customer Type", field: "customerType", type: "text" },
  { headerName: "Customer Address", field: "customerAddress", type: "text" },
  { headerName: "ein", field: "ein", type: "text" },
  { headerName: "Website", field: "website", type: "text" },
  { headerName: "Start Date", field: "customerStartDate", type: "date" },
  { headerName: "End Date", field: "customerEndDate", type: "date" },
  { headerName: "Credit Limit", field: "creditLimit", type: "number" },
  { headerName: "Standard Currency", field: "standardCurrency", type: "select", options: currencyList },
  { headerName: "Default Billing Method", field: "defaultBillingMethod", type: "select", options: billingMethodList },
  { headerName: "Payment Terms", field: "paymentTerms", type: "select", options: paymentTermsList },
  { headerName: "Notes", field: "notes", type: "text" },
  { headerName: "Customer Name", field: "customerName", type: "text" },
  { headerName: "Last Updated", field: "lastUpdated", type: "date" },
];

// Mirrors the exact predicates CustomerDashboard.jsx uses to compute its
// feed card counts, so "Review all" always lands on a grid whose row count
// matches the number shown on the card it was clicked from.
const DAY_MS = 24 * 60 * 60 * 1000;
const DASHBOARD_FILTER_LABELS = { active: "Active", msaPending: "MSA Pending", expiring: "Expiring in 90 Days" };
const matchesDashboardFilter = (customer, dashboardFilter) => {
  if (!dashboardFilter) return true;
  if (dashboardFilter === "active") return customer.customerStatus === "Active";
  if (dashboardFilter === "msaPending") return customer.msaStatus === "Pending";
  if (dashboardFilter === "expiring") {
    if (!customer.customerEndDate) return false;
    const [y, m, d] = customer.customerEndDate.split("-").map(Number);
    if (!y || !m) return false;
    const end = new Date(y, m - 1, d || 1);
    const today = new Date();
    const in90Days = new Date(today.getTime() + 90 * DAY_MS);
    return end >= today && end <= in90Days;
  }
  return true;
};

const CustomerDetails = () => {
  const gridRef = useRef(null);
  const location = useLocation();
  const [searchText, setSearchText] = useState("");
  const [rowData, setRowData] = useState([]);
  const [open, setOpen] = useState(false);
  const [modifiedRows, setModifiedRows] = useState({});
  const [dashboardFilter, setDashboardFilter] = useState(location.state?.dashboardFilter || null);
  const [noteModalRow, setNoteModalRow] = useState(null);

  // Re-syncs if the user navigates here again with a different card's
  // filter while the component is already mounted (e.g. via back/forward).
  useEffect(() => {
    if (location.state?.dashboardFilter) setDashboardFilter(location.state.dashboardFilter);
  }, [location.state]);

  const onCellValueChanged = (params) => {
    const customerId = params.data?.customerId;
    if (customerId === undefined || customerId === null) return;
    setModifiedRows((prev) => ({ ...prev, [customerId]: params.data }));
  };

  const handleSaveChanges = () => {
    const rows = Object.values(modifiedRows);
    if (rows.length === 0) return;
    Promise.all(rows.map((row) => axios.put(API_ENDPOINTS.customersById(row.customerId), row)))
      .then(() => {
        setModifiedRows({});
        fetchData();
      })
      .catch((error) => {
        console.error("Error saving customer changes:", error);
      });
  };

  const handleCancelChanges = () => {
    setModifiedRows({});
    fetchData();
  };

  const fetchData = () => {
    fetch(API_ENDPOINTS.getAllCustomers)
      .then((response) => response.json())
      .then((data) => {
        setRowData(getFlattenedData(data));
      })
      .catch((error) => console.error("Error fetching data:", error));
  };

  const handleArchiveCustomer = (row) => {
    axios
      .put(API_ENDPOINTS.customersById(row.customerId), { ...row, customerStatus: "Archived" })
      .then(() => {
        message.success("Customer archived");
        fetchData();
      })
      .catch(() => message.error("Failed to archive customer. Please try again."));
  };

  const handleDeleteCustomer = (row) => {
    Modal.confirm({
      title: `Delete "${row.customerCompanyName || row.customerId}"?`,
      content: "This permanently removes this customer record. This can't be undone.",
      okText: "Delete",
      okType: "danger",
      cancelText: "Cancel",
      onOk: () =>
        axios
          .delete(API_ENDPOINTS.deleteCustomer(row.customerId))
          .then(() => {
            message.success("Customer deleted");
            fetchData();
          })
          .catch(() => message.error("Failed to delete customer. It may still be referenced elsewhere (projects, invoices, etc.).")),
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

      const isIdColumn = field === "customerId";
      const isSelect = type === "select";
      const autoWidth = type === "date" || field === "customerStatus" || isIdColumn ? 145 : 170;

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
          blueUnderline: (params) => params.colDef.field === "customerEmail",
          centerAlign: (params) => params.colDef.field === "customerId",
        },
        cellClass: isIdColumn ? "ag-center-cols" : undefined,
        cellStyle: isIdColumn ? { textAlign: "center" } : undefined,
        valueFormatter: type === "date" ? (params) => formatDateMDY(params.value) : undefined,
        cellRenderer:
          field === "customerCompanyName"
            ? (params) => (
                <Link to="/customerFullDetails" state={{ rowData: params.data }}>
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

  const addNewCustomer = () => {
    setOpen(true);
  };

  // Left-nav "Create > Customers > Customer" links here with ?new=1 to
  // land straight on the add-customer drawer instead of just the grid.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("new") === "1") {
      setOpen(true);
    }
  }, []);

  const onClose = () => {
    setOpen(false);
  };

  // compute columnDefs once per rowData change
  const customerColumnDefs = useMemo(() => {
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
                onArchive: () => handleArchiveCustomer(params.data),
                onDelete: () => handleDeleteCustomer(params.data),
                entityType: "Customer",
                entityId: params.data.customerId,
                entityLabel: params.data.customerCompanyName,
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
      const base = Array.isArray(customerColumnDefs) ? [...customerColumnDefs] : [];
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
      return customerColumnDefs;
    }
  }, [customerColumnDefs, rowData]);

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <div className="ag-theme-alpine customer-List-grid">
      <Card style={{ height: "100%", marginBottom: 0, display: "flex", flexDirection: "column" }} styles={{ body: { flex: 1, minHeight: 0, display: "flex", flexDirection: "column" } }}>
        <Drawer
          title={`Customer Onboarding`}
          placement="right"
          size="large"
          onClose={onClose}
          open={open}
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
            className="button-customer"
            onClick={addNewCustomer}
            style={{ marginLeft: "10px" }}
          >
            <PlusOutlined /> Add New Customer
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
        <div className="customer-grid-wrapper" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
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
        entityType="Customer"
        entityId={noteModalRow?.customerId}
        title={noteModalRow?.customerCompanyName}
        onClose={() => setNoteModalRow(null)}
      />
    </div>
  );
};

export default CustomerDetails;
