import React, { useState, useEffect, useRef, useMemo } from "react";
import { sizeColumnsForHeader } from "../Utils/agGridColumnSizing";
import { AgGridReact } from "@ag-grid-community/react";
import { Button, Modal, Tooltip } from "antd";
import { ReloadOutlined, SaveOutlined, CloseOutlined, PlusOutlined, DeleteOutlined, FilePdfOutlined } from "@ant-design/icons";
import axios from "axios";
import API_ENDPOINTS from "../config";
import DocumentsPanel from "../Documents/DocumentsPanel";
import { openDocumentInNewTab } from "../Documents/openDocument";
import NotesActionButton from "../Notes/NotesActionButton";
import NotesModal from "../Notes/NotesModal";
import { buildRowActions } from "../Notes/rowActions";
import GridToolbar from "../Utils/GridToolbar";
import { formatDateMDY } from "../Utils/dateFormat";
import "ag-grid-enterprise";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";

const STATUS_OPTIONS = ["Active", "Expired", "InActive", "Invalid", "Archived"];

// Self-fetching, scoped by either customerId or vendorId — mirrors the
// InvoiceDetails/ProjectGrid convention of accepting an optional scoping
// prop and fetching its own data, since Coi has no existing parent list
// page to be fed from.
const CoiGrid = ({ customerId, vendorId, isCollapsed }) => {
  const gridRef = useRef(null);
  const [rowData, setRowData] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [modifiedRows, setModifiedRows] = useState({});
  const [loading, setLoading] = useState(true);
  const [documentsForRow, setDocumentsForRow] = useState(null);
  const [docsByEntityId, setDocsByEntityId] = useState({});
  const [noteModalRow, setNoteModalRow] = useState(null);

  const handleArchive = (row) => {
    const { rowKey, ...payload } = row;
    axios
      .put(API_ENDPOINTS.coiById(row.id), { ...payload, status: "Archived" })
      .then(fetchData)
      .catch(() => {});
  };

  const fetchDocumentIndicators = () => {
    axios
      .get(API_ENDPOINTS.getAllDocumentsForType("COI"))
      .then((res) => {
        const map = {};
        (res.data || []).forEach((doc) => {
          // A row could in theory have more than one attachment — the PDF
          // icon links to just the most recently uploaded one.
          const existing = map[doc.entityId];
          if (!existing || new Date(doc.uploadedDate) > new Date(existing.uploadedDate)) {
            map[doc.entityId] = doc;
          }
        });
        setDocsByEntityId(map);
      })
      .catch(() => setDocsByEntityId({}));
  };

  useEffect(fetchDocumentIndicators, []);

  const fetchData = () => {
    setLoading(true);
    const url = vendorId
      ? API_ENDPOINTS.getCoiForVendor(vendorId)
      : API_ENDPOINTS.getCoiForCustomer(customerId);
    axios
      .get(url)
      .then((res) => setRowData((res.data || []).map((r) => ({ ...r, rowKey: r.id }))))
      .catch(() => setRowData([]))
      .finally(() => setLoading(false));
  };

  useEffect(fetchData, [customerId, vendorId]);

  useEffect(() => {
    axios.get(API_ENDPOINTS.getAllVendors).then((res) => setVendors(res.data || [])).catch(() => setVendors([]));
    axios.get(API_ENDPOINTS.getAllCustomers).then((res) => setCustomers(res.data || [])).catch(() => setCustomers([]));
  }, []);

  const vendorNameById = useMemo(() => {
    const map = {};
    vendors.forEach((v) => (map[v.vendorId] = v.vendorCompanyName));
    return map;
  }, [vendors]);

  const customerNameById = useMemo(() => {
    const map = {};
    customers.forEach((c) => (map[c.customerId] = c.customerCompanyName));
    return map;
  }, [customers]);

  const onCellValueChanged = (params) => {
    const rowKey = params.data?.rowKey;
    if (rowKey === undefined || rowKey === null) return;
    setModifiedRows((prev) => ({ ...prev, [rowKey]: params.data }));
  };

  const handleAddRow = () => {
    const rowKey = `new-${Date.now()}`;
    const newRow = {
      rowKey,
      vendorId: vendorId ? Number(vendorId) : null,
      customerId: customerId ? Number(customerId) : null,
      startDate: null,
      endDate: null,
      status: "Active",
      limits: "",
    };
    setRowData((prev) => [newRow, ...prev]);
    setModifiedRows((prev) => ({ ...prev, [rowKey]: newRow }));
  };

  const handleSaveChanges = () => {
    const rows = Object.values(modifiedRows);
    if (rows.length === 0) return;
    const requests = rows.map((row) => {
      const { rowKey, ...payload } = row;
      return row.id
        ? axios.put(API_ENDPOINTS.coiById(row.id), payload)
        : axios.post(API_ENDPOINTS.createCoi, payload);
    });
    Promise.all(requests)
      .then(() => {
        setModifiedRows({});
        fetchData();
      })
      .catch((error) => console.error("Error saving COI changes:", error));
  };

  const handleCancelChanges = () => {
    setModifiedRows({});
    fetchData();
  };

  const handleDelete = (row) => {
    if (!row.id) {
      setRowData((prev) => prev.filter((r) => r.rowKey !== row.rowKey));
      setModifiedRows((prev) => {
        const next = { ...prev };
        delete next[row.rowKey];
        return next;
      });
      return;
    }
    axios.delete(API_ENDPOINTS.coiById(row.id)).then(fetchData);
  };

  const columnDefs = [
    {
      headerName: "Vendor",
      field: "vendorId",
      editable: true,
      filter: "agSetColumnFilter",
      valueGetter: (params) => vendorNameById[params.data?.vendorId] || "",
      valueSetter: (params) => {
        const match = vendors.find((v) => v.vendorCompanyName === params.newValue);
        params.data.vendorId = match ? match.vendorId : null;
        return true;
      },
      cellEditor: "agSelectCellEditor",
      cellEditorParams: { values: vendors.map((v) => v.vendorCompanyName) },
    },
    {
      headerName: "Customer",
      field: "customerId",
      editable: true,
      filter: "agSetColumnFilter",
      valueGetter: (params) => customerNameById[params.data?.customerId] || "",
      valueSetter: (params) => {
        const match = customers.find((c) => c.customerCompanyName === params.newValue);
        params.data.customerId = match ? match.customerId : null;
        return true;
      },
      cellEditor: "agSelectCellEditor",
      cellEditorParams: { values: customers.map((c) => c.customerCompanyName) },
    },
    {
      headerName: "Start Date",
      field: "startDate",
      editable: true,
      filter: "agSetColumnFilter",
      cellEditor: "agDateStringCellEditor",
      valueFormatter: (params) => formatDateMDY(params.value),
    },
    {
      headerName: "End Date",
      field: "endDate",
      editable: true,
      filter: "agSetColumnFilter",
      cellEditor: "agDateStringCellEditor",
      valueFormatter: (params) => formatDateMDY(params.value),
    },
    {
      headerName: "Status",
      field: "status",
      editable: true,
      filter: "agSetColumnFilter",
      cellEditor: "agSelectCellEditor",
      cellEditorParams: { values: STATUS_OPTIONS },
    },
    {
      headerName: "Limits",
      field: "limits",
      editable: true,
      filter: "agSetColumnFilter",
      cellEditor: "agLargeTextCellEditor",
      cellEditorPopup: true,
    },
    {
      colId: "actions",
      headerName: "Action",
      sortable: false,
      filter: false,
      editable: false,
      cellRenderer: (params) => {
        if (!params.data) return null;
        const row = params.data;
        // Notes/Archive need a saved row (real id) to attach to — an
        // unsaved (still-being-added) row only gets the plain remove-icon
        // it already had, same gating the Document column uses.
        if (!row.id) {
          return (
            <DeleteOutlined
              style={{ color: "#cf1322", cursor: "pointer" }}
              onClick={() => handleDelete(row)}
            />
          );
        }
        return (
          <NotesActionButton
            onOpenNotes={() => setNoteModalRow(row)}
            extraActions={buildRowActions({
              onArchive: () => handleArchive(row),
              onDelete: () => handleDelete(row),
              entityType: "COI",
              entityId: row.id,
              entityLabel: vendorNameById[row.vendorId] || customerNameById[row.customerId],
            })}
          />
        );
      },
    },
    {
      colId: "documents",
      headerName: "Document",
      width: 90,
      minWidth: 90,
      maxWidth: 90,
      sortable: false,
      filter: false,
      editable: false,
      cellRenderer: (params) => {
        if (!params.data) return null;
        // Attachments are keyed by the saved Coi id — an unsaved
        // (still-being-added) row has no entity to attach to yet.
        if (!params.data.id) {
          return (
            <Tooltip title="Save this row before attaching documents">
              <PlusOutlined style={{ color: "#bbb" }} />
            </Tooltip>
          );
        }
        const doc = docsByEntityId[params.data.id];
        if (doc) {
          return (
            <a onClick={() => openDocumentInNewTab(doc.id)}>
              <FilePdfOutlined style={{ color: "#cf1322", fontSize: 16 }} />
            </a>
          );
        }
        return (
          <PlusOutlined
            style={{ cursor: "pointer" }}
            onClick={() => setDocumentsForRow(params.data)}
          />
        );
      },
    },
  ];

  return (
    <div className="ag-theme-alpine">
      <GridToolbar className="workforce-search-container">
        <Button type="default" icon={<ReloadOutlined />} onClick={fetchData} style={{ marginRight: 10 }}>
          Refresh
        </Button>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAddRow} style={{ marginRight: 10 }}>
          Add COI
        </Button>
        {Object.keys(modifiedRows).length > 0 && (
          <>
            <Button type="primary" icon={<SaveOutlined />} onClick={handleSaveChanges} style={{ marginRight: 10 }}>
              Save
            </Button>
            <Button icon={<CloseOutlined />} onClick={handleCancelChanges}>
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
          onGridReady={(params) => (gridRef.current = params.api)}
          onCellValueChanged={onCellValueChanged}
          onFirstDataRendered={(params) => {
            try {
              params.api.autoSizeAllColumns();
            } catch (e) {}
          }}
          autoSizeStrategy={{ type: "fitCellContents" }}
          rowHeight={48}
          rowData={rowData}
          getRowId={(params) => String(params.data.rowKey)}
          loading={loading}
          columnDefs={sizeColumnsForHeader(columnDefs)}
          defaultColDef={{
            minWidth: 100,
            maxWidth: 260,
            resizable: true,
            filter: "agSetColumnFilter",
            enableRowGroup: true,
          }}
          domLayout="normal"
          pagination={true}
          paginationPageSize={100}
          popupParent={document.body}
        />
      </div>
      <Modal
        title="COI Documents"
        open={!!documentsForRow}
        onCancel={() => {
          setDocumentsForRow(null);
          fetchDocumentIndicators();
        }}
        footer={null}
        destroyOnClose
      >
        {documentsForRow && (
          <DocumentsPanel entityType="COI" entityId={documentsForRow.id} />
        )}
      </Modal>
      <NotesModal
        open={!!noteModalRow}
        entityType="COI"
        entityId={noteModalRow?.id}
        title={vendorNameById[noteModalRow?.vendorId] || customerNameById[noteModalRow?.customerId]}
        onClose={() => setNoteModalRow(null)}
      />
    </div>
  );
};

export default CoiGrid;
