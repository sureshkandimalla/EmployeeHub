import React, { useState } from "react";
import {
  Tag,
  Button,
  Form,
  Input,
  Row,
  Col,
  DatePicker,
  Select,
  Space,
  Modal,
} from "antd";
import axios from "axios";
import API_ENDPOINTS from "../config";

const usCountryTelList = [
  { value: "US", label: "US" },
  { value: "IN", label: "IN" },
];

const genderOptions = [
  { value: "Male", label: "Male" },
  { value: "Female", label: "Female" },
  { value: "Other", label: "Other" },
];

const statusOptions = [
  { value: "Active", label: "Active" },
  { value: "Inactive", label: "Inactive" },
];

const NewPotentialEmployee = ({ onClose}) => {
  const [form] = Form.useForm();  
  const [generalDetails, setGeneralDetails] = useState({
    firstName: "",
    lastName: "",    
    phone: "",
    emailId: "",
    dob: null,  
    company:"",
    gender: "",
    visaType: "",
    referredBy: "",
    endDate: null,
    startDate: null,
    year: "",
    status: "",
    primarySkills: "",
    secondarySkills: "",
    currentLocation: "",
    workCountry: "",
  });

  const handleSubmit = () => {
    console.log("Form Data: ", generalDetails);
    if (
      !generalDetails.firstName ||
      !generalDetails.lastName ||      
      !generalDetails.phone ||
      !generalDetails.emailId
    ) {
      alert("Please fill in all mandatory fields.");
      return;
    }
    handleFormSubmit(generalDetails);
  };

  const handleFormSubmit = (generalDetails) => {
    axios
      .post(
        API_ENDPOINTS.createPotentialEmployee,
        generalDetails
      )
      .then((response) => {
        if (response && response.data) {
          Modal.success({
            content: "Data saved successfully",
            onOk: onClose('submit')
          });
        } else {
          console.log("Response data does not have expected value");
        }
      })
      .catch((error) => {
        console.error("Error posting data:", error);
        Modal.error({ content: "Error posting data. Please try again later." });
      });
  };

  const handleGeneralData = (value, field) => {
    setGeneralDetails((prevState) => ({
      ...prevState,
      [field]: value,
    }));
  };

  return (
    <>
      <p>
        Mandatory fields are marked with <Tag color="error">*</Tag>
      </p>
      <h3>Personal Details </h3>
      <Form layout="vertical" form={form} autoComplete="off" style={{ maxWidth: 800 }}>
  <Row gutter={25}>
    <Col span={12}>
      <Form.Item label="First Name" required>
        <Input
          placeholder="First Name"
          onChange={(e) => handleGeneralData(e.target.value, "firstName")}
        />
      </Form.Item>
    </Col>
    <Col span={12}>
      <Form.Item label="Last Name" required>
        <Input
          placeholder="Last Name"
          onChange={(e) => handleGeneralData(e.target.value, "lastName")}
        />
      </Form.Item>
    </Col>
  </Row>

  <Row gutter={25}>
    <Col span={12}>
      <Form.Item label="Email ID" name="emailId" rules={[
        { required: true, message: "Please enter your Email ID" },
        { type: "email", message: "Please enter a valid Email ID" },
      ]}>
        <Input
          placeholder="you@company.com"
          onChange={(e) => handleGeneralData(e.target.value, "emailId")}
        />
      </Form.Item>
    </Col>
    <Col span={12}>
      <Form.Item label="Phone Number" required>
        <Space.Compact>
          <Select
            defaultValue="US"
            options={usCountryTelList}
            onChange={(value) => handleGeneralData(value, "phoneCountryCode")}
          />
          <Input
            placeholder="+1 (555) 000-000"
            onChange={(e) => handleGeneralData(e.target.value, "phone")}
          />
        </Space.Compact>
      </Form.Item>
    </Col>
  </Row>

  <Row gutter={25}>
    <Col span={12}>
      <Form.Item label="Date of Birth" required>
        <DatePicker
          onChange={(date) => handleGeneralData(date ? date.format("YYYY-MM-DD") : "", "dob")}
          format="MM/DD/YYYY"
        />
      </Form.Item>
    </Col>
    <Col span={12}>
      <Form.Item label="Referred By">
        <Input
          placeholder="Referred By"
          onChange={(e) => handleGeneralData(e.target.value, "referredBy")}
        />
      </Form.Item>
    </Col>
  </Row>

  <Row gutter={25}>
    <Col span={12}>
      <Form.Item label="Gender" required>
        <Select
          options={genderOptions}
          onChange={(value) => handleGeneralData(value, "gender")}
        />
      </Form.Item>
    </Col>
    <Col span={12}>
      <Form.Item label="Year">
        <Input
          placeholder="Year"
          onChange={(e) => handleGeneralData(e.target.value, "year")}
        />
      </Form.Item>
    </Col>
  </Row>

  <Row gutter={25}>
    <Col span={12}>
      <Form.Item label="Status" required>
        <Select
          options={statusOptions}
          onChange={(value) => handleGeneralData(value, "status")}
        />
      </Form.Item>
    </Col>
    <Col span={12}>
      <Form.Item label="Primary Skills">
        <Input
          placeholder="Primary Skills"
          onChange={(e) => handleGeneralData(e.target.value, "primarySkills")}
        />
      </Form.Item>
    </Col>
  </Row>

  <Row gutter={25}>
    <Col span={12}>
      <Form.Item label="Secondary Skills">
        <Input
          placeholder="Secondary Skills"
          onChange={(e) => handleGeneralData(e.target.value, "secondarySkills")}
        />
      </Form.Item>
    </Col>
    <Col span={12}>
      <Form.Item label="Current Location">
        <Input
          placeholder="Current Location"
          onChange={(e) => handleGeneralData(e.target.value, "currentLocation")}
        />
      </Form.Item>
    </Col>
  </Row>

  <Row gutter={25}>
    <Col span={12}>
      <Form.Item label="Work Country">
        <Select
          options={usCountryTelList}
          onChange={(value) => handleGeneralData(value, "workCountry")}
        />
      </Form.Item>
    </Col>
    <Col span={12}>
      <Form.Item label="Company">
        <Input
          placeholder="Company"
          onChange={(e) => handleGeneralData(e.target.value, "company")}
        />
      </Form.Item>
    </Col>
  </Row>

  <Row gutter={25}>
    <Col span={12}>
      <Form.Item label="Start Date" required>
        <DatePicker
          onChange={(date) => handleGeneralData(date ? date.format("YYYY-MM-DD") : "", "startDate")}
          format="MM/DD/YYYY"
        />
      </Form.Item>
    </Col>
    <Col span={12}>
      <Form.Item label="End Date">
        <DatePicker
          onChange={(date) => handleGeneralData(date ? date.format("YYYY-MM-DD") : "", "endDate")}
          format="MM/DD/YYYY"
        />
      </Form.Item>
    </Col>
  </Row>

  <Form.Item>
    <Button type="primary" onClick={handleSubmit} block>
      Submit
    </Button>
  </Form.Item>
</Form>


    </>
  );
};

export default NewPotentialEmployee;
