import React, { useState, useEffect } from "react";
import {
  Modal,
  Input,
  Form,
  Row,
  Col,
  Card,
  Button,
  DatePicker,
  Select,
  Spin,
  Upload,
  message,
} from "antd";
import { UploadOutlined } from "@ant-design/icons";
import moment from "moment";
import axios from "axios";
import API_ENDPOINTS from "../config";
import { buildPoFileName } from "../Documents/poFileName";

const WorkOrderForm = ({ onClose }) => {
  const { Option } = Select;
  const [form] = Form.useForm();
  const [projectName, setProjectName] = useState(
    localStorage.getItem("projectName") || "",
  );
  const projectId = localStorage.getItem("projectId");
  // const projectName = localStorage.getItem('projectName');
  console.log(projectId);
  console.log(projectName);
  const [generalDetails, setGeneralDetails] = useState({
    wageId: null,
    wageType: "",
    projectId: projectId,
    // customerName: "",
    // customerId: null,
    // clientName: "",
    // clientId: null,
    startDate: "",
    endDate: "",
    wage: 0,
  });
  // Needed only for the Purchase Order filename (PO_<employee>_<customer>_
  // <start>_<end>) — this form otherwise has no employee/customer fields
  // of its own (a work order belongs to the project, whose employee/
  // customer are fixed already).
  const [projectParty, setProjectParty] = useState({ employeeName: "", customerName: "" });
  const [poFile, setPoFile] = useState(null);
  const [uploadingPo, setUploadingPo] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    axios
      .get(API_ENDPOINTS.projectsById(projectId))
      .then(({ data }) => {
        setProjectParty({
          employeeName: data?.employee ? `${data.employee.firstName || ""} ${data.employee.lastName || ""}`.trim() : "",
          customerName: data?.customer?.customerCompanyName || "",
        });
      })
      .catch((error) => console.error("Error fetching project details:", error));
  }, [projectId]);

  const handleGeneralData = (value, field) => {
    setGeneralDetails((prevState) => ({
      ...prevState,
      [field]: value,
    }));
  };

  const handleSubmit = () => {
    // Add selected employee and customer IDs to generalDetails
    const updatedDetails = {
      ...generalDetails,
    };

    console.log("Submitted Details:", updatedDetails);

    // Validate the form data
    // !updatedDetails.clientName ||
    if (!updatedDetails.wage) {
      alert("Please fill in all mandatory fields");
      return;
    }

    handleFormSubmit(updatedDetails);
  };

  // Same 3-step presign/PUT-to-S3/confirm dance as DocumentsPanel (used
  // for COI) — reimplemented here since this form needs to rename the file
  // before upload, which DocumentsPanel's own uploader doesn't do.
  const uploadPurchaseOrder = async (wageId, file, fileName) => {
    const presign = await axios.post(API_ENDPOINTS.presignDocumentUpload, {
      entityType: "WorkOrderPO",
      entityId: wageId,
      fileName,
      contentType: file.type || "application/octet-stream",
    });
    const { uploadUrl, s3Key } = presign.data;
    await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type || "application/octet-stream" },
      body: file,
    });
    await axios.post(API_ENDPOINTS.createDocument, {
      entityType: "WorkOrderPO",
      entityId: wageId,
      fileName,
      s3Key,
      contentType: file.type || "application/octet-stream",
      sizeBytes: file.size,
    });
  };

  const handleFormSubmit = (data) => {
    console.log(data);
    axios
      .post(
        API_ENDPOINTS.saveWage,
        data,
        {
          headers: {
            "Content-Type": "application/json",
          },
        },
      )
      .then(async (response) => {
        if (response && response.status === 200) {
          console.log("response.data: " + JSON.stringify(response.data));
          const newWageId = response.data?.wageId;
          if (poFile && newWageId) {
            setUploadingPo(true);
            try {
              const fileName = buildPoFileName({
                employeeName: projectParty.employeeName,
                customerName: projectParty.customerName,
                startDate: data.startDate,
                endDate: data.endDate,
                originalFileName: poFile.name,
              });
              await uploadPurchaseOrder(newWageId, poFile, fileName);
            } catch (uploadError) {
              console.error("Error uploading purchase order:", uploadError);
              message.error("Work order was saved, but the Purchase Order failed to upload.");
            } finally {
              setUploadingPo(false);
            }
          }
          Modal.success({
            content: "Data saved successfully",
            onOk: onClose,
          });
        } else {
          console.log("Response data does not have expected value");
        }
      })
      .catch((error) => {
        console.error("Error posting data:", error);
        Modal.error({
          content: "Error posting data. Please try again later.",
        });
      });
  };

  const handleClear = () => {
    form.resetFields(); // Resets the Ant Design form fields
    setPoFile(null);
    setGeneralDetails({
      wageId: null,
      projectId: projectId,
      wageType: "",
      // customerName: "",
      // customerId: null,
      // clientName: "",
      // clientId: null,
      startDate: "",
      endDate: "",
      wage: 0,
    });
  };

  //   if (loading) {
  //     return (
  //       <div style={{
  //         display: 'flex',
  //         justifyContent: 'center',
  //         alignItems: 'center',
  //         height: '100vh'
  //       }}>
  //         <Spin size="large" />
  //       </div>
  //     );
  //   }

  return (
    <div className="employee-onboarding-form">
      <h3 className="header">Onboard Project(s)</h3>
      <Card className="employee-onboard-card">
        <Form form={form}>
          <Row gutter={30}>
            <Col span={8} className="form-row">
              <Form.Item label="Project Name" name="projectName">
                <span>{projectName || "N/A"}</span>
              </Form.Item>
            </Col>
            {/* <Col span={8} className='form-row'>
              <Form.Item label="Employee" name="employeeId" rules={[{ required: true, message: 'Please select an employee' }]}>
                <Select value={selectedEmployeeId} onChange={handleEmployeeChange}>
                  {employees.map((employee) => (
                    <Option key={employee.employeeId} value={employee.employeeId}>
                      {employee.firstName + ' ' + employee.lastName}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col> */}

            {/* <Col span={8} className='form-row'>
              <Form.Item label="Customer" name="customerId">
                <Select value={selectedCustomerId} onChange={handleCustomerChange}>
                  {customers.map((customer) => (
                    <Option key={customer.customerId} value={customer.customerId}>
                      {customer.customerCompanyName}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col> */}

            <Col span={8} className="form-row">
              <Form.Item
                label="Bill Rate"
                name="wage"
                rules={[{ required: true }]}
              >
                <Input
                  type="number"
                  onChange={(e) =>
                    handleGeneralData(Number(e.target.value), "wage")
                  }
                  value={generalDetails.wage}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={30}>
            {/* <Col span={8} className='form-row'>
              <Form.Item label="Client" name="clientName" rules={[{ required: true }]}>
                <Input onChange={(e) => handleGeneralData(e.target.value, 'clientName')} value={generalDetails.clientName} />
              </Form.Item>
            </Col> */}

            {/* <Col span={8} className='form-row'>
              <Form.Item label="Project Name" name="projectName">
                <Input value={projectName} />
              </Form.Item>
            </Col> */}
          </Row>

          <Row gutter={30}>
            <Col span={8} className="form-row">
              <Form.Item label="Start Date">
                <DatePicker
                  onChange={(date) =>
                    handleGeneralData(date ? date.format("YYYY-MM-DD") : "", "startDate")
                  }
                  format="MM/DD/YYYY"
                  value={
                    generalDetails.startDate
                      ? moment(generalDetails.startDate)
                      : null
                  }
                />
              </Form.Item>
            </Col>

            <Col span={8} className="form-row">
              <Form.Item label="End Date">
                <DatePicker
                  onChange={(date) =>
                    handleGeneralData(date ? date.format("YYYY-MM-DD") : "", "endDate")
                  }
                  format="MM/DD/YYYY"
                  value={
                    generalDetails.endDate
                      ? moment(generalDetails.endDate)
                      : null
                  }
                />
              </Form.Item>
            </Col>
            <Col span={8} className="form-row">
              <Form.Item label="Purchase Order">
                <Upload
                  beforeUpload={(file) => {
                    setPoFile(file);
                    return false; // hold locally — actual upload happens after the work order is saved
                  }}
                  onRemove={() => setPoFile(null)}
                  fileList={poFile ? [{ uid: "po", name: poFile.name }] : []}
                  maxCount={1}
                >
                  <Button icon={<UploadOutlined />} loading={uploadingPo}>
                    Select File
                  </Button>
                </Upload>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={30}>
            <Col span={8} className="form-row">
              <Button type="primary" onClick={handleClear}>
                Clear
              </Button>
            </Col>

            <Col span={8} className="form-row">
              <Button type="primary" onClick={onClose}>
                Cancel
              </Button>
            </Col>

            <Col span={8} className="form-row">
              <Button type="primary" onClick={handleSubmit}>
                Onboard
              </Button>
            </Col>
          </Row>
        </Form>
      </Card>
    </div>
  );
};

export default WorkOrderForm;
