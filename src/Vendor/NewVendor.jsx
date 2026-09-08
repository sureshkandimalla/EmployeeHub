import React, { useState, useRef } from "react";
import moment from "moment";
import {
  Tag,
  Button,
  Form,
  Input,
  Radio,
  Row,
  Col,
  DatePicker,
  Select,
  Space,
  Modal,
} from "antd";
import "./Vendor.css";
import axios from "axios";
import API_ENDPOINTS, { vendorTypeList, vendorStatusList, paymentTermsList } from "../config";
import { useNavigate } from "react-router-dom";

const onFinish = (values) => {
  console.log("Success:", values);
};
const onFinishFailed = (errorInfo) => {
  console.log("Failed:", errorInfo);
};
const usCountryTelList = [
  //TODO later get from db/api call
  {
    value: "USA",
    label: "USA",
  },
  {
    value: "IN",
    label: "IN",
  },
];
const NewVendor = () => {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const [generalDetails, setGeneralDetails] = useState({
    vendorName: "",
    vendorCompanyName: "",
    ein: "",
    phone: "",
    phoneCountry: "USA",
    emailId: "",
    webSite: "",
    startDate: moment().format("YYYY-MM-DD"),
    endDate: null,
    streetAddress: "",
    streetAddress2: "",
    city: "",
    state: "",
    zipCode: "",
    country: "USA",
    vendorType: null,
    paymentTerms: null,
    paymentPolicy: "",
    status: "Pending",
  });
  // Vendor Company Name auto-fills from Vendor Name until the user directly
  // edits Company Name themselves — then it stops following.
  const companyNameEditedRef = useRef(false);

  const handleSubmit = () => {
    console.log("generalDetails: " + generalDetails);
    // Validate the form data
    if (
      !generalDetails.vendorName ||
      !generalDetails.vendorCompanyName ||
      !generalDetails.ein ||
      !generalDetails.phone ||
      !generalDetails.emailId
    ) {
      alert("Please fill in all mandatory fields");
      return;
    }
    handleFormSubmit(generalDetails);
  };
  const handleFormSubmit = (generalDetails) => {
    axios
      .post(
        API_ENDPOINTS.saveOnBoardDetailsVendor,
        generalDetails,
      )
      .then((response) => {
        if (response && response.data) {
          // Display success message
          Modal.success({
            content: "Data saved successfully",
            onOk: () => navigate("http://localhost:4000/"),
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
      <Form
        layout="vertical"
        form={form}
        onFinish={onFinish}
        onFinishFailed={onFinishFailed}
        autoComplete="off"
        style={{
          maxWidth: 600,
        }}
        initialValues={{
          remember: true,
        }}
      >
        <Row gutter={25}>
          <Col span={12}>
            <Form.Item
              label="Vendor Name"
              name="vendorName"
              rules={[
                {
                  required: true,
                  message: "Please Enter Vendor Name",
                },
              ]}
            >
              <Input
                placeholder="Vendor Name"
                onChange={(e) => {
                  const value = e.target.value;
                  handleGeneralData(value, "vendorName");
                  // Auto-fill Company Name from Vendor Name until the user
                  // edits Company Name directly themselves.
                  if (!companyNameEditedRef.current) {
                    handleGeneralData(value, "vendorCompanyName");
                    form.setFieldsValue({ vendorCompanyName: value });
                  }
                }}
                value={generalDetails.vendorName}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="Vendor Company Name"
              name="vendorCompanyName"
              rules={[
                {
                  required: true,
                  message: "Please Enter Vendor Company Name",
                },
              ]}
            >
              <Input
                placeholder="Vendor Company Name"
                onChange={(e) => {
                  companyNameEditedRef.current = true;
                  handleGeneralData(e.target.value, "vendorCompanyName");
                }}
                value={generalDetails.vendorCompanyName}
              />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={25}>
          <Col span={12}>
            <Form.Item
              label="EIN"
              name="ein"
              rules={[
                {
                  required: true,
                  message: "Please Enter EIN",
                },
              ]}
            >
              <Input
                placeholder="EIN"
                onChange={(e) => handleGeneralData(e.target.value, "ein")}
                value={generalDetails.ein}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="WebSite"
              name="webSite"
              rules={[
                {
                  required: true,
                  message: "Please Enter webSite",
                },
              ]}
            >
              <Input
                placeholder="webSite"
                onChange={(e) => handleGeneralData(e.target.value, "webSite")}
                value={generalDetails.webSite}
              />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              label="Email"
              name="emailId"
              rules={[
                {
                  required: true,
                  message: "Please Enter Email",
                },
              ]}
            >
              <Input
                placeholder="you@company.com"
                onChange={(e) => handleGeneralData(e.target.value, "emailId")}
                value={generalDetails.emailId}
                type="email"
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="Phone Number"
              name="phone"
              rules={[
                {
                  required: true,
                  message: "Please Enter Phone number",
                },
              ]}
            >
              <Space direction="vertical" size="middle">
                <Space.Compact>
                  <Select
                    options={usCountryTelList}
                    value={generalDetails.phoneCountry}
                    onChange={(value) => handleGeneralData(value, "phoneCountry")}
                  />
                  <Input
                    placeholder="+1 (555) 000-000"
                    onChange={(e) => handleGeneralData(e.target.value, "phone")}
                    value={generalDetails.phone}
                  />
                </Space.Compact>
              </Space>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="Start Date"
              name="startDate"
              rules={[
                {
                  required: true,
                  message: "Please Enter Start Date",
                },
              ]}
            >
              <DatePicker
                value={generalDetails.startDate ? moment(generalDetails.startDate) : null}
                onChange={(date) =>
                  handleGeneralData(date ? date.format("YYYY-MM-DD") : "", "startDate")
                }
                format="MM/DD/YYYY"
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="End Date" name="endDate">
              <DatePicker
                onChange={(date) =>
                  handleGeneralData(date ? date.format("YYYY-MM-DD") : "", "endDate")
                }
                format="MM/DD/YYYY"
              />
            </Form.Item>
          </Col>
        </Row>

        <h3>Business Details</h3>
        <Row gutter={25}>
          <Col span={12}>
            <Form.Item label="Vendor Type" name="vendorType">
              <Select
                options={vendorTypeList}
                placeholder="Select vendor type"
                allowClear
                onChange={(value) => handleGeneralData(value ?? null, "vendorType")}
                value={generalDetails.vendorType}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="Status" name="status">
              <Select
                options={vendorStatusList}
                onChange={(value) => handleGeneralData(value, "status")}
                value={generalDetails.status}
              />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={25}>
          <Col span={12}>
            <Form.Item label="Payment Terms" name="paymentTerms">
              <Select
                options={paymentTermsList}
                placeholder="Select payment terms"
                allowClear
                onChange={(value) => handleGeneralData(value ?? null, "paymentTerms")}
                value={generalDetails.paymentTerms}
              />
            </Form.Item>
          </Col>
        </Row>
        <Col span={24}>
          <Form.Item label="Payment Policy" name="paymentPolicy">
            <Input.TextArea
              rows={3}
              placeholder="Payment Policy"
              onChange={(e) => handleGeneralData(e.target.value, "paymentPolicy")}
              value={generalDetails.paymentPolicy}
            />
          </Form.Item>
        </Col>

        <h3>Address</h3>
        <Col span={24}>
          <Form.Item label="Street Address" name="streetAddress">
            <Input
              placeholder="Add address"
              onChange={(e) =>
                handleGeneralData(e.target.value, "streetAddress")
              }
              value={generalDetails.streetAddress}
            />
          </Form.Item>
        </Col>
        <Col span={24}>
          <Form.Item label="Address Line 2" name="streetAddress2">
            <Input
              placeholder="Apt, suite, unit, etc. (optional)"
              onChange={(e) =>
                handleGeneralData(e.target.value, "streetAddress2")
              }
              value={generalDetails.streetAddress2}
            />
          </Form.Item>
        </Col>
        <Row gutter={25}>
          <Col span={12}>
            <Form.Item
              label="City"
              name="city"
              rules={[
                {
                  required: false,
                  message: "Please Enter city",
                },
              ]}
            >
              <Input
                placeholder="city"
                onChange={(e) => handleGeneralData(e.target.value, "city")}
                value={generalDetails.city}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="State"
              name="state"
              rules={[
                {
                  required: false,
                  message: "Please Enter state",
                },
              ]}
            >
              <Input
                placeholder="state"
                onChange={(e) => handleGeneralData(e.target.value, "state")}
                value={generalDetails.state}
              />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item label="Zip Code/Postal Code" name="zipCode">
              <Input
                placeholder="Enter Zip Code"
                onChange={(e) => handleGeneralData(e.target.value, "zipCode")}
                value={generalDetails.zipCode}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="Country"
              name="country"
              rules={[
                {
                  required: true,
                  message: "Please select an option",
                },
              ]}
            >
              <Select
                options={usCountryTelList}
                onChange={(value) => handleGeneralData(value, "country")}
                value={generalDetails.country}
              />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item>
          <Button type="primary" htmlType="submit" onClick={handleSubmit} block>
            Submit
          </Button>
        </Form.Item>
      </Form>
    </>
  );
};
export default NewVendor;
