import { Button, Modal, Form, Input, DatePicker, Select, Row, Col } from "antd";
import { visaStatusList } from "../config";
import {
  VISA_FIELD_LABELS,
  VISA_CATEGORY_OPTIONS,
  VISA_SUB_CATEGORY_OPTIONS,
  FILING_TYPE_OPTIONS,
} from "./visaConstants";

const MODAL_HEADER_COLOR = "#1677ff";

/**
 * VisaFormModal — shared modal for Add, Edit, and Update visa operations.
 *
 * Props:
 *  open              {boolean}       — controls visibility
 *  isNew             {boolean}       — true = new visa (POST), false = edit (PUT)
 *  visaData          {object}        — current visa object (used for title)
 *  lcaOptions        {array}         — [{ value, label, lcaNumber }]
 *  form              {FormInstance}  — Ant Design form instance (from parent)
 *  saving            {boolean}       — shows loading on save button
 *  onCancel          {function}      — close handler
 *  onSave            {function}      — form onFinish handler (receives form values)
 *  onLcaChange       {function}      — called when LCA dropdown changes
 *  showEmployeeSelect{boolean}       — show employee picker (for standalone Add H1-B)
 *  employeeOptions   {array}         — [{ value, label }] for employee dropdown
 */
export default function VisaFormModal({
  open,
  isNew,
  visaData,
  lcaOptions = [],
  form,
  saving,
  onCancel,
  onSave,
  onLcaChange,
  showEmployeeSelect = false,
  employeeOptions = [],
}) {
  const title = (
    <span style={{ color: MODAL_HEADER_COLOR, fontWeight: 600 }}>
      {isNew
        ? `New Visa — ${visaData?.employeeName || ""}`
        : `Visa Details — ${visaData?.receiptNumber || ""}`}
    </span>
  );

  const footer = [
    <Button key="cancel" onClick={onCancel}>
      Cancel
    </Button>,
    <Button key="save" type="primary" loading={saving} onClick={() => form.submit()}>
      {isNew ? "Create Visa" : "Save"}
    </Button>,
  ];

  return (
    <Modal
      title={title}
      open={open}
      onCancel={onCancel}
      width={760}
      footer={footer}
      destroyOnClose
      styles={{
        header: {
          borderBottom: `2px solid ${MODAL_HEADER_COLOR}`,
          paddingBottom: 12,
        },
        content: {
          borderTop: `4px solid ${MODAL_HEADER_COLOR}`,
          borderRadius: 8,
        },
      }}
    >
      <Form form={form} layout="vertical" onFinish={onSave}>
        <Row gutter={16}>
          {showEmployeeSelect && (
            <Col span={24}>
              <Form.Item name="employeeId" label={VISA_FIELD_LABELS.employeeId} rules={[{ required: true, message: "Please select an employee" }]}>
                <Select
                  showSearch
                  placeholder="Search employee..."
                  optionFilterProp="label"
                  options={employeeOptions}
                  filterOption={(input, option) =>
                    option?.label?.toLowerCase().includes(input.toLowerCase())
                  }
                />
              </Form.Item>
            </Col>
          )}
          <Col span={12}>
            <Form.Item name="receiptNumber" label={VISA_FIELD_LABELS.receiptNumber}>
              <Input disabled={!isNew} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="visaCategory" label={VISA_FIELD_LABELS.visaCategory}>
              <Select options={VISA_CATEGORY_OPTIONS} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="visaSubCategory" label={VISA_FIELD_LABELS.visaSubCategory}>
              <Select allowClear options={VISA_SUB_CATEGORY_OPTIONS} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="filingType" label={VISA_FIELD_LABELS.filingType}>
              <Select allowClear options={FILING_TYPE_OPTIONS} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="filingYear" label={VISA_FIELD_LABELS.filingYear}>
              <Input placeholder="e.g. 2025" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="jobTitle" label={VISA_FIELD_LABELS.jobTitle}>
              <Input />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="lcaId" label={VISA_FIELD_LABELS.lcaId}>
              <Select
                showSearch
                allowClear
                placeholder="Select LCA..."
                optionFilterProp="label"
                options={lcaOptions}
                onChange={onLcaChange}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="lcaNumber" label={VISA_FIELD_LABELS.lcaNumber}>
              <Input />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="socCode" label={VISA_FIELD_LABELS.socCode}>
              <Input />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="lcaWage" label={VISA_FIELD_LABELS.lcaWage}>
              <Input prefix="$" type="number" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="client" label={VISA_FIELD_LABELS.client}>
              <Input />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="customer" label={VISA_FIELD_LABELS.customer}>
              <Input />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item name="jobLocation" label={VISA_FIELD_LABELS.jobLocation}>
              <Input />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item name="jobLocation2" label={VISA_FIELD_LABELS.jobLocation2}>
              <Input />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="startDate" label={VISA_FIELD_LABELS.startDate}>
              <DatePicker style={{ width: "100%" }} format="MM/DD/YYYY" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="endDate" label={VISA_FIELD_LABELS.endDate}>
              <DatePicker style={{ width: "100%" }} format="MM/DD/YYYY" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="approvedDate" label={VISA_FIELD_LABELS.approvedDate}>
              <DatePicker style={{ width: "100%" }} format="MM/DD/YYYY" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="status" label={VISA_FIELD_LABELS.status}>
              <Select options={visaStatusList} />
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </Modal>
  );
}
