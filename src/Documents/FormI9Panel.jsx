import { useEffect, useMemo, useState } from "react";
import { AgGridReact } from "@ag-grid-community/react";
import { Button, Tag } from "antd";
import { PlusOutlined, ReloadOutlined, FileOutlined, WarningOutlined } from "@ant-design/icons";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import "ag-grid-enterprise";
import axios from "axios";
import API_ENDPOINTS from "../config";
import { formatDateMDY } from "../Utils/dateFormat";
import { sizeColumnsForHeader } from "../Utils/agGridColumnSizing";
import { openDocumentInNewTab } from "./openDocument";
import FormI9Modal, { I9_SUBTYPE_OPTIONS } from "./FormI9Modal";

const SUBTYPE_LABEL = Object.fromEntries(I9_SUBTYPE_OPTIONS.map((o) => [o.value, o.label]));

const STATUS_COLOR = {
  Compliant: "success",
  "In Process": "blue",
  Completed: "success",
  Destroyed: "default",
};

function statusTag(status) {
  if (!status) return null;
  const isWarning = /overdue|missing|needed/i.test(status);
  return (
    <Tag icon={isWarning ? <WarningOutlined /> : undefined} color={isWarning ? "error" : STATUS_COLOR[status] || "blue"}>
      {status}
    </Tag>
  );
}

// Form I-9 tab's grid — one master row per I9Record (New Hire, Supplement
// B Reverification, Rehire, Correction, ...), computed Record ID /
// Reverify-by / Status from GET /i9records/employee/{id} (I9RecordService
// does the I9Rules computation server-side). Detail rows show that
// record's own attachments, same generic Document list every other
// Documents panel in this app already uses, just entityType="I9Record".
export default function FormI9Panel({ entityId, visaCategory }) {
  const [summary, setSummary] = useState({ status: null, dueDate: null, retainUntil: null, records: [] });
  const [attachmentsByRecordId, setAttachmentsByRecordId] = useState({});
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [correctableRecords, setCorrectableRecords] = useState([]);
  const [currentPassport, setCurrentPassport] = useState(null);

  const fetchData = () => {
    if (!entityId) return;
    setLoading(true);
    axios
      .get(API_ENDPOINTS.getI9RecordsForEmployee(entityId))
      .then(async ({ data: summaryData }) => {
        setSummary(summaryData || { status: null, dueDate: null, retainUntil: null, records: [] });
        const records = summaryData?.records || [];
        const grouped = {};
        await Promise.all(
          records.map(async (v) => {
            const { data } = await axios.get(API_ENDPOINTS.getDocumentsForEntity("I9Record", v.record.id));
            grouped[v.record.id] = data || [];
          }),
        );
        setAttachmentsByRecordId(grouped);
      })
      .catch(() => setSummary({ status: null, dueDate: null, retainUntil: null, records: [] }))
      .finally(() => setLoading(false));
  };

  useEffect(fetchData, [entityId]);

  // E11 (passport-based List A documents need a number+expiry on file)
  // reads the dedicated Passport table server-side — fetched here too so
  // the client-side live-validation preview agrees with it, instead of
  // always showing E11 even when the employee already has a passport on
  // file.
  useEffect(() => {
    if (!entityId) return;
    axios
      .get(API_ENDPOINTS.getPassportsByEmployee(entityId))
      .then(({ data }) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const valid = (data || []).filter((p) => p.expiryDate && new Date(p.expiryDate) >= today);
        const latest = valid.sort((a, b) => new Date(b.expiryDate) - new Date(a.expiryDate))[0];
        setCurrentPassport(latest || null);
      })
      .catch(() => setCurrentPassport(null));
  }, [entityId]);

  const employeeContext = useMemo(
    () => ({
      employeeId: entityId,
      visaStatus: visaCategory,
      passportNumber: currentPassport?.passportNumber || null,
      passportExpiry: currentPassport?.expiryDate || null,
    }),
    [entityId, visaCategory, currentPassport],
  );

  const openAddModal = () => {
    axios
      .get(API_ENDPOINTS.getI9RecordsForCorrection(entityId))
      .then((res) => setCorrectableRecords(res.data || []))
      .catch(() => setCorrectableRecords([]))
      .finally(() => setModalOpen(true));
  };

  const rowData = useMemo(
    () =>
      summary.records.map((v) => ({
        ...v,
        attachments: attachmentsByRecordId[v.record.id] || [],
      })),
    [summary.records, attachmentsByRecordId],
  );

  const masterColumnDefs = [
    {
      field: "record.subtype",
      headerName: "Sub type",
      cellRenderer: "agGroupCellRenderer",
      valueGetter: (p) => SUBTYPE_LABEL[p.data?.record?.subtype] || p.data?.record?.subtype,
    },
    { field: "recordId", headerName: "Record ID" },
    { field: "record.validFrom", headerName: "Valid From", valueFormatter: (p) => formatDateMDY(p.value) },
    { field: "section2Due", headerName: "Section 2 Due", valueFormatter: (p) => formatDateMDY(p.value) },
    {
      headerName: "Reverify By",
      valueGetter: (p) => (p.data?.reverifyNotRequired ? "Not required" : p.data?.reverifyBy),
      valueFormatter: (p) => (p.value === "Not required" ? p.value : formatDateMDY(p.value)),
    },
    { headerName: "Status", cellRenderer: (p) => statusTag(p.data?.record?.completedOn ? "Completed" : "In Process") },
  ];

  const detailCellRendererParams = {
    detailGridOptions: {
      domLayout: "autoHeight",
      columnDefs: [
        { field: "subType", headerName: "File role", filter: "agSetColumnFilter" },
        {
          headerName: "File",
          minWidth: 220,
          cellRenderer: (p) =>
            p.data ? (
              <span style={{ color: "#1677ff", cursor: "pointer" }} onClick={() => openDocumentInNewTab(p.data.id)}>
                <FileOutlined style={{ marginRight: 6 }} />
                {p.data.fileName}
              </span>
            ) : null,
        },
        { field: "uploadedDate", headerName: "Uploaded", valueFormatter: (p) => formatDateMDY(p.value) },
      ],
      defaultColDef: { minWidth: 100, resizable: true },
    },
    getDetailRowData: (params) => params.successCallback(params.data.attachments || []),
  };

  return (
    <div>
      <div style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 12 }}>
        <Button icon={<PlusOutlined />} onClick={openAddModal}>
          Add Form I-9 Record
        </Button>
        <Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading}>
          Refresh
        </Button>
        {summary.status && (
          <span>
            Employee status: {statusTag(summary.status)}
            {summary.dueDate && <span style={{ marginLeft: 8, color: "#666" }}>Due {formatDateMDY(summary.dueDate)}</span>}
          </span>
        )}
        {summary.retainUntil && <span style={{ color: "#666" }}>Retain until {formatDateMDY(summary.retainUntil)}</span>}
      </div>

      <div className="ag-theme-alpine" style={{ height: "60vh", minHeight: 360 }}>
        <AgGridReact
          rowData={rowData}
          columnDefs={sizeColumnsForHeader(masterColumnDefs)}
          defaultColDef={{ minWidth: 100, resizable: true, filter: "agSetColumnFilter" }}
          domLayout="normal"
          masterDetail={true}
          detailRowAutoHeight={true}
          detailCellRendererParams={detailCellRendererParams}
          getRowId={(p) => String(p.data.record.id)}
          loading={loading}
          overlayNoRowsTemplate="No Form I-9 records yet"
        />
      </div>

      <FormI9Modal
        open={modalOpen}
        employeeId={entityId}
        employeeContext={employeeContext}
        correctableRecords={correctableRecords}
        onClose={() => setModalOpen(false)}
        onSaved={() => {
          setModalOpen(false);
          fetchData();
        }}
      />
    </div>
  );
}
