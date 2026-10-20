import React, { useEffect, useMemo, useRef, useState } from "react";
import { AgGridReact } from "@ag-grid-community/react";
import { Button, Form, Input, Select, DatePicker, message, Modal, Upload, Tag, AutoComplete } from "antd";
import {
  UploadOutlined,
  DownloadOutlined,
  DeleteOutlined,
  InboxOutlined,
  PlusOutlined,
  FileOutlined,
  WarningOutlined,
  ExclamationCircleOutlined,
} from "@ant-design/icons";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import "ag-grid-enterprise";
import axios from "axios";
import API_ENDPOINTS from "../config";
import { openDocumentInNewTab } from "./openDocument";
import { formatDateMDY, parseLocalDateSafe } from "../Utils/dateFormat";
import { sizeColumnsForHeader } from "../Utils/agGridColumnSizing";

const { Dragger } = Upload;

// The company's full employee-document checklist — documentType/subType
// pairs, which ones are mandatory, and (informational only for now, no
// conditional display logic yet) which are H1B-only. subType "" means the
// type itself has no further breakdown. Order here is also the grid's
// default row order.
export const EMPLOYEE_DOCUMENT_TAXONOMY = [
  { type: "Passport", subType: "", mandatory: true },
  { type: "I94", subType: "", mandatory: true },
  { type: "Form I9", subType: "", mandatory: true },
  { type: "Form I9", subType: "Part A", mandatory: true },
  { type: "Form I9", subType: "Part B", mandatory: true },
  { type: "E-Verify", subType: "", mandatory: true },
  { type: "H1B", subType: "H1B Approval", mandatory: true, requiredVisa: "H1B" },
  { type: "H1B", subType: "H1B Receipt", mandatory: true, requiredVisa: "H1B" },
  { type: "H1B", subType: "I129 Petition", mandatory: false },
  { type: "H1B", subType: "H1B Other", mandatory: false },
  { type: "Offer Letter", subType: "", mandatory: true },
  { type: "Driving License", subType: "", mandatory: true },
  { type: "EAD", subType: "OPT EAD", mandatory: true, requiredVisa: "OPT" },
  { type: "EAD", subType: "H4 EAD", mandatory: true, requiredVisa: "H4" },
  { type: "Employee Documents", subType: "Xth", mandatory: false },
  { type: "Employee Documents", subType: "XIIth", mandatory: false },
  { type: "Employee Documents", subType: "Bachelors", mandatory: false },
  { type: "Employee Documents", subType: "Masters", mandatory: false },
  { type: "Employee Documents", subType: "Other", mandatory: false },
  { type: "Employee Documents", subType: "I-20", mandatory: false },
  { type: "Employee Documents", subType: "SSN", mandatory: true },
  { type: "W4", subType: "", mandatory: true },
];

// Document Type dropdown options, deduped in taxonomy order — also the
// grid's master-row order (one collapsible row per type, same pattern as
// the Visa grid's one-row-per-employee master/detail).
export const EMPLOYEE_DOCUMENT_TYPES = [...new Set(EMPLOYEE_DOCUMENT_TAXONOMY.map((e) => e.type))];

const subTypeOptionsFor = (documentType) =>
  EMPLOYEE_DOCUMENT_TAXONOMY.filter((e) => e.type === documentType).map((e) => e.subType);

// Which sub-type stands in for the whole Document Type on the master row's
// Actions column (the same spot Passport/E-Verify show their one document
// in, since those types have no sub-types at all). A multi-subtype type has
// no single "the" document in general (Form I9's Part A/Part B are equally
// important, so neither should be singled out) — H1B is the one exception
// on today's checklist, where H1B Approval is the document that actually
// answers "is this person authorized to work."
const PRIMARY_SUBTYPE = {
  H1B: "H1B Approval",
};

const primarySubTypeFor = (documentType) => {
  if (documentType in PRIMARY_SUBTYPE) return PRIMARY_SUBTYPE[documentType];
  const entries = EMPLOYEE_DOCUMENT_TAXONOMY.filter((e) => e.type === documentType);
  return entries.length === 1 ? entries[0].subType : null;
};

// A mandatory document whose Valid Until has passed no longer satisfies the
// checklist — it still shows (and can still be downloaded), but counts the
// same as "not uploaded" for the missing/alert rollup, since the real-world
// document it represents (passport, EAD, ...) needs to be renewed.
const isExpired = (doc) => {
  const until = parseLocalDateSafe(doc?.validUntil);
  if (!until) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return until < today;
};

const satisfies = (doc) => !!doc && !isExpired(doc);

// Some checklist entries only apply to employees on a specific visa
// (requiredVisa) — H1B Approval/Receipt only matter if the employee is
// actually on H1B, OPT EAD only if they're on OPT, etc. An entry with no
// requiredVisa applies to everyone. When the employee's visa doesn't match,
// the entry still shows (so the checklist stays visible/consistent across
// employees) but isn't treated as missing/required.
const isMandatoryFor = (entry, visaCategory) =>
  !!entry.mandatory && (!entry.requiredVisa || entry.requiredVisa === visaCategory);

// Detail rows for one Document Type: a row for every checklist subType
// (flagged if mandatory and missing), plus a row for every actual upload —
// including more than one upload under the same subType (e.g. an H1B
// approval renewed over time), which just means that subType appears more
// than once rather than needing its own nested expand level.
const buildDetailRows = (type, documents, visaCategory) => {
  const taxonomyEntries = EMPLOYEE_DOCUMENT_TAXONOMY.filter((e) => e.type === type);
  const bySubType = new Map();
  documents
    .filter((d) => d.documentType === type)
    .forEach((doc) => {
      const key = doc.subType || "";
      if (!bySubType.has(key)) bySubType.set(key, []);
      bySubType.get(key).push(doc);
    });

  const rows = [];
  const seen = new Set();
  taxonomyEntries.forEach((entry) => {
    seen.add(entry.subType);
    const mandatory = isMandatoryFor(entry, visaCategory);
    const docs = (bySubType.get(entry.subType) || [])
      .slice()
      .sort((a, b) => new Date(b.uploadedDate) - new Date(a.uploadedDate));
    if (docs.length === 0) {
      rows.push({ subType: entry.subType, mandatory, doc: null });
    } else {
      docs.forEach((doc) => rows.push({ subType: entry.subType, mandatory, doc }));
    }
  });
  bySubType.forEach((docs, subType) => {
    if (seen.has(subType)) return;
    docs.forEach((doc) => rows.push({ subType, mandatory: false, doc }));
  });
  return rows;
};

// One master row per Document Type, rolled up from its detail rows:
// whether anything required is still missing, how many documents are on
// file, and the most recent upload date across all of them.
const buildMasterRows = (documents, visaCategory) => {
  return EMPLOYEE_DOCUMENT_TYPES.map((type) => {
    const detailRows = buildDetailRows(type, documents, visaCategory);
    const mandatoryEntries = EMPLOYEE_DOCUMENT_TAXONOMY.filter(
      (e) => e.type === type && isMandatoryFor(e, visaCategory)
    );
    const missingCount = mandatoryEntries.filter(
      (entry) => !detailRows.some((r) => r.subType === entry.subType && satisfies(r.doc))
    ).length;
    const uploadedCount = detailRows.filter((r) => r.doc).length;
    const lastUpdated = detailRows.reduce((latest, r) => {
      if (!r.doc?.uploadedDate) return latest;
      return !latest || new Date(r.doc.uploadedDate) > new Date(latest) ? r.doc.uploadedDate : latest;
    }, null);

    return {
      key: type,
      documentType: type,
      totalRequired: mandatoryEntries.length,
      missingCount,
      uploadedCount,
      lastUpdated,
      detailRows,
    };
  });
};

const EmployeeDocumentsPanel = ({ entityId, visaCategory }) => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [subTypeOptions, setSubTypeOptions] = useState([]);
  const [form] = Form.useForm();
  const gridRef = useRef(null);

  const fetchDocuments = () => {
    if (!entityId) return;
    setLoading(true);
    axios
      .get(API_ENDPOINTS.getDocumentsForEntity("Employee", entityId))
      .then((res) => setDocuments(res.data || []))
      .catch(() => setDocuments([]))
      .finally(() => setLoading(false));
  };

  useEffect(fetchDocuments, [entityId]);

  const rowData = useMemo(() => buildMasterRows(documents, visaCategory), [documents, visaCategory]);

  const openAddModal = (prefill) => {
    form.resetFields();
    setSelectedFiles([]);
    setSubTypeOptions(prefill?.documentType ? subTypeOptionsFor(prefill.documentType).filter(Boolean) : []);
    if (prefill) {
      form.setFieldsValue({ documentType: prefill.documentType, subType: prefill.subType || undefined });
    }
    setModalOpen(true);
  };

  const closeAddModal = () => {
    setModalOpen(false);
    setSelectedFiles([]);
    form.resetFields();
  };

  const uploadOne = async (file, values) => {
    const presign = await axios.post(API_ENDPOINTS.presignDocumentUpload, {
      entityType: "Employee",
      entityId,
      fileName: file.name,
      contentType: file.type || "application/octet-stream",
      documentType: values.documentType,
      subType: values.subType || "",
      validFrom: values.validFrom?.format("YYYY-MM-DD") || "",
      validUntil: values.validUntil?.format("YYYY-MM-DD") || "",
    });
    const { uploadUrl, s3Key } = presign.data;

    await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type || "application/octet-stream" },
      body: file,
    });

    await axios.post(API_ENDPOINTS.createDocument, {
      entityType: "Employee",
      entityId,
      fileName: file.name,
      s3Key,
      contentType: file.type || "application/octet-stream",
      sizeBytes: file.size,
      documentType: values.documentType,
      subType: values.subType || "",
      documentNumber: values.documentNumber || "",
      validFrom: values.validFrom?.format("YYYY-MM-DD") || null,
      validUntil: values.validUntil?.format("YYYY-MM-DD") || null,
      description: values.description || "",
    });
  };

  const handleSubmit = async () => {
    const values = await form.validateFields().catch(() => null);
    if (!values) return;
    if (selectedFiles.length === 0) {
      message.error("Please select at least one file to upload.");
      return;
    }

    setSubmitting(true);
    // Every selected file carries the same Document Type / Sub type / dates
    // / description entered once above — each still becomes its own
    // Document row, so a batch of 5 I-20s uploaded together shows up as 5
    // separate entries (the detail grid already lists multiple documents
    // under one sub-type). Sequential, not Promise.all, so each file's S3
    // key — timestamped to the millisecond — is guaranteed distinct.
    let succeeded = 0;
    const failed = [];
    for (const file of selectedFiles) {
      try {
        await uploadOne(file, values);
        succeeded++;
      } catch (error) {
        failed.push(file.name);
      }
    }

    if (succeeded > 0) {
      message.success(`${succeeded} document${succeeded === 1 ? "" : "s"} uploaded.`);
    }
    if (failed.length > 0) {
      message.error(`Failed to upload: ${failed.join(", ")}`);
    }
    setSubmitting(false);
    if (failed.length === 0) {
      closeAddModal();
    } else {
      // Leave the modal open with just the failed files still staged, so
      // the user can retry them without re-entering the shared fields.
      setSelectedFiles((prev) => prev.filter((f) => failed.includes(f.name)));
    }
    fetchDocuments();
  };

  const handleDelete = (doc) => {
    Modal.confirm({
      title: `Delete ${doc.fileName}?`,
      icon: <ExclamationCircleOutlined />,
      okText: "Delete",
      okButtonProps: { danger: true },
      onOk: () =>
        axios
          .delete(API_ENDPOINTS.documentById(doc.id))
          .then(() => {
            message.success(`${doc.fileName} deleted.`);
            fetchDocuments();
          })
          .catch(() => message.error("Delete failed.")),
    });
  };

  const documentCellRenderer = (doc, mandatory) => {
    if (doc) {
      const expired = isExpired(doc);
      return (
        <>
          <span style={{ color: "#1677ff", cursor: "pointer" }} onClick={() => openDocumentInNewTab(doc.id)}>
            <FileOutlined style={{ marginRight: 6 }} />
            {doc.fileName}
          </span>
          {expired && (
            <Tag icon={<WarningOutlined />} color="error" style={{ marginLeft: 6 }}>
              {mandatory ? "Expired — Required" : "Expired"}
            </Tag>
          )}
        </>
      );
    }
    return mandatory ? (
      <Tag icon={<WarningOutlined />} color="error">
        Missing — Required
      </Tag>
    ) : (
      <span style={{ color: "#999" }}>Not uploaded</span>
    );
  };

  const statusCellRenderer = (params) => {
    const { totalRequired, missingCount, uploadedCount } = params.data;
    if (totalRequired > 0 && missingCount > 0) {
      return (
        <Tag icon={<WarningOutlined />} color="error">
          {missingCount} Missing — Required
        </Tag>
      );
    }
    if (totalRequired > 0) {
      return <Tag color="success">Complete</Tag>;
    }
    return uploadedCount > 0 ? (
      <Tag color="blue">{uploadedCount} uploaded</Tag>
    ) : (
      <span style={{ color: "#999" }}>Optional</span>
    );
  };

  const masterColumnDefs = [
    {
      field: "documentType",
      headerName: "Document Type",
      cellRenderer: "agGroupCellRenderer",
      onCellClicked: (params) => params.node.setExpanded(!params.node.expanded),
      cellStyle: { cursor: "pointer" },
    },
    { headerName: "Status", cellRenderer: statusCellRenderer },
    { field: "uploadedCount", headerName: "Documents" },
    {
      field: "lastUpdated",
      headerName: "Last updated Date",
      valueFormatter: (p) => formatDateMDY(p.value),
    },
    {
      headerName: "Actions",
      sortable: false,
      filter: false,
      minWidth: 320,
      cellRenderer: (params) => {
        const row = params.data;
        const primarySubType = primarySubTypeFor(row.documentType);
        const currentDoc =
          primarySubType !== null
            ? row.detailRows.find((r) => r.subType === primarySubType && satisfies(r.doc))?.doc
            : null;
        // Matches the green "Complete" tag in the Status column — nothing
        // left to add, so don't prompt for it.
        const isComplete = row.totalRequired > 0 && row.missingCount === 0;
        return (
          <div style={{ display: "flex", alignItems: "center", minWidth: 0 }}>
            {currentDoc && (
              <span
                title={currentDoc.fileName}
                style={{
                  color: "#1677ff",
                  cursor: "pointer",
                  marginRight: 12,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  maxWidth: 170,
                }}
                onClick={() => openDocumentInNewTab(currentDoc.id)}
              >
                <FileOutlined style={{ marginRight: 4 }} />
                {currentDoc.fileName}
              </span>
            )}
            {!isComplete && (
              <Button
                type="link"
                icon={<PlusOutlined />}
                title="Add document"
                style={{ flexShrink: 0 }}
                onClick={() => openAddModal({ documentType: row.documentType })}
              >
                Add
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  const detailCellRendererParams = {
    detailGridOptions: {
      columnDefs: [
        { field: "subType", headerName: "Sub type", valueFormatter: (p) => p.value || "" },
        {
          headerName: "Document ID",
          valueGetter: (p) => p.data?.doc?.documentNumber,
          valueFormatter: (p) => p.value || "",
        },
        {
          headerName: "Description",
          valueGetter: (p) => p.data?.doc?.description,
          valueFormatter: (p) => p.value || "",
        },
        {
          headerName: "Valid From",
          valueGetter: (p) => p.data?.doc?.validFrom,
          valueFormatter: (p) => formatDateMDY(p.value),
        },
        {
          headerName: "valid Until",
          valueGetter: (p) => p.data?.doc?.validUntil,
          valueFormatter: (p) => formatDateMDY(p.value),
        },
        {
          headerName: "Dcoument",
          minWidth: 260,
          cellRenderer: (params) => documentCellRenderer(params.data?.doc, params.data?.mandatory),
        },
        {
          headerName: "Last updated Date",
          valueGetter: (p) => p.data?.doc?.uploadedDate,
          valueFormatter: (p) => formatDateMDY(p.value),
        },
        {
          headerName: "Actions",
          sortable: false,
          filter: false,
          cellRenderer: (params) => (
            <>
              <Button
                type="link"
                icon={<PlusOutlined />}
                title="Add another"
                onClick={() =>
                  openAddModal({
                    documentType: params.data.parentType,
                    subType: params.data.subType,
                  })
                }
              />
              {params.data?.doc && (
                <>
                  <Button
                    type="link"
                    icon={<DownloadOutlined />}
                    onClick={() => openDocumentInNewTab(params.data.doc.id)}
                  />
                  <Button
                    type="link"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => handleDelete(params.data.doc)}
                  />
                </>
              )}
            </>
          ),
        },
      ],
      defaultColDef: { minWidth: 100, resizable: true },
      domLayout: "autoHeight",
      getRowStyle: (params) =>
        params.data?.mandatory && !satisfies(params.data?.doc) ? { background: "#fff1f0" } : undefined,
    },
    getDetailRowData: (params) => {
      const rows = params.data.detailRows.map((r) => ({ ...r, parentType: params.data.documentType }));
      params.successCallback(rows);
    },
  };

  return (
    <div>
      <Button icon={<UploadOutlined />} onClick={() => openAddModal()} style={{ marginBottom: 12 }}>
        Add Document
      </Button>
      {/* A fixed-height, internally-scrolling grid (not domLayout="autoHeight")
          — an expanded detail row's height can vary a lot (a handful of rows
          vs. a dozen uploads under one type), and autoHeight on the *outer*
          grid doesn't reliably re-measure the whole table when that happens,
          clipping the detail content. Same pattern VisaDetailsList uses. */}
      <div className="ag-theme-alpine" style={{ height: "70vh", minHeight: 420 }}>
        <AgGridReact
          ref={gridRef}
          rowData={rowData}
          columnDefs={sizeColumnsForHeader(masterColumnDefs)}
          defaultColDef={{ minWidth: 100, resizable: true, filter: "agSetColumnFilter" }}
          domLayout="normal"
          masterDetail={true}
          detailRowAutoHeight={true}
          detailCellRendererParams={detailCellRendererParams}
          getRowStyle={(params) => (params.data?.missingCount > 0 ? { background: "#fff1f0" } : undefined)}
          loading={loading}
          overlayNoRowsTemplate="No documents uploaded yet"
        />
      </div>

      <Modal
        title="Add Document"
        open={modalOpen}
        onCancel={closeAddModal}
        onOk={handleSubmit}
        confirmLoading={submitting}
        okText="Upload"
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="Document Type"
            name="documentType"
            rules={[{ required: true, message: "Please select a document type" }]}
          >
            <Select
              placeholder="Select document type"
              options={EMPLOYEE_DOCUMENT_TYPES.map((value) => ({ value, label: value }))}
              onChange={(value) => {
                setSubTypeOptions(subTypeOptionsFor(value).filter(Boolean));
                form.setFieldsValue({ subType: undefined });
              }}
            />
          </Form.Item>
          <Form.Item label="Sub type" name="subType">
            <AutoComplete
              placeholder="Optional — pick from the checklist or type your own"
              allowClear
              options={subTypeOptions.map((value) => ({ value, label: value }))}
              filterOption={(input, option) => option.value.toLowerCase().includes(input.toLowerCase())}
            />
          </Form.Item>
          <Form.Item label="Document ID" name="documentNumber">
            <Input placeholder="Optional — e.g. passport number, receipt number" />
          </Form.Item>
          <Form.Item label="Valid From" name="validFrom">
            <DatePicker style={{ width: "100%" }} format="MM/DD/YYYY" />
          </Form.Item>
          <Form.Item label="Valid Until" name="validUntil">
            <DatePicker style={{ width: "100%" }} format="MM/DD/YYYY" />
          </Form.Item>
          <Form.Item label="Description" name="description">
            <Input.TextArea rows={3} placeholder="Optional notes about this document" />
          </Form.Item>
          <Form.Item label="Files" required>
            <Dragger
              multiple
              beforeUpload={(file) => {
                setSelectedFiles((prev) => [...prev, file]);
                return false;
              }}
              onRemove={(file) => setSelectedFiles((prev) => prev.filter((f) => f.uid !== file.uid))}
              fileList={selectedFiles}
            >
              <p className="ant-upload-drag-icon">
                <InboxOutlined />
              </p>
              <p className="ant-upload-text">Click or drag files here to select them</p>
              <p className="ant-upload-hint">
                Select or drop more than one — they'll all be uploaded with the Document Type, Sub
                type, and dates set above, each as its own entry.
              </p>
            </Dragger>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default EmployeeDocumentsPanel;
