import React, { useEffect, useState } from "react";
import { Upload, Button, Table, message, Modal, Form, Input } from "antd";
import { UploadOutlined, DownloadOutlined, DeleteOutlined, InboxOutlined } from "@ant-design/icons";
import axios from "axios";
import API_ENDPOINTS from "../config";
import { openDocumentInNewTab } from "./openDocument";
import { formatDateMDY } from "../Utils/dateFormat";

const { Dragger } = Upload;

// Fixed checklist of employee document types — a skeleton for now, per the
// request; the exact list/behavior may still change once more detail is given.
export const EMPLOYEE_DOCUMENT_TYPES = [
  "Passport copy",
  "I 94",
  "I9",
  "E-Verify",
  "H1B approval",
  "H1B Receipt",
];

// One row per required document type (not one row per uploaded file, the
// way DocumentsPanel's free-form list works) — each row shows whichever
// document of that type was uploaded most recently, or lets you add one.
const EmployeeDocumentsPanel = ({ entityId }) => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeType, setActiveType] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

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

  const latestByType = (type) =>
    documents
      .filter((d) => d.documentType === type)
      .sort((a, b) => new Date(b.uploadedDate) - new Date(a.uploadedDate))[0] || null;

  const openAddModal = (type) => {
    form.resetFields();
    setSelectedFile(null);
    setActiveType(type);
  };

  const closeAddModal = () => {
    setActiveType(null);
    setSelectedFile(null);
    form.resetFields();
  };

  const handleSubmit = async () => {
    const values = await form.validateFields().catch(() => null);
    if (!values) return;
    if (!selectedFile) {
      message.error("Please select a file to upload.");
      return;
    }

    setSubmitting(true);
    try {
      const presign = await axios.post(API_ENDPOINTS.presignDocumentUpload, {
        entityType: "Employee",
        entityId,
        fileName: selectedFile.name,
        contentType: selectedFile.type || "application/octet-stream",
      });
      const { uploadUrl, s3Key } = presign.data;

      await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": selectedFile.type || "application/octet-stream" },
        body: selectedFile,
      });

      await axios.post(API_ENDPOINTS.createDocument, {
        entityType: "Employee",
        entityId,
        fileName: selectedFile.name,
        s3Key,
        contentType: selectedFile.type || "application/octet-stream",
        sizeBytes: selectedFile.size,
        documentType: activeType,
        description: values.description || "",
      });

      message.success(`${selectedFile.name} uploaded.`);
      closeAddModal();
      fetchDocuments();
    } catch (error) {
      message.error(`Upload failed: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (doc) => {
    // Same reasoning as DocumentsPanel: a native confirm sidesteps
    // Popconfirm fighting an enclosing Modal's mask for the click.
    if (!window.confirm(`Delete ${doc.fileName}?`)) return;
    axios
      .delete(API_ENDPOINTS.documentById(doc.id))
      .then(() => {
        message.success(`${doc.fileName} deleted.`);
        fetchDocuments();
      })
      .catch(() => message.error("Delete failed."));
  };

  const columns = [
    {
      title: "Type",
      dataIndex: "type",
      key: "type",
      width: 200,
    },
    {
      title: "Document",
      key: "document",
      render: (_, row) => (row.doc ? row.doc.fileName : "Not uploaded"),
    },
    {
      title: "Uploaded",
      key: "uploaded",
      width: 140,
      render: (_, row) => (row.doc?.uploadedDate ? formatDateMDY(row.doc.uploadedDate) : "NA"),
    },
    {
      title: "Actions",
      key: "actions",
      width: 160,
      render: (_, row) => (
        <>
          <Button icon={<UploadOutlined />} size="small" onClick={() => openAddModal(row.type)}>
            {row.doc ? "Replace" : "Add Document"}
          </Button>
          {row.doc && (
            <>
              <Button
                type="link"
                icon={<DownloadOutlined />}
                onClick={() => openDocumentInNewTab(row.doc.id)}
              />
              <Button type="link" danger icon={<DeleteOutlined />} onClick={() => handleDelete(row.doc)} />
            </>
          )}
        </>
      ),
    },
  ];

  const rows = EMPLOYEE_DOCUMENT_TYPES.map((type) => ({
    key: type,
    type,
    doc: latestByType(type),
  }));

  return (
    <div>
      <Table
        rowKey="key"
        loading={loading}
        dataSource={rows}
        columns={columns}
        pagination={false}
        size="small"
      />

      <Modal
        title={`Add Document — ${activeType || ""}`}
        open={!!activeType}
        onCancel={closeAddModal}
        onOk={handleSubmit}
        confirmLoading={submitting}
        okText="Upload"
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item label="Description" name="description">
            <Input.TextArea rows={3} placeholder="Optional notes about this document" />
          </Form.Item>
          <Form.Item label="File" required>
            <Dragger
              beforeUpload={(file) => {
                setSelectedFile(file);
                return false;
              }}
              onRemove={() => setSelectedFile(null)}
              fileList={selectedFile ? [selectedFile] : []}
              maxCount={1}
            >
              <p className="ant-upload-drag-icon">
                <InboxOutlined />
              </p>
              <p className="ant-upload-text">Click or drag a file here to select it</p>
            </Dragger>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default EmployeeDocumentsPanel;
