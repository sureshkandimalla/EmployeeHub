import { Button, Modal, Form, Input, DatePicker, Select, Row, Col } from "antd";
import { LCA_FIELD_LABELS, LCA_STATUS_OPTIONS, LCA_WAGE_LEVEL_OPTIONS } from "./visaConstants";

const MODAL_HEADER_COLOR = "#1677ff";

/**
 * LcaFormModal — shared modal for Add and Edit LCA operations.
 *
 * Props:
 *  open              {boolean}       — controls visibility
 *  isNew             {boolean}       — true = create (POST), false = edit
 *  lcaData           {object}        — existing LCA object (used for title)
 *  form              {FormInstance}  — Ant Design form instance (from parent)
 *  saving            {boolean}       — shows loading on save button
 *  onCancel          {function}      — close handler
 *  onSave            {function}      — form onFinish handler
 *  showEmployeeSelect{boolean}       — show employee picker (for standalone Add New LCA)
 *  employeeOptions   {array}         — [{ value, label }] for employee dropdown
 */
export default function LcaFormModal({
  open,
  isNew,
  lcaData,
  form,
  saving,
  onCancel,
  onSave,
  showEmployeeSelect = false,
  employeeOptions = [],
}) {
  const title = (
    <span style={{ color: MODAL_HEADER_COLOR, fontWeight: 600 }}>
      {isNew ? "Add New LCA" : `LCA Details — ${lcaData?.lcaNumber || ""}`}
    </span>
  );

  return (
    <Modal
      title={title}
      open={open}
      onCancel={onCancel}
      width={760}
      destroyOnClose
      styles={{
        header:  { borderBottom: `2px solid ${MODAL_HEADER_COLOR}`, paddingBottom: 12 },
        content: { borderTop: `4px solid ${MODAL_HEADER_COLOR}`, borderRadius: 8 },
      }}
      footer={[
        <Button key="cancel" onClick={onCancel}>Cancel</Button>,
        <Button key="save" type="primary" loading={saving} onClick={() => form.submit()}>
          {isNew ? "Create LCA" : "Save"}
        </Button>,
      ]}
    >
      <Form form={form} layout="vertical" onFinish={onSave}>
        <Row gutter={16}>
          {showEmployeeSelect && (
            <Col span={24}>
              <Form.Item name="employeeId" label="Employee" rules={[{ required: true, message: "Please select an employee" }]}>
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
            <Form.Item name="lcaNumber" label={LCA_FIELD_LABELS.lcaNumber}>
              <Input disabled={!isNew} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="lcaCaseNumber" label={LCA_FIELD_LABELS.lcaCaseNumber}>
              <Input />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="jobTitle" label={LCA_FIELD_LABELS.jobTitle}>
              <Input />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="socCode" label={LCA_FIELD_LABELS.socCode}>
              <Input />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="lcaWage" label={LCA_FIELD_LABELS.lcaWage}>
              <Input prefix="$" type="number" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="wageLevel" label={LCA_FIELD_LABELS.wageLevel}>
              <Select allowClear options={LCA_WAGE_LEVEL_OPTIONS} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="status" label={LCA_FIELD_LABELS.status}>
              <Select options={LCA_STATUS_OPTIONS} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="client" label={LCA_FIELD_LABELS.client}>
              <Input />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="customer" label={LCA_FIELD_LABELS.customer}>
              <Input />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item name="jobLocation" label={LCA_FIELD_LABELS.jobLocation}>
              <Input />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item name="jobLocation2" label={LCA_FIELD_LABELS.jobLocation2}>
              <Input />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item name="noticePostedLocation" label={LCA_FIELD_LABELS.noticePostedLocation}>
              <Input />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item name="noticePostedLocation2" label={LCA_FIELD_LABELS.noticePostedLocation2}>
              <Input />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="employmentStartDate" label={LCA_FIELD_LABELS.employmentStartDate}>
              <DatePicker style={{ width: "100%" }} format="MM/DD/YYYY" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="employmentEndDate" label={LCA_FIELD_LABELS.employmentEndDate}>
              <DatePicker style={{ width: "100%" }} format="MM/DD/YYYY" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="lcaPostedFromDate" label={LCA_FIELD_LABELS.lcaPostedFromDate}>
              <DatePicker style={{ width: "100%" }} format="MM/DD/YYYY" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="lcaPostedToDate" label={LCA_FIELD_LABELS.lcaPostedToDate}>
              <DatePicker style={{ width: "100%" }} format="MM/DD/YYYY" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="certifiedDate" label={LCA_FIELD_LABELS.certifiedDate}>
              <DatePicker style={{ width: "100%" }} format="MM/DD/YYYY" />
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </Modal>
  );
}
