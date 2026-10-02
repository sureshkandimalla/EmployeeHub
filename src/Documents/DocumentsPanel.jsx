import React, { useEffect, useState } from "react";
import { Upload, Button, Table, message, Modal, Form, Select, Input, Tag } from "antd";
import { UploadOutlined, DownloadOutlined, DeleteOutlined, FileOutlined, InboxOutlined } from "@ant-design/icons";
import axios from "axios";
import API_ENDPOINTS from "../config";
import { openDocumentInNewTab } from "./openDocument";
import { formatDateMDY } from "../Utils/dateFormat";

const { Dragger } = Upload;

export const DOCUMENT_TYPE_OPTIONS = ["Visa", "H1B", "Passport", "I94", "Education", "Other"];

const documentTypeColor = (type) => {
  switch (type) {
    case "Visa":
      return "blue";
    case "H1B":
      return "purple";
    case "Passport":
      return "green";
    case "I94":
      return "gold";
    case "Education":
      return "cyan";
    default:
      return "default";
  }
};

// Reusable across any entity that needs file attachments — Insurance today,
// Customer MSAs / Project POs / Employee docs are the same shape, just a
// different entityType. Upload is a 3-step dance: ask the backend for a
// presigned S3 PUT url, PUT the raw file straight to S3 (bypassing our own
// API and its axios interceptor — a presigned URL's signature doesn't
// tolerate an extra Authorization header), then tell the backend the
// upload succeeded so it can record the metadata row (now also carrying
// the Document Type / Description captured in the Add Document form).
const DocumentsPanel = ({ entityType, entityId }) => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  const fetchDocuments = () => {
    if (!entityId) return;
    setLoading(true);
    axios
      .get(API_ENDPOINTS.getDocumentsForEntity(entityType, entityId))
      .then((res) => setDocuments(res.data || []))
      .catch(() => setDocuments([]))
      .finally(() => setLoading(false));
  };

  useEffect(fetchDocuments, [entityType, entityId]);

  const openAddModal = () => {
    form.resetFields();
    setSelectedFile(null);
    setModalOpen(true);
  };

  const closeAddModal = () => {
    setModalOpen(false);
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
        entityType,
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
        entityType,
        entityId,
        fileName: selectedFile.name,
        s3Key,
        contentType: selectedFile.type || "application/octet-stream",
        sizeBytes: selectedFile.size,
        documentType: values.documentType,
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
    // Popconfirm's popup portal fights the enclosing antd Modal's mask for
    // click handling (the mask's mousedown fires and closes the Modal
    // before Popconfirm's own onConfirm registers) — plain window.confirm
    // sidesteps that stacking issue entirely, same as elsewhere in this app.
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
      title: "File Name",
      dataIndex: "fileName",
      key: "fileName",
      render: (fileName) => (
        <>
          <FileOutlined style={{ marginRight: 8 }} />
          {fileName}
        </>
      ),
    },
    {
      title: "Document Type",
      dataIndex: "documentType",
      key: "documentType",
      render: (documentType) => (documentType ? <Tag color={documentTypeColor(documentType)}>{documentType}</Tag> : "NA"),
    },
    {
      title: "Description",
      dataIndex: "description",
      key: "description",
      render: (description) => description || "NA",
    },
    {
      title: "Uploaded",
      dataIndex: "uploadedDate",
      key: "uploadedDate",
      render: (uploadedDate) => (uploadedDate ? formatDateMDY(uploadedDate) : "NA"),
    },
    {
      title: "Actions",
      key: "actions",
      width: 100,
      render: (_, doc) => (
        <>
          <Button
            type="link"
            icon={<DownloadOutlined />}
            onClick={() => openDocumentInNewTab(doc.id)}
          />
          <Button type="link" danger icon={<DeleteOutlined />} onClick={() => handleDelete(doc)} />
        </>
      ),
    },
  ];

  return (
    <div>
      <Button icon={<UploadOutlined />} onClick={openAddModal} style={{ marginBottom: 12 }}>
        Add Document
      </Button>
      <Table
        rowKey="id"
        loading={loading}
        dataSource={documents}
        columns={columns}
        pagination={false}
        size="small"
        locale={{ emptyText: "No documents uploaded yet" }}
      />

      <Modal
        title="Add Document"
        open={modalOpen}
        onCancel={closeAddModal}
        onOk={handleSubmit}
        confirmLoading={submitting}
        okText="Upload"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="Document Type"
            name="documentType"
            rules={[{ required: true, message: "Please select a document type" }]}
          >
            <Select
              placeholder="Select document type"
              options={DOCUMENT_TYPE_OPTIONS.map((value) => ({ value, label: value }))}
            />
          </Form.Item>
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

export default DocumentsPanel;
