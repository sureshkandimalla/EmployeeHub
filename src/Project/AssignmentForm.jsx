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
} from "antd";
import moment from "moment";
import axios from "axios";
import API_ENDPOINTS from "../config";

const AssignmentForm = ({ onClose }) => {
  const { Option } = Select;
  const [form] = Form.useForm();
  const [selectedEmployeeId, setSelectedEmployeeId] = useState();
  const [selectedCustomerId, setSelectedCustomerId] = useState();
  const [employees, setEmployeesData] = useState([]);
  const [customers, setCustomersData] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const assignmentTypes = [
    { label: "EMPLOYEE PAY", value: "EMP_PAY" },
    { label: "REFERRAL", value: "EMP_REF" },
    { label: "COMMISSION", value: "EMP_COMM" },
  ];
  const assignmentTaxTypes = ["W2", "1099", "C2C"];

  const projectId = localStorage.getItem("projectId");
  const projectName = localStorage.getItem("projectName");
  console.log(projectId);
  console.log(projectName);
  const [generalDetails, setGeneralDetails] = useState({
    employeeId: null,
    projectId: projectId,
    projectName: projectName || "",
    // customerName: "",
    // customerId: null,
    // clientName: "",
    // clientId: null,
    startDate: "",
    status: "",
    endDate: "",
    wage: 0,
    assignmentType: "",
    assignmentTaxType: "",
    assignmentNotes: [],
    lastUpdated: "",
  });

  useEffect(() => {
    const fetchEmployeesAndCustomers = async () => {
      try {
        const [employeesData, customersData] = await Promise.all([
          fetch(API_ENDPOINTS.getEmployees).then((response) => response.json()),
          fetch(API_ENDPOINTS.getAllCustomers).then((response) => response.json()),
        ]);

        setEmployeesData(employeesData);
        setCustomersData(customersData);
      } catch (error) {
        console.error("Error fetching data:", error);
        Modal.error({
          content:
            "Error fetching employees or customers. Please try again later.",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchEmployeesAndCustomers();
  }, []);

  const handleEmployeeChange = (value) => {
    setSelectedEmployeeId(value);
  };

  const handleCustomerChange = (value) => {
    setSelectedCustomerId(value);
  };

  const handleAssignmentChange = (value) => {
    setGeneralDetails((prevDetails) => ({
      ...prevDetails,
      assignmentType: value,
    }));
  };
  const handleAssignmentTaxChange = (value) => {
    setGeneralDetails((prevDetails) => ({
      ...prevDetails,
      assignmentTaxType: value,
    }));
  };

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
      employeeId: selectedEmployeeId,
    };

    console.log("Submitted Details:", updatedDetails);

    // Validate the form data
    // !updatedDetails.clientName ||
    // employeeId is required (see the Select's `rules` above) but that
    // Ant Design validation never actually runs since this handler reads
    // state directly instead of calling form.validateFields() — checking
    // it here is what actually enforces it. Without this, employeeId ends
    // up undefined in the request and the backend's primitive `long`
    // field silently saves it as 0 (a real, invalid employee id).
    if (!updatedDetails.employeeId || !updatedDetails.assignmentType || !updatedDetails.wage) {
      alert("Please fill in all mandatory fields");
      return;
    }

    handleFormSubmit(updatedDetails);
  };

  const handleFormSubmit = (data) => {
    axios
      .post(
        API_ENDPOINTS.assignments,
        data,
        {
          headers: {
            "Content-Type": "application/json",
          },
        },
      )
      .then((response) => {
        if (response && response.status === 200) {
          console.log("response.data: " + response.data);
          Modal.success({
            content: "Data saved successfully",
            onOk: onClose,
          });
        } else {
          // Handle other cases
          console.log("Response data does not have expected value");
        }
      })
      .catch((error) => {
        console.error("Error posting data:", error);
        // Display error message
        Modal.error({
          content: "Error posting data. Please try again later.",
        });
      });
  };

  const handleClear = () => {
    form.resetFields(); // Resets the Ant Design form fields
    setSelectedEmployeeId(null); // Clear selected employee
    setSelectedCustomerId(null); // Clear selected customer
    setGeneralDetails({
      employeeId: null,
      projectId: null,
      projectName: projectName || "", // Retain the project name from localStorage
      assignmentType: "",
      status: "",
      //   customerName: "",
      //   customerId: null,
      //   clientName: "",
      //   clientId: null,
      startDate: "",
      assignmentNotes: [],
      endDate: "",
      wage: 0,
      assignmentTaxType: "",
    });
  };

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
        }}
      >
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="employee-onboarding-form">
      <h3 className="header">Onboard Project(s)</h3>
      <Card className="employee-onboard-card">
        <Form form={form}>
        <Row gutter={30}>
            <Col span={10} className="form-row">
            <Form.Item label="Project Name" name="projectName">
                <span>{projectName || "N/A"}</span>
              </Form.Item>
              </Col>
              </Row>
          <Row gutter={30}>
            <Col span={10} className="form-row">
              <Form.Item
                label="Assignment for :"
                name="employeeId"
                rules={[
                  { required: true, message: "Please select an employee" },
                ]}
              >
                <Select
                  showSearch
                  value={selectedEmployeeId}
                  onChange={handleEmployeeChange}
                  filterOption={(input, option) =>
                    option?.children
                      ?.toLowerCase()
                      .includes(input.toLowerCase())
                  }
                >
                  {employees.map((employee) => (
                    <Option
                      key={employee.employeeId}
                      value={employee.employeeId}
                    >
                      {employee.name}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
              
            </Col>

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

            <Col span={10} className="form-row">
              <Form.Item label="AssignmentType" name="assignmentType">
                <Select
                  showSearch
                  value={generalDetails.assignmentType}
                  onChange={handleAssignmentChange}
                  filterOption={(input, option) =>
                    option?.children
                      ?.toLowerCase()
                      .includes(input.toLowerCase())
                  }
                >
                  {assignmentTypes.map((assign) => (
                    <Option key={assign.label} value={assign.value}>
                      {assign.key}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={10} className="form-row">
              <Form.Item label="AssignmentTaxType" name="assignmentTaxType">
                <Select
                  showSearch
                  value={generalDetails.assignmentTaxType}
                  onChange={handleAssignmentTaxChange}
                  filterOption={(input, option) =>
                    option?.children
                      ?.toLowerCase()
                      .includes(input.toLowerCase())
                  }
                >
                  {assignmentTaxTypes.map((assignTax) => (
                    <Option key={assignTax} value={assignTax}></Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>

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

export default AssignmentForm;
