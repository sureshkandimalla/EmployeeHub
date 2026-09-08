import React, { useState, useEffect } from "react";
import API_ENDPOINTS from "../config";
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
} from "antd";
import moment from "moment";

const AdjustmentForm = ({ onClose }) => {
  const { Option } = Select;
  const [form] = Form.useForm();
  const [rowData, setRowData] = useState();
  const [selectedFromId, setSelectedFromId] = useState();
  const [selectedToId, setSelectedToId] = useState();
  const [employees, setEmployeesData] = useState();
  const [loading, setLoading] = useState(true);

    const fetchEmployeesAndCustomers = async () => {
        try {
            const [employeesData, customersData] = await Promise.all([
                fetch(API_ENDPOINTS.getEmployees).then(response => response.json()),
            ]);            
            setEmployeesData(getFlattenedData(employeesData));
        } catch (error) {
            console.error('Error fetching data:', error);
            Modal.error({
                content: 'Error fetching employees or customers. Please try again later.'
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
    const handleEmployeeChange = (value) => {
        setSelectedFromId(value);
      };
      
    const handleCustomerChange = (value) => {
        setSelectedToId(value);
      };

  //const history = useHistory();
  //const location = useLocation();
  //const { rowData } = location.state;
  const [generalDetails, setGeneralDetails] = useState({
    fromId: null,
    toId: null,
    adjustmentType: "",
    notes: "",
    adjustmentDate: "",
    amount: 0,
    lastUpdated: new Date().toISOString().split("T")[0],
  });

  const handleFormSubmit = (generalDetails) => {
    //api should be called here

        axios.post(API_ENDPOINTS.addAdjustment, generalDetails, {
            headers: {
                'Content-Type': 'application/json'
            }
        }).then(response => {
                if (response && response.status === 200) {                    
                    Modal.success({
                        content: 'Data saved successfully',
                        onOk: onClose('submit')
                      });
                } else {
                    // Handle other cases
                    console.log('Response data does not have expected value');
                }
            })
            .catch(error => {
                console.error('Error posting data:', error);
                // Display error message
                Modal.error({
                    content: 'Error posting data. Please try again later.'
                });
            });
    }

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
    setGeneralDetails({
      fromId: null,
      toId: null,
      adjustmentType: "",
      notes: "",
      adjustmentDate: "",
      amount: 0,
      lastUpdated: new Date().toISOString().split("T")[0],
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
    if (setSelectedFromId && setSelectedToId) {
      generalDetails.fromId = selectedFromId;
      generalDetails.toId = selectedToId;
    }

    generalDetails.adjustmentDate =
      generalDetails.adjustmentDate ?? new Date().toISOString().split("T")[0];
    // Validate the form data
    if (
      !generalDetails.fromId ||
      !generalDetails.toId ||
      !generalDetails.amount ||
      !generalDetails.adjustmentType
    ) {
      alert("Please fill in all mandatory fields");
      return;
    }
    handleFormSubmit(generalDetails);

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
        
            <div className='employee-onboarding-form'>
                <h3 className='header'>Add Adjustement</h3>
                <Card className='employee-onboard-card'>
                <Form form={form}>
                        <Row className='card-header-section'>
                            <Col>
                                <h4 className='header'>Project Details</h4>
                            </Col>
                            <Col>
                                <span>Mandatory Fields are marked with <span className='asterisk'>*</span></span>
                            </Col>
                        </Row>
                        <Row gutter={30}>
                            <Col span={8} className='form-row'>
                            <Form.Item label="FromName" name="fromId" rules={[{ required: true, message: 'Please select an FromName' }]}>
        <Select showSearch value={selectedFromId} onChange={handleEmployeeChange} filterOption={(input, option) =>
      option?.children?.toLowerCase().includes(input.toLowerCase())
    }>
          {employees.map((employee) => (
            <Option key={employee.employeeId} value={employee.employeeId}>
              {employee.name}
            </Option>
          ))}
        </Select>
      </Form.Item>
                            </Col>
                            <Col span={8} className='form-row'>
                            <Form.Item label="ToName" name="toId" rules={[{ required: true, message: 'Please select a ToName' }]}>
        <Select showSearch value={selectedToId} onChange={handleCustomerChange} filterOption={(input, option) =>
      option?.children?.toLowerCase().includes(input.toLowerCase())
    }>
        {employees.map((employee) => (
            <Option key={employee.employeeId} value={employee.employeeId}>
              {employee.name}
            </Option>
          ))}
        </Select>
      </Form.Item>
                            </Col>
                            <Col span={8} className='form-row'>
                                <Form.Item label="Amount" name="Amount" rules={[{ required: true , message: 'Fill Amount'}]}>
                                    <Input  type="number" onChange={(e) => handleGeneralData(Number(e.target.value), 'amount')}  value={generalDetails.billRate} />
                                </Form.Item>
                            </Col>
                        </Row>                       
                        <Row gutter={30}>
                            <Col span={8} className='form-row'>
                                <Form.Item label="Adjustment Date">
                                <DatePicker
                                    onChange={(date) => handleGeneralData(date ? date.format("YYYY-MM-DD") : "", 'adjustmentDate')}
                                    className='dobDatepicker'
                                    format="MM/DD/YYYY"
                                    value={generalDetails.adjustmentDate ? moment(generalDetails.adjustmentDate) : null}
                                />
                                </Form.Item>
                            </Col>                             
                        </Row>
                        <Row gutter={30}>
                            <Col span={10} className='form-row'>
                                <Form.Item label="Adjustment Type" name="Adjustement Type"  rules={[{ required: true }]}>
                                    <Input onChange={(e) => handleGeneralData(e.target.value, 'adjustmentType')} value={generalDetails.adjustmentType} />
                                </Form.Item>
                            </Col>
                            <Col span={10} className='form-row'>
                                <Form.Item label="Notes" name="Notes" >
                                    <Input onChange={(e) => handleGeneralData(e.target.value, 'notes')} value={generalDetails.notes} />
                                </Form.Item>
                            </Col>
                        </Row>
                        <hr />
                        <section>
                        <Row gutter={30}>
                            <Col span={8} className='form-row'>
                                <Form.Item>
                                    <Button type="primary" onClick={handleClear}>Clear</Button>
                                </Form.Item>
                            </Col>
                            <Col span={8} className='form-row'>
                                <Form.Item>
                                    <Button type="primary" onClick={handleCancel}>Cancel</Button>
                                </Form.Item>
                            </Col>
                            <Col span={8} className='form-row'>
                                <Form.Item>
                                    <Button type="primary" htmlType="submit" onClick={handleSubmit}>Submit</Button>
                                </Form.Item>
                            </Col>
                        </Row>
                        </section>
                   
                        </Form>
                </Card>
            </div>
       
    )
}

export default AdjustmentForm;
