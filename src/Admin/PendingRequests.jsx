import React, { useEffect, useRef, useState } from "react";
import { AgGridReact } from "@ag-grid-community/react";
import { Button, Card, Modal, message } from "antd";
import { ReloadOutlined, CheckOutlined, CloseOutlined } from "@ant-design/icons";
import axios from "axios";
import "ag-grid-enterprise";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import API_ENDPOINTS from "../config";
import { ACTION_REQUEST_CONFIG } from "../Notes/actionRequestConfig";
import GridToolbar from "../Utils/GridToolbar";
import { formatDateMDY } from "../Utils/dateFormat";

const getLoggedInUserName = () => {
  try {
    const user = JSON.parse(localStorage.getItem("user"));
    return user?.name || user?.email || "Unknown";
  } catch {
    return "Unknown";
  }
};

// Admin-only page (see roleAccess.js ROUTE_ROLES["/pendingRequests"]) for
// reviewing the Archive/Delete requests non-admins file from every grid's
// row-action button (see Notes/rowActions.js). Approving here performs the
// actual archive/delete — it replays the exact same call the requesting
// grid would have made directly, using ACTION_REQUEST_CONFIG to know each
// entity type's endpoints, since the backend never performs the action
// itself (see ActionRequestController).
const PendingRequests = () => {
  const gridRef = useRef(null);
  const [rowData, setRowData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busyRequestId, setBusyRequestId] = useState(null);

  const fetchData = () => {
    setLoading(true);
    axios
      .get(API_ENDPOINTS.getActionRequests("PENDING"))
      .then((response) => setRowData(response.data || []))
      .catch((error) => {
        console.error("Error fetching pending requests:", error);
        message.error("Failed to load pending requests.");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Fetches the entity's current row, given either a single-id GET (most
  // types) or a whole-list GET filtered by id (Immigration Intake,
  // Potential Employee — see actionRequestConfig.js).
  const fetchEntity = async (config, entityId) => {
    if (config.getUrl) {
      const { data } = await axios.get(config.getUrl(entityId));
      return data;
    }
    const { data } = await axios.get(config.getAllUrl);
    const list = Array.isArray(data) ? data : [];
    return list.find((row) => String(row[config.idField]) === String(entityId));
  };

  const performArchive = async (config, entityId) => {
    const entity = await fetchEntity(config, entityId);
    if (!entity) throw new Error("Record not found — it may have already been deleted.");
    const updated = { ...entity, [config.statusField]: "Archived" };
    if (config.updateMethod === "post") {
      return axios.post(config.updateUrl(entityId), updated);
    }
    if (config.updateMethod === "post-list") {
      return axios.post(config.updateUrl(entityId), [updated]);
    }
    return axios.put(config.updateUrl(entityId), updated);
  };

  const performDelete = (config, entityId) => axios.delete(config.deleteUrl(entityId));

  const resolveRequest = (requestId, status) =>
    axios.put(API_ENDPOINTS.resolveActionRequest(requestId), {
      status,
      resolvedBy: getLoggedInUserName(),
    });

  const handleApprove = (request) => {
    const config = ACTION_REQUEST_CONFIG[request.type];
    if (!config) {
      message.error(`Don't know how to perform "${request.action}" for type "${request.type}".`);
      return;
    }
    setBusyRequestId(request.requestId);
    const perform = request.action === "ARCHIVE"
      ? performArchive(config, request.entityId)
      : performDelete(config, request.entityId);
    perform
      .then(() => resolveRequest(request.requestId, "APPROVED"))
      .then(() => {
        message.success(`${request.entityLabel || request.entityId} ${request.action === "ARCHIVE" ? "archived" : "deleted"}.`);
        fetchData();
      })
      .catch((error) => {
        console.error("Error approving request:", error);
        message.error(error?.message || "Failed to perform the requested action. Please try again.");
      })
      .finally(() => setBusyRequestId(null));
  };

  const handleReject = (request) => {
    Modal.confirm({
      title: `Reject this ${request.action === "ARCHIVE" ? "archive" : "delete"} request?`,
      content: `${request.entityLabel || request.entityId} (${request.type}) — requested by ${request.requestedBy}.`,
      okText: "Reject",
      cancelText: "Cancel",
      onOk: () => {
        setBusyRequestId(request.requestId);
        return resolveRequest(request.requestId, "REJECTED")
          .then(() => {
            message.success("Request rejected.");
            fetchData();
          })
          .catch(() => message.error("Failed to reject the request. Please try again."))
          .finally(() => setBusyRequestId(null));
      },
    });
  };

  const cellClassRules = {
    darkGreyBackground: (params) => params.node?.rowIndex !== undefined && params.node.rowIndex % 2 === 1,
  };

  const columnDefs = [
    { headerName: "Type", field: "type", filter: "agSetColumnFilter", cellClassRules },
    { headerName: "Record", field: "entityLabel", filter: "agSetColumnFilter", cellClassRules },
    { headerName: "Action", field: "action", filter: "agSetColumnFilter", cellClassRules },
    { headerName: "Requested By", field: "requestedBy", filter: "agSetColumnFilter", cellClassRules },
    { headerName: "Requested Date", field: "requestedDate", filter: "agSetColumnFilter", cellClassRules, valueFormatter: (params) => formatDateMDY(params.value) },
    {
      headerName: "Review",
      sortable: false,
      filter: false,
      minWidth: 260,
      width: 260,
      // ag-theme-alpine's default .ag-cell-value styling (overflow:
      // hidden + text-overflow: ellipsis, meant for truncating long text)
      // was clipping the second button — override it here so two buttons
      // in a row render in full instead of getting ellipsis-truncated.
      cellStyle: { overflow: "visible", textOverflow: "clip", display: "flex", alignItems: "center" },
      cellClassRules,
      cellRenderer: (params) => {
        if (!params.data) return null;
        const busy = busyRequestId === params.data.requestId;
        return (
          <>
            <Button
              type="link"
              size="small"
              icon={<CheckOutlined />}
              loading={busy}
              onClick={() => handleApprove(params.data)}
            >
              Approve
            </Button>
            <Button
              type="link"
              size="small"
              danger
              icon={<CloseOutlined />}
              disabled={busy}
              onClick={() => handleReject(params.data)}
            >
              Reject
            </Button>
          </>
        );
      },
    },
  ];

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div className="ag-theme-alpine employee-List-grid">
        <Card className="employeeTableCard" style={{ height: "100%" }}>
          <GridToolbar className="workforce-search-container">
            <Button type="default" icon={<ReloadOutlined />} onClick={fetchData} style={{ marginRight: "10px" }}>
              Refresh
            </Button>
          </GridToolbar>
          <div style={{ height: "calc(100vh - 220px)" }}>
            <AgGridReact
              enableCellTextSelection={true}
              ensureDomOrder={true}
              ref={gridRef}
              rowData={rowData}
              loading={loading}
              columnDefs={columnDefs}
              defaultColDef={{
                resizable: true,
                filter: "agSetColumnFilter",
                minWidth: 120,
              }}
              domLayout="normal"
              pagination={true}
              paginationPageSize={100}
              popupParent={document.body}
            />
          </div>
        </Card>
      </div>
    </div>
  );
};

export default PendingRequests;
