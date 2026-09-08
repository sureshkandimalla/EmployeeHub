import React, { useState } from "react";
import {
  Card,
  Row,
  Col,
  Button,
  Flex,
  Menu,
  Tag,
  Form,
  Input,
  Radio,
  DatePicker,
  Select,
  Space,
} from "antd";
import {
  workAuthorizationList,
  employementTypeList,
  taxTermsList,
  departmentList,
} from "../config";

// No fixed wage-cycle list exists elsewhere in the app to stay consistent
// with (invoice terms are a separate, project-billing concept) — this is a
// standard payroll cadence set specific to this field.
const wageCycleList = [
  { value: "Weekly", label: "Weekly" },
  { value: "Biweekly", label: "Biweekly" },
  { value: "Semi-Monthly", label: "Semi-Monthly" },
  { value: "Monthly", label: "Monthly" },
];
const onBoardingTabs = [
  {
    label: "Personal Details",
    key: "Personal Details",
  },
  {
    label: "Experiance and Certifications",
    key: "Experiance and Certifications",
  },
  {
    label: "Add Project",
    key: "Add Project",
  },
  {
    label: "Time Sheet",
    key: "Time Sheet",
  },
  {
    label: "Invoices",
    key: "Invoices",
  },
];
const onFinish = (values) => {
  console.log("Success:", values);
};
const onFinishFailed = (errorInfo) => {
  console.log("Failed:", errorInfo);
};
const usCountryTelList = [
  {
    value: "US",
    label: "US",
  },
  {
    value: "CN",
    label: "CN",
  },
];
const EmployeeOnboard = () => {
  const [form] = Form.useForm();
  const [current, setCurrent] = useState("Personal Details");
  const onClick = (e) => {
    console.log("click ", e);
    setCurrent(e.key);
  };
  return (
    <>
      <Row justify={"end"}>
        <Col span={12} className="welCCol">
          <h1 className="mrgBtm10">Employee Onbaording</h1>
          <p>
            Mandatory fields are marked with <Tag color="error">*</Tag>
          </p>
        </Col>
        <Col span={12} className="buttonsBar">
          <Flex gap="small" vertical align="end">
            <Flex gap="small" wrap="wrap">
              <Button>Back to Employee Page</Button>
            </Flex>
          </Flex>
        </Col>
      </Row>
      <Card>
        <Menu
          onClick={onClick}
          selectedKeys={[current]}
          mode="horizontal"
          items={onBoardingTabs}
          className="mrgBtm15"
        />
        <>{current}</>
        <Form
          layout="vertical"
          form={form}
          onFinish={onFinish}
          onFinishFailed={onFinishFailed}
          autoComplete="off"
          style={{
            maxWidth: 900,
          }}
          initialValues={{
            remember: true,
          }}
        >
          <Card title="Personal Details" className="innerCard">
            <Row gutter={25}>
              <Col span={8}>
                <Form.Item
                  label="First Name"
                  name="firstName"
                  rules={[
                    {
                      required: true,
                      message: "Please Enter First Name",
                    },
                  ]}
                >
                  <Input placeholder="First Name" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="Middle Name" name="middleName">
                  <Input placeholder="Middle Name" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item
                  label="Last Name"
                  name="lastName"
                  rules={[
                    {
                      required: true,
                      message: "Please Enter Last Name",
                    },
                  ]}
                >
                  <Input placeholder="Last Name" />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={24}>
              <Col span={8}>
                <Form.Item
                  label="Date of Birth"
                  name="dob"
                  rules={[
                    {
                      required: true,
                      message: "Please Enter Dob",
                    },
                  ]}
                >
                  <DatePicker format="MM/DD/YYYY" />
                </Form.Item>
              </Col>
              <Col span={16}>
                <Form.Item
                  name="gender"
                  label="Gender"
                  rules={[
                    {
                      required: true,
                      message: "Please Select Gender",
                    },
                  ]}
                >
                  <Radio.Group>
                    <Radio value="m">Male</Radio>
                    <Radio value="f">Female</Radio>
                    <Radio value="nd">I Choose not to disclose </Radio>
                  </Radio.Group>
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={8}>
                <Form.Item
                  label="Email"
                  name="email"
                  rules={[
                    {
                      required: true,
                      message: "Please Enter Email",
                    },
                  ]}
                >
                  <Input placeholder="you@company.com" type="email" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item
                  label="Phone Number"
                  name="phoneNumber"
                  rules={[
                    {
                      required: true,
                      message: "Please Enter Phone number",
                    },
                  ]}
                >
                  <Space direction="vertical" size="middle">
                    <Space.Compact>
                      <Select defaultValue="us" options={usCountryTelList} />
                      <Input placeholder="+1 (555) 000-000" type="tel" />
                    </Space.Compact>
                  </Space>
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="Designation" name="designation">
                  {/* Job title is free text everywhere else in the app
                      (e.g. Newemployee.jsx) — no fixed list exists. */}
                  <Input placeholder="Designation" />
                </Form.Item>
              </Col>
            </Row>
          </Card>
          <Card title="Home Address" className="innerCard">
            <Col span={24}>
              <Form.Item label="Street Address 1" name="streetAddress1">
                <Input placeholder="Add address" />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item label="Street Address 2" name="streetAddress2">
                <Input placeholder="Add address" />
              </Form.Item>
            </Col>
            <Row gutter={16}>
              <Col span={8}>
                <Form.Item label="Country" name="country">
                  <Select defaultValue="us" options={usCountryTelList} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item
                  label="Zip Code/Postal Code"
                  name="zipcode"
                  rules={[
                    {
                      required: true,
                      message: "Please Enter Zip code",
                    },
                  ]}
                >
                  <Input placeholder="Enter Zip Code" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item
                  label="State/Provice/Country"
                  name="state"
                  rules={[
                    {
                      required: true,
                      message: "Please select an option",
                    },
                  ]}
                >
                  <Select defaultValue="us" options={usCountryTelList} />
                </Form.Item>
              </Col>
            </Row>
          </Card>
          <Card title="Employment Status" className="innerCard">
            <Row gutter={16}>
              <Col span={6}>
                <Form.Item
                  label="Employement Type"
                  name="employementType"
                  rules={[
                    {
                      required: true,
                      message: "Please select an option",
                    },
                  ]}
                >
                  <Select options={employementTypeList} />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item
                  label="Tax Terms"
                  name="taxTerms"
                  rules={[
                    {
                      required: true,
                      message: "Please select an option",
                    },
                  ]}
                >
                  <Select options={taxTermsList} />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item label="Employement Start Date" name="empStartDate">
                  <DatePicker format="MM/DD/YYYY" />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item label="Employee ID" name="empID">
                  <Input />
                </Form.Item>
              </Col>
              <Col span={14}>
                <Form.Item
                  label="Current Work Authorization Type"
                  name="workAuthorization"
                  rules={[
                    {
                      required: true,
                      message: "Please select an option",
                    },
                  ]}
                >
                  {/* Same list the Visa dropdown (WorkForceList/ImmigrationIntake)
                      uses, so a value picked here always matches what those
                      show/filter on. */}
                  <Select options={workAuthorizationList} />
                </Form.Item>
              </Col>
              <Col span={10}>
                <Form.Item name="BILINGsTATUS" label="Billing Status">
                  <Radio.Group>
                    <Radio value="billing">Billing</Radio>
                    <Radio value="nonbilling">Non Billing</Radio>
                  </Radio.Group>
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={6}>
                <Form.Item label="Wage Rate(Offered salary)" name="wageRate">
                  <Input />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item label="Wage Cycle" name="wageCycle">
                  <Select options={wageCycleList} />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item label="Department" name="department">
                  <Select options={departmentList} />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item label="Department" name="depaetmwnt1">
                  <Select options={departmentList} />
                </Form.Item>
              </Col>
            </Row>
          </Card>

          <Form.Item>
            <Row align={"space-between"}>
              <Col>
                <Button>Cancel</Button>
              </Col>
              <Col>
                <Flex gap="small" vertical align="end">
                  <Flex gap="small" wrap="wrap">
                    <Button htmlType="submit">Save Changes</Button>

                    <Button type="primary" htmlType="submit">
                      Next
                    </Button>
                  </Flex>
                </Flex>
              </Col>
            </Row>
          </Form.Item>
        </Form>
      </Card>
    </>
  );
};
export default EmployeeOnboard;
