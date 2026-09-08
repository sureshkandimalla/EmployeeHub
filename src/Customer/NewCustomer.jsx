import React, { useState, useRef } from "react";
import moment from "moment";
import {
  Button,
  Form,
  Input,
  InputNumber,
  Radio,
  Row,
  Col,
  DatePicker,
  Select,
  Space,
  Modal,
} from "antd";
import "./Customer.css";
import axios from "axios";
import API_ENDPOINTS, {
  currencyList,
  msaStatusList,
  billingMethodList,
  paymentTermsList,
} from "../config";
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
const NewCustomer = () => {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const [generalDetails, setGeneralDetails] = useState({
    customerName: "",
    customerCompanyName: "",
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
    creditLimit: null,
    parentCompany: "",
    billingContact: "",
    apContact: "",
    standardCurrency: "USD",
    msaStatus: null,
    defaultBillingMethod: null,
    paymentTerms: null,
    notes: "",
  });
  // Customer Company Name auto-fills from Customer Name until the user directly
  // edits Company Name themselves — then it stops following.
  const companyNameEditedRef = useRef(false);

  const handleSubmit = () => {
    console.log("generalDetails: " + generalDetails);
    // Validate the form data
    if (
      !generalDetails.customerName ||
      !generalDetails.customerCompanyName ||
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
        API_ENDPOINTS.saveOnBoardDetailsCustomer,
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
      <h3>Business Details</h3>
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
              label="Customer Name"
              name="customerName"
              rules={[
                {
                  required: true,
                  message: "Please Enter Customer Name",
                },
              ]}
            >
              <Input
                placeholder="Customer Name"
                onChange={(e) => {
                  const value = e.target.value;
                  handleGeneralData(value, "customerName");
                  // Auto-fill Company Name from Customer Name until the user
                  // edits Company Name directly themselves.
                  if (!companyNameEditedRef.current) {
                    handleGeneralData(value, "customerCompanyName");
                    form.setFieldsValue({ customerCompanyName: value });
                  }
                }}
                value={generalDetails.customerName}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="Customer Company Name"
              name="customerCompanyName"
              rules={[
                {
                  required: true,
                  message: "Please Enter Customer Company Name",
                },
              ]}
            >
              <Input
                placeholder="Customer Company Name"
                onChange={(e) => {
                  companyNameEditedRef.current = true;
                  handleGeneralData(e.target.value, "customerCompanyName");
                }}
                value={generalDetails.customerCompanyName}
              />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={25}>
          <Col span={12}>
            <Form.Item label="Parent Company" name="parentCompany">
              <Input
                placeholder="Parent Company"
                onChange={(e) => handleGeneralData(e.target.value, "parentCompany")}
                value={generalDetails.parentCompany}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="Credit Limit" name="creditLimit">
              <InputNumber
                style={{ width: "100%" }}
                min={0}
                placeholder="Credit Limit"
                onChange={(value) => handleGeneralData(value, "creditLimit")}
                value={generalDetails.creditLimit}
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
        </Row>
        <Row gutter={25}>
          <Col span={12}>
            <Form.Item
              label="Billing Contact"
              name="billingContact"
              rules={[{ type: "email", message: "Please enter a valid email" }]}
            >
              <Input
                placeholder="billing@company.com"
                type="email"
                onChange={(e) => handleGeneralData(e.target.value, "billingContact")}
                value={generalDetails.billingContact}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="Accounts Payable Contact"
              name="apContact"
              rules={[{ type: "email", message: "Please enter a valid email" }]}
            >
              <Input
                placeholder="ap@company.com"
                type="email"
                onChange={(e) => handleGeneralData(e.target.value, "apContact")}
                value={generalDetails.apContact}
              />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={8}>
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
          <Col span={8}>
            <Form.Item label="End Date" name="endDate">
              <DatePicker
                onChange={(date) =>
                  handleGeneralData(date ? date.format("YYYY-MM-DD") : "", "endDate")
                }
                format="MM/DD/YYYY"
              />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item label="MSA Status" name="msaStatus">
              <Select
                options={msaStatusList}
                placeholder="Select MSA status"
                allowClear
                onChange={(value) => handleGeneralData(value ?? null, "msaStatus")}
                value={generalDetails.msaStatus}
              />
            </Form.Item>
          </Col>
        </Row>
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
        <Row gutter={16}>
          <Col span={6}>
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
          <Col span={6}>
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
          <Col span={6}>
            <Form.Item label="Zip Code" name="zipCode">
              <Input
                placeholder="Enter Zip Code"
                onChange={(e) => handleGeneralData(e.target.value, "zipCode")}
                value={generalDetails.zipCode}
              />
            </Form.Item>
          </Col>
          <Col span={6}>
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

        <Row gutter={16}>
          <Col span={8}>
            <Form.Item label="Standard Currency" name="standardCurrency">
              <Select
                options={currencyList}
                placeholder="Select currency"
                onChange={(value) => handleGeneralData(value, "standardCurrency")}
                value={generalDetails.standardCurrency}
              />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item label="Default Billing Method" name="defaultBillingMethod">
              <Select
                options={billingMethodList}
                placeholder="Select billing method"
                allowClear
                onChange={(value) => handleGeneralData(value ?? null, "defaultBillingMethod")}
                value={generalDetails.defaultBillingMethod}
              />
            </Form.Item>
          </Col>
          <Col span={8}>
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
          <Form.Item label="Notes" name="notes">
            <Input.TextArea
              rows={3}
              placeholder="Notes"
              onChange={(e) => handleGeneralData(e.target.value, "notes")}
              value={generalDetails.notes}
            />
          </Form.Item>
        </Col>

        <Form.Item>
          <Button type="primary" htmlType="submit" onClick={handleSubmit} block>
            Submit
          </Button>
        </Form.Item>
      </Form>
    </>
  );
};
export default NewCustomer;
