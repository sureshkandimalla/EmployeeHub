import { Button, Modal, Form, Input, DatePicker, Select, Row, Col } from "antd";

const MODAL_HEADER_COLOR = "#1677ff";

const NATIONALITY_OPTIONS = [
  { value: "Indian",     label: "Indian" },
  { value: "American",   label: "American" },
  { value: "Canadian",   label: "Canadian" },
  { value: "British",    label: "British" },
  { value: "Australian", label: "Australian" },
  { value: "Other",      label: "Other" },
];

const GENDER_OPTIONS = [
  { value: "Male",   label: "Male" },
  { value: "Female", label: "Female" },
  { value: "Other",  label: "Other" },
];

const STATUS_OPTIONS = [
  { value: "Active",   label: "Active" },
  { value: "Expired",  label: "Expired" },
  { value: "Revoked",  label: "Revoked" },
];

/**
 * PassportFormModal — shared modal for Add and Edit passport operations.
 *
 * Props:
 *  open             {boolean}       — controls visibility
 *  isNew            {boolean}       — true = create, false = edit
 *  form             {FormInstance}  — Ant Design form instance (from parent)
 *  saving           {boolean}       — shows loading on save button
 *  onCancel         {function}      — close handler
 *  onSave           {function}      — form onFinish handler (receives form values)
 *  employeeOptions  {array}         — [{ value: employeeId, label: "Full Name" }]
 *  selectedEmployee {string}        — pre-filled employee name (read-only display)
 */
export default function PassportFormModal({
  open,
  isNew,
  form,
  saving,
  onCancel,
  onSave,
  employeeOptions = [],
  selectedEmployee = "",
  onEmployeeChange,
  showEmployeeSelect = true,
}) {
  const title = (
    <span style={{ color: MODAL_HEADER_COLOR, fontWeight: 600 }}>
      {isNew
        ? "Add Passport"
        : `Edit Passport${selectedEmployee ? ` — ${selectedEmployee}` : ""}`}
    </span>
  );

  const footer = [
    <Button key="cancel" onClick={onCancel}>
      Cancel
    </Button>,
    <Button key="save" type="primary" loading={saving} onClick={() => form.submit()}>
      {isNew ? "Create Passport" : "Save"}
    </Button>,
  ];

  return (
    <Modal
      title={title}
      open={open}
      onCancel={onCancel}
      width={800}
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
          {/* Employee selector — hidden when employeeData is pre-provided */}
          {showEmployeeSelect && (
            <Col span={24}>
              <Form.Item
                name="employeeId"
                label="Employee"
                rules={[{ required: true, message: "Please select an employee" }]}
              >
                <Select
                  showSearch
                  placeholder="Search employee..."
                  optionFilterProp="label"
                  options={employeeOptions}
                  onChange={onEmployeeChange}
                  filterOption={(input, option) =>
                    option?.label?.toLowerCase().includes(input.toLowerCase())
                  }
                />
              </Form.Item>
            </Col>
          )}

          {/* Name fields — auto-populated from employee */}
          <Col span={8}>
            <Form.Item name="firstName" label="First Name" rules={[{ required: true, message: "Required" }]}>
              <Input />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="middleName" label="Middle Name">
              <Input />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="lastName" label="Last Name" rules={[{ required: true, message: "Required" }]}>
              <Input />
            </Form.Item>
          </Col>

          {/* Passport number */}
          <Col span={12}>
            <Form.Item name="passportNumber" label="Passport Number" rules={[{ required: true, message: "Required" }]}>
              <Input placeholder="e.g. A1234567" />
            </Form.Item>
          </Col>

          {/* Gender */}
          <Col span={12}>
            <Form.Item name="gender" label="Gender">
              <Select allowClear options={GENDER_OPTIONS} placeholder="Select gender" />
            </Form.Item>
          </Col>

          {/* Date of birth */}
          <Col span={12}>
            <Form.Item name="dateOfBirth" label="Date of Birth">
              <DatePicker style={{ width: "100%" }} format="MM/DD/YYYY" />
            </Form.Item>
          </Col>

          {/* Nationality */}
          <Col span={12}>
            <Form.Item name="nationality" label="Nationality">
              <Select allowClear options={NATIONALITY_OPTIONS} placeholder="Select nationality" />
            </Form.Item>
          </Col>

          {/* Country of birth */}
          <Col span={12}>
            <Form.Item name="countryOfBirth" label="Country of Birth">
              <Input />
            </Form.Item>
          </Col>

          {/* Place of issue */}
          <Col span={12}>
            <Form.Item name="placeOfIssue" label="Place of Issue">
              <Input />
            </Form.Item>
          </Col>

          {/* Issue / Expiry dates */}
          <Col span={12}>
            <Form.Item name="issueDate" label="Issue Date">
              <DatePicker style={{ width: "100%" }} format="MM/DD/YYYY" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="expiryDate" label="Expiry Date">
              <DatePicker style={{ width: "100%" }} format="MM/DD/YYYY" />
            </Form.Item>
          </Col>

          {/* Status */}
          <Col span={12}>
            <Form.Item name="status" label="Status">
              <Select allowClear options={STATUS_OPTIONS} placeholder="Select status" />
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </Modal>
  );
}
