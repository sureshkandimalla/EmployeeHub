import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  Modal,
  Input,
  Form,
  Row,
  Col,
  Card,
  Radio,
  Button,
  DatePicker,
  Select,
  Spin,
  Upload,
  message,
} from "antd";
import { UploadOutlined } from "@ant-design/icons";
import { validateEmail } from "../utils";
import { INVOICE_TERM_OPTIONS, WEEK_START_DAY_OPTIONS, DEFAULT_WEEK_START_DAY } from "../Utils/invoiceTerm";
//import Sidebar from '../../Commons/Sidebar/Sidebar';
//import './EmployeeOnBoarding.scss';
import moment from "moment";
import API_ENDPOINTS, { paymentTermsList, projectStatus } from "../config";
import { buildPoFileName } from "../Documents/poFileName";
//import React, { useState, useEffect } from "react";
//import { useLocation } from 'react-router-dom'

// Pass `editingProject` (a project row, e.g. from ProjectGrid) to edit an
// existing project instead of creating a new one — every field is
// pre-populated from it, Employee/Customer become locked (reassigning a
// project to someone else isn't a thing this form supports), and saving
// updates the project/wage/work-site-address records in place rather than
// creating new ones. This is also the only way to add a Work Location to a
// project that was onboarded before that feature existed.
const ProjectOnBoardingForm = ({ onClose, editingProject }) => {
  const { Option } = Select;
  const isEditMode = !!editingProject;
  const [form] = Form.useForm();
  const [rowData, setRowData] = useState();
  const [selectedEmployeeId, setSelectedEmployeeId] = useState();
  const [selectedCustomerId, setSelectedCustomerId] = useState();
  const [employees, setEmployeesData] = useState();
  const [customers, setCustomersData] = useState();
  const [loading, setLoading] = useState(true);
  const [wageId, setWageId] = useState(null);
  // Held locally and uploaded only after the project itself is saved and
  // has a real projectId — DocumentsPanel's presign/confirm flow (same one
  // used for COI) needs an existing entityId, which doesn't exist yet
  // while this form is still being filled out.
  const [poFile, setPoFile] = useState(null);
  const [uploadingPo, setUploadingPo] = useState(false);

  // Work site address for this project — captured here rather than left to
  // a separate step, since it's needed (for H1B compliance, among other
  // things) from the moment the assignment starts. Stored as a WORKSITE-
  // type Address row tied to the project once it's created (see
  // handleFormSubmit below), reusing the same Address table/endpoint as the
  // employee's home address history, distinguished by `type`.
  const [workArrangement, setWorkArrangement] = useState(null);
  const [workAddress, setWorkAddress] = useState({
    address: "",
    city: "",
    state: "",
    zipCode: "",
    country: "",
  });
  const [loadingHomeAddress, setLoadingHomeAddress] = useState(false);

  const handleWorkArrangementChange = (value) => {
    setWorkArrangement(value);
    if (value === "Remote" && selectedEmployeeId) {
      fetchHomeAddressForWorksite(selectedEmployeeId);
    } else {
      // Hybrid/Onsite always starts blank — carrying over a Remote
      // prefill here risks someone submitting a home address as the
      // on-site work location by accident.
      setWorkAddress({ address: "", city: "", state: "", zipCode: "", country: "" });
    }
  };

  // Remote defaults the work site address to the employee's current home
  // address — still editable afterward, since a remote worker's actual
  // setup may differ from what's on file.
  const fetchHomeAddressForWorksite = async (employeeId) => {
    setLoadingHomeAddress(true);
    try {
      const { data } = await axios.get(
        `${API_ENDPOINTS.getEmployeeAddressHistory(employeeId)}?type=HOME`,
      );
      const home = (data || []).find((a) => a.active == null || a.active) || data?.[0];
      if (home) {
        setWorkAddress({
          address: home.address || "",
          city: home.city || "",
          state: home.state || "",
          zipCode: home.zipCode || "",
          country: home.country || "",
        });
      }
    } catch (error) {
      console.error("Error fetching home address:", error);
    } finally {
      setLoadingHomeAddress(false);
    }
  };

  const handleWorkAddressChange = (field, value) => {
    setWorkAddress((prev) => ({ ...prev, [field]: value }));
  };

  const fetchEmployeesAndCustomers = async () => {
    try {
      const [employeesData, customersData] = await Promise.all([
        fetch(API_ENDPOINTS.getEmployees).then((response) => response.json()),
        fetch(API_ENDPOINTS.getAllCustomers).then((response) => response.json()),
      ]);

      setEmployeesData(getFlattenedData(employeesData));
      setCustomersData(getFlattenedData(customersData));
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

  // Call fetchEmployeesAndCustomers when the component mounts
  useEffect(() => {
    fetchEmployeesAndCustomers();
  }, []);
  console.log(employees);
  console.log(customers);
  // Default Project Name to "<Employee first name>_<Customer's first word>"
  // once both are picked — still a plain editable field, so the user can
  // override it afterward.
  const buildAutoProjectName = (employeeId, customerId) => {
    const employee = employees?.find((e) => e.employeeId === employeeId);
    const customer = customers?.find((c) => c.customerId === customerId);
    if (!employee || !customer) return "";
    const firstName = (employee.name || "").trim().split(" ")[0] || "";
    const customerFirstWord =
      (customer.customerCompanyName || "").trim().split(" ")[0] || "";
    return firstName && customerFirstWord
      ? `${firstName}_${customerFirstWord}`
      : "";
  };

  const handleEmployeeChange = (value) => {
    setSelectedEmployeeId(value);
    const autoName = buildAutoProjectName(value, selectedCustomerId);
    if (autoName) {
      setGeneralDetails((prev) => ({ ...prev, projectName: autoName }));
      // Form.Item's `name="project Name"` makes AntD's own form store the
      // source of truth for the displayed value — updating generalDetails
      // alone doesn't reach the DOM, so the form store needs the same push.
      form.setFieldsValue({ "project Name": autoName });
    }
    if (workArrangement === "Remote" && value) {
      fetchHomeAddressForWorksite(value);
    }
  };

  const handleCustomerChange = (value) => {
    setSelectedCustomerId(value);
    const autoName = buildAutoProjectName(selectedEmployeeId, value);
    if (autoName) {
      setGeneralDetails((prev) => ({ ...prev, projectName: autoName }));
      form.setFieldsValue({ "project Name": autoName });
    }
  };

  //const history = useHistory();
  //const location = useLocation();
  //const { rowData } = location.state;
  const [generalDetails, setGeneralDetails] = useState({
    projectId: null,
    projectName: "",
    employeeId: null,
    employeeName: "",
    customerName: "",
    customerId: null,
    clientName: "",
    client: "",
    clientId: null,
    startDate: "", // ISO string format
    endDate: "", // ISO string format
    // The work order's own dates — a project can run longer than any one
    // work order, and later work orders (added via WorkOrderForm) each
    // carry their own dates too, so these are kept independent of
    // startDate/endDate above.
    workOrderStartDate: "",
    workOrderEndDate: "",
    billRate: 0,
    employeePay: 0,
    expenseInternal: 0,
    expenseExternal: 0,
    net: 0,
    status: "",
    invoiceTerm: null,
    paymentTerm: "",
    weekStartDay: DEFAULT_WEEK_START_DAY,
    hours: 0,
    invoiceId: 0,
    Billing: 0,
    total: 0,
  });

  // Prefill everything from the project being edited once employees/
  // customers have loaded (buildAutoProjectName and the Select options both
  // need those lists first). Also fetches the project's current work site
  // address, if one's been captured, so it isn't mistaken for "never set".
  useEffect(() => {
    if (!isEditMode || !employees || !customers) return;

    const firstWage = editingProject.billRates?.[0];
    setSelectedEmployeeId(editingProject.employee?.employeeId);
    setSelectedCustomerId(editingProject.customer?.customerId);
    setWageId(firstWage?.wageId || null);

    const prefill = {
      projectId: editingProject.projectId,
      employeeId: editingProject.employee?.employeeId,
      customerId: editingProject.customer?.customerId,
      client: editingProject.client || "",
      projectName: editingProject.projectName || "",
      startDate: editingProject.startDate || "",
      endDate: editingProject.endDate || "",
      workOrderStartDate: firstWage?.startDate || editingProject.startDate || "",
      workOrderEndDate: firstWage?.endDate || editingProject.endDate || "",
      billRate: firstWage?.wage || 0,
      status: editingProject.status || "",
      invoiceTerm: editingProject.invoiceTerm || null,
      paymentTerm: editingProject.paymentTerm || "",
      weekStartDay: editingProject.weekStartDay || DEFAULT_WEEK_START_DAY,
    };
    setGeneralDetails((prev) => ({ ...prev, ...prefill }));
    form.setFieldsValue({
      employeeId: prefill.employeeId,
      customerId: prefill.customerId,
      Client: prefill.client,
      "project Name": prefill.projectName,
      "Bill Rate": prefill.billRate,
      Status: prefill.status,
      "Invoice Term": prefill.invoiceTerm,
      "Payment Term": prefill.paymentTerm,
      "Week Start Day": prefill.weekStartDay,
    });

    axios
      .get(API_ENDPOINTS.getWorksiteAddressForProject(editingProject.projectId))
      .then(({ data }) => {
        if (!data) return;
        setWorkAddress({
          address: data.address || "",
          city: data.city || "",
          state: data.state || "",
          zipCode: data.zipCode || "",
          country: data.country || "",
        });
        if (data.workArrangement) {
          setWorkArrangement(data.workArrangement);
          form.setFieldsValue({ "Work Arrangement": data.workArrangement });
        }
      })
      .catch((error) => console.error("Error fetching work site address:", error));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditMode, employees, customers]);

  // Same 3-step presign/PUT-to-S3/confirm dance as DocumentsPanel (used for
  // COI) — reimplemented here rather than reused because DocumentsPanel is
  // a self-fetching list+uploader that needs an existing entityId; this
  // form only has one to give it after the project save below resolves.
  // Attached to the work order (wageId), not the project — a project can
  // have several work orders, each with its own PO.
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

  // Updates the existing Project, its first Wage (bill rate / WO dates —
  // see ProjectsList.jsx's identical split), and upserts the work site
  // address. Project's own Start/End Date aren't included — ProjectController
  // #updateProject doesn't accept them (see its own comment), so there's
  // nothing to send; they stay whatever they were set to at creation.
  const handleUpdateSubmit = async (details) => {
    try {
      await axios.put(API_ENDPOINTS.projectsById(details.projectId), {
        projectName: details.projectName,
        invoiceTerm: details.invoiceTerm,
        paymentTerm: details.paymentTerm,
        status: details.status,
        client: details.client,
        weekStartDay: details.weekStartDay,
      });
      if (wageId) {
        await axios.put(API_ENDPOINTS.wagesById(wageId), {
          wage: details.billRate,
          startDate: details.workOrderStartDate,
          endDate: details.workOrderEndDate,
        });
      }
      if (workAddress.address) {
        await axios.put(API_ENDPOINTS.updateEmployeeAddress(selectedEmployeeId), {
          ...workAddress,
          type: "WORKSITE",
          workArrangement,
          projectId: details.projectId,
        });
      }
      Modal.success({ content: "Project updated successfully", onOk: onClose });
    } catch (error) {
      console.error("Error updating project:", error);
      Modal.error({ content: "Error updating project. Please try again later." });
    }
  };

  const handleFormSubmit = (generalDetails) => {
    //api should be called here

    axios
      .post(
        API_ENDPOINTS.saveOnBoardProject,
        generalDetails,
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
          const newProjectId = response.data?.projectId;
          if (newProjectId && workAddress.address) {
            try {
              await axios.put(API_ENDPOINTS.updateEmployeeAddress(selectedEmployeeId), {
                ...workAddress,
                type: "WORKSITE",
                workArrangement,
                projectId: newProjectId,
                startDate: generalDetails.startDate || null,
              });
            } catch (addressError) {
              console.error("Error saving work site address:", addressError);
              message.error("Project was saved, but the work site address failed to save.");
            }
          }
          if (poFile && newWageId) {
            setUploadingPo(true);
            try {
              const employee = employees?.find((e) => e.employeeId === selectedEmployeeId);
              const customer = customers?.find((c) => c.customerId === selectedCustomerId);
              const fileName = buildPoFileName({
                employeeName: employee?.name,
                customerName: customer?.customerCompanyName,
                startDate: generalDetails.workOrderStartDate || generalDetails.startDate,
                endDate: generalDetails.workOrderEndDate || generalDetails.endDate,
                originalFileName: poFile.name,
              });
              await uploadPurchaseOrder(newWageId, poFile, fileName);
            } catch (uploadError) {
              console.error("Error uploading purchase order:", uploadError);
              message.error("Project was saved, but the Work Order file failed to upload.");
            } finally {
              setUploadingPo(false);
            }
          }
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

  const getFlattenedData = (data) => {
    let updatedData = data.map((dataObj) => {
      return { ...dataObj };

      // return { ...dataObj,...dataObj.assignments[0],...dataObj.employee.firstName.value, ...dataObj.employee.employeeAssignments[0],...dataObj.customer,...dataObj.billRates[0] }
    });
    console.log(updatedData);
    return updatedData || [];
  };

  const handleClear = () => {
    form.resetFields();
    setPoFile(null);
    setWorkArrangement(null);
    setWorkAddress({ address: "", city: "", state: "", zipCode: "", country: "" });
    setGeneralDetails({
      projectId: null,
      projectName: "",
      employeeId: null,
      employeeName: "",
      customerName: "",
      customerId: null,
      clientName: "",
      client: "",
      clientId: null,
      startDate: "", // ISO string format
      endDate: "", // ISO string format
      workOrderStartDate: "",
      workOrderEndDate: "",
      billRate: 0,
      employeePay: 0,
      expenseInternal: 0,
      expenseExternal: 0,
      net: 0,
      status: "",
      invoiceTerm: null,
      paymentTerm: "",
      weekStartDay: DEFAULT_WEEK_START_DAY,
      hours: 0,
      invoiceId: 0,
      Billing: 0,
      total: 0,
    });
  };
  const handleCancel = () => {
    //history.push('/project')
    Modal.warning({
      content: "Are you sure you want to cancel?",
      onOk: onClose,
    });
  };

  const handleSubmit = () => {
    if (selectedEmployeeId && selectedCustomerId) {
      generalDetails.employeeId = selectedEmployeeId;
      generalDetails.customerId = selectedCustomerId;
    }
    // Validate the form data
    if (
      !generalDetails.customerId ||
      !generalDetails.customerId ||
      !generalDetails.client ||
      !generalDetails.projectName ||
      !generalDetails.status ||
      !generalDetails.billRate ||
      !generalDetails.startDate ||
      !generalDetails.workOrderStartDate
    ) {
      alert("Please fill in all mandatory fields");
      return;
    }
    //     alert(rowData.employeeId);
    //     alert(generalDetails.employeeId);
    //     if(rowData.employeeId !== undefined){
    //     if( rowData.employeeId != generalDetails.employeeId ){
    //         alert("Please enter correct EmployeeId");
    //         return;
    //     }
    // }

    //console.log("generalDetails: "+generalDetails);
    // Make API call with formData
    if (isEditMode) {
      handleUpdateSubmit(generalDetails);
    } else {
      handleFormSubmit(generalDetails);
    }

    // Clear the form after submission
    //handleClear();
  };

  const handleGeneralData = (value, field) => {
    setGeneralDetails((prevState) => ({
      ...prevState,
      [field]: value,
    }));
  };
  console.log(loading);
  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh", // Full viewport height
        }}
      >
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="employee-onboarding-form">
      <h3 className="header">{isEditMode ? "Edit Project" : "Onboard Project(s)"}</h3>
      <Card className="employee-onboard-card">
        <Form form={form}>
          <Row className="card-header-section">
            <Col>
              <h4 className="header">Project Details</h4>
            </Col>
            <Col>
              <span>
                Mandatory Fields are marked with{" "}
                <span className="asterisk">*</span>
              </span>
            </Col>
          </Row>
          <Row gutter={30}>
            <Col span={12} className="form-row">
              <Form.Item
                label="Employee"
                name="employeeId"
                rules={[
                  { required: true, message: "Please select an employee" },
                ]}
              >
                <Select
                  showSearch
                  disabled={isEditMode}
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
            <Col span={12} className="form-row">
              <Form.Item
                label="Customer"
                name="customerId"
                rules={[{ required: true, message: "Please select a customer" }]}
              >
                <Select
                  showSearch
                  disabled={isEditMode}
                  value={selectedCustomerId}
                  onChange={handleCustomerChange}
                  filterOption={(input, option) =>
                    option?.children
                      ?.toLowerCase()
                      .includes(input.toLowerCase())
                  }
                >
                  {customers.map((customer) => (
                    <Option key={customer.customerId} value={customer.customerId}>
                      {customer.customerCompanyName}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={30}>
            <Col span={12} className="form-row">
              <Form.Item
                label="Work Arrangement"
                name="Work Arrangement"
                rules={isEditMode ? [] : [{ required: true, message: "Please select a work arrangement" }]}
                tooltip={isEditMode ? "Optional here — pick it to re-fetch the home address for Remote; the work location below is editable either way." : undefined}
              >
                <Select placeholder="Select Work Arrangement" onChange={handleWorkArrangementChange}>
                  <Option value="Remote">Remote</Option>
                  <Option value="Hybrid">Hybrid</Option>
                  <Option value="Onsite">Onsite</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          {(workArrangement || isEditMode) && (
            <Row gutter={30}>
              <Col span={24} className="form-row">
                <Spin spinning={loadingHomeAddress} tip="Loading employee's home address...">
                  <Row gutter={16}>
                    <Col span={24}>
                      <Form.Item label="Work Site Address">
                        <Input
                          placeholder="Address"
                          value={workAddress.address}
                          onChange={(e) => handleWorkAddressChange("address", e.target.value)}
                        />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Row gutter={16}>
                    <Col span={6}>
                      <Form.Item label="City">
                        <Input
                          value={workAddress.city}
                          onChange={(e) => handleWorkAddressChange("city", e.target.value)}
                        />
                      </Form.Item>
                    </Col>
                    <Col span={6}>
                      <Form.Item label="State">
                        <Input
                          value={workAddress.state}
                          onChange={(e) => handleWorkAddressChange("state", e.target.value)}
                        />
                      </Form.Item>
                    </Col>
                    <Col span={6}>
                      <Form.Item label="Zip Code">
                        <Input
                          value={workAddress.zipCode}
                          onChange={(e) => handleWorkAddressChange("zipCode", e.target.value)}
                        />
                      </Form.Item>
                    </Col>
                    <Col span={6}>
                      <Form.Item label="Country">
                        <Input
                          value={workAddress.country}
                          onChange={(e) => handleWorkAddressChange("country", e.target.value)}
                        />
                      </Form.Item>
                    </Col>
                  </Row>
                </Spin>
              </Col>
            </Row>
          )}
          <Row gutter={30}>
            <Col span={12} className="form-row">
              <Form.Item
                label="Client"
                name="Client"
                rules={[{ required: true }]}
              >
                <Input
                  onChange={(e) => handleGeneralData(e.target.value, "client")}
                  value={generalDetails.client}
                />
              </Form.Item>
            </Col>
            <Col span={12} className="form-row">
              <Form.Item
                label="Project Name"
                name="project Name"
                rules={[{ required: true }]}
              >
                <Input
                  onChange={(e) =>
                    handleGeneralData(e.target.value, "projectName")
                  }
                  value={generalDetails.projectName}
                />
              </Form.Item>
            </Col>
            {/* <Col span={8} className='form-row'>
                                <Form.Item label="WebSite" name="webSite" >
                                    <Input onChange={(e) => handleGeneralData(e.target.value, 'webSite')} value={generalDetails.webSite} />
                                </Form.Item>
                            </Col>   */}
          </Row>
          <Row gutter={30}>
            <Col span={12} className="form-row">
              <Form.Item
                label="Start Date"
                rules={[{ required: true }]}
                tooltip={isEditMode ? "Not editable after creation — update the WO Start Date below instead." : undefined}
              >
                <DatePicker
                  disabled={isEditMode}
                  onChange={(date) => {
                    // WO Start Date tracks the project's own Start Date —
                    // keeps the two in sync since a project's first work
                    // order normally starts the same day the project does.
                    const iso = date ? date.format("YYYY-MM-DD") : "";
                    setGeneralDetails((prevState) => ({
                      ...prevState,
                      startDate: iso,
                      workOrderStartDate: iso,
                    }));
                  }}
                  className="dobDatepicker"
                  format="MM/DD/YYYY"
                  value={
                    generalDetails.startDate
                      ? moment(generalDetails.startDate)
                      : null
                  }
                  //disabledDate={current => current && current < moment().startOf('day')}
                />
              </Form.Item>
            </Col>
            <Col span={12} className="form-row">
              <Form.Item
                label="End Date"
                tooltip={isEditMode ? "Not editable after creation — update the WO End Date below instead." : undefined}
              >
                <DatePicker
                  disabled={isEditMode}
                  onChange={(date) =>
                    handleGeneralData(date ? date.format("YYYY-MM-DD") : "", "endDate")
                  }
                  className="dobDatepicker"
                  format="MM/DD/YYYY"
                  value={
                    generalDetails.endDate
                      ? moment(generalDetails.endDate)
                      : null
                  }
                  //disabledDate={current => current && current < moment().startOf('day')}
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={30}>
            <Col span={12} className="form-row">
              <Form.Item
                label="WO Start Date"
                rules={[{ required: true }]}
                tooltip="Auto-filled from the project's Start Date — this project's first work order starts the same day. Later work orders (added from the project's Work Orders tab) each have their own dates too."
              >
                <DatePicker
                  onChange={(date) =>
                    handleGeneralData(date ? date.format("YYYY-MM-DD") : "", "workOrderStartDate")
                  }
                  className="dobDatepicker"
                  format="MM/DD/YYYY"
                  value={
                    generalDetails.workOrderStartDate
                      ? moment(generalDetails.workOrderStartDate)
                      : null
                  }
                />
              </Form.Item>
            </Col>
            <Col span={12} className="form-row">
              <Form.Item label="WO End Date">
                <DatePicker
                  onChange={(date) =>
                    handleGeneralData(date ? date.format("YYYY-MM-DD") : "", "workOrderEndDate")
                  }
                  className="dobDatepicker"
                  format="MM/DD/YYYY"
                  value={
                    generalDetails.workOrderEndDate
                      ? moment(generalDetails.workOrderEndDate)
                      : null
                  }
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={30}>
            <Col span={12} className="form-row">
              <Form.Item
                label="Bill Rate"
                name="Bill Rate"
                rules={[{ required: true }]}
              >
                <Input
                  type="number"
                  onChange={(e) =>
                    handleGeneralData(Number(e.target.value), "billRate")
                  }
                  value={generalDetails.billRate}
                />
              </Form.Item>
            </Col>
            <Col span={12} className="form-row">
              <Form.Item
                label="Status"
                name="Status"
                rules={[{ required: true }]}
              >
                <Select
                  placeholder="Select Status"
                  value={generalDetails.status || undefined}
                  onChange={(value) => handleGeneralData(value, "status")}
                >
                  {projectStatus.map((option) => (
                    <Option key={option.value} value={option.value}>
                      {option.label}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={30}>
            <Col span={12} className="form-row">
              <Form.Item label="Invoice Term" name="Invoice Term">
                <Select
                  placeholder="Select Invoice Term"
                  value={generalDetails.invoiceTerm || undefined}
                  onChange={(value) => handleGeneralData(value, "invoiceTerm")}
                >
                  {INVOICE_TERM_OPTIONS.map((option) => (
                    <Option key={option.value} value={option.value}>
                      {option.label}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12} className="form-row">
              <Form.Item label="Payment Term" name="Payment Term">
                <Select
                  placeholder="Select Payment Term"
                  value={generalDetails.paymentTerm || undefined}
                  onChange={(value) => handleGeneralData(value, "paymentTerm")}
                >
                  {paymentTermsList.map((option) => (
                    <Option key={option.value} value={option.value}>
                      {option.label}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={30}>
            <Col span={12} className="form-row">
              <Form.Item
                label="Week Start Day"
                name="Week Start Day"
                initialValue={DEFAULT_WEEK_START_DAY}
                tooltip="Only used by Weekly, Biweekly, and Once in 4 Weeks invoice terms — defaults to Monday if left unchanged."
              >
                <Select
                  value={generalDetails.weekStartDay || DEFAULT_WEEK_START_DAY}
                  onChange={(value) => handleGeneralData(value, "weekStartDay")}
                >
                  {WEEK_START_DAY_OPTIONS.map((option) => (
                    <Option key={option.value} value={option.value}>
                      {option.label}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12} className="form-row">
              <Form.Item label="Work Order">
                <Upload
                  beforeUpload={(file) => {
                    setPoFile(file);
                    return false; // hold locally — actual upload happens after the project is saved
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
          <hr />
          <section>
            <Row gutter={30}>
              <Col span={8} className="form-row">
                <Form.Item>
                  <Button type="primary" onClick={handleClear}>
                    Clear
                  </Button>
                </Form.Item>
              </Col>
              <Col span={8} className="form-row">
                <Form.Item>
                  <Button type="primary" onClick={handleCancel}>
                    Cancel
                  </Button>
                </Form.Item>
              </Col>
              <Col span={8} className="form-row">
                <Form.Item>
                  <Button
                    type="primary"
                    htmlType="submit"
                    onClick={handleSubmit}
                  >
                    {isEditMode ? "Update" : "Onboard"}
                  </Button>
                </Form.Item>
              </Col>
            </Row>
          </section>
        </Form>
      </Card>
    </div>
  );
};

export default ProjectOnBoardingForm;
