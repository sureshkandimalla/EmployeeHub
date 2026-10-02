import React, { useContext, useState, useEffect } from "react";
import "ag-grid-enterprise";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import "./ProjectFullDetails.css";
import { useLocation } from "react-router-dom";
import RevenueCharts from "../RevenueCharts/RevenueCharts";
import ProjectPersonalFile from "./ProjectPersonalFile";
import AssignmentDetails from "./AssignmentDetails";
import WorkOrderDetails from "./WorkOrderDetails";
import InvoiceDetails from "../Invoice/InvoiceDetails";
import BillingDetails from "../Billings/BillingDetails";
import DocumentsPanel from "../Documents/DocumentsPanel";
import { UpOutlined, DownOutlined,CalendarOutlined, DollarOutlined, ProjectOutlined, BankOutlined, UserOutlined } from "@ant-design/icons";
import { Tabs, Card,Typography,Collapse, Row, Col, Button, Drawer, Spin, message } from "antd";
import axios from "axios";
import API_ENDPOINTS from "../config";
import { formatCurrency } from "../Utils/CurrencyFormatter";
import { formatMonthYear } from "../Utils/dateFormat";
import AuthContext from "../Authentication/Context/AuthContext";
import { ROLES } from "../Utils/roleAccess";

// All 5 tabs are Accounting-owned today — this page itself is already
// Accounting-only at the route level (see roleAccess.js ROUTE_ROLES), so
// this is mostly a no-op in practice, but keeps tab-gating consistent with
// Employee Full Details in case that page-level scoping ever loosens.
const TAB_ROLES = {
  "PROJECT SUMMARY": [ROLES.ACCOUNTING],
  Assignments: [ROLES.ACCOUNTING],
  WorkOrders: [ROLES.ACCOUNTING],
  Invoices: [ROLES.ACCOUNTING],
  Bills: [ROLES.ACCOUNTING],
  Documents: [ROLES.ACCOUNTING],
};

const tabAllowed = (role, label) => {
  if (!role) return false;
  if (role === ROLES.ADMIN) return true;
  const allowed = TAB_ROLES[label];
  return !allowed || allowed.includes(role);
};
//const style: React.CSSProperties = { background: '#A9A9A9', padding: '8px 0' ,paddingLeft: '8px 0'};

const { Panel } = Collapse;


const ProjectFullDetails = () => {
  const { user } = useContext(AuthContext);
  const [isCollapsed, setIsCollapsed] = useState(false);


  const divStyle = {
    //     height: '95%', // Set the desired height in pixels or any other valid CSS unit
    border: "1px solid #ccc",
    padding: "20px",
    background: "#ffffff",
    //border: '0px solid #ccc',
  };
  const handleClick = () => {
    // Your logic or actions when the button is clicked
    console.log("Button clicked!");
  };
  const location = useLocation();
  const { rowData } = location.state;
  console.log(rowData);
  console.log(rowData.projectId);
  localStorage.setItem("projectName", rowData.projectName);
  localStorage.setItem("projectId", rowData.projectId);
  const [responseData, setResponseData] = useState(null);
  const [workOrders, setWorkOrders] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [invoiceTotals, setInvoiceTotals] = useState({ amount: 0, paid: 0, balance: 0 });
  const [billTotals, setBillTotals] = useState({ amount: 0, paid: 0, balance: 0 });
  const [monthlyChart, setMonthlyChart] = useState({ categories: [], invoiceSeries: [], billSeries: [] });

  const getFlattenedData = (data) => {
    setAssignments(data.assignments);
    setWorkOrders(data.billRates);
    return {
      ...data,
      ...(data.assignments ? data.assignments : {}),
      ...(data.employee ? { firstName: data.employee.firstName.value } : {}),
      ...(data.employee ? data.employee : {}),
      ...(data.customer ? { customer: data.customer } : {}),
      ...(data.billRates ? data.billRates[0] : {}),
    };
  };

  const fetchData = async () => {
    try {
      const response = await fetch(API_ENDPOINTS.projectsById(rowData.projectId));
      const data = await response.json();
      const flattendData = getFlattenedData(data);
      console.log(flattendData)
      setResponseData(flattendData);
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };

  const fetchTotals = async () => {
    try {
      const [{ data: invoices }, { data: bills }] = await Promise.all([
        axios.get(API_ENDPOINTS.getInvoicesForProject(rowData.projectId)),
        axios.get(API_ENDPOINTS.getBillsForProject(rowData.projectId)),
      ]);

      const invoiceAmount = (invoices || []).reduce((sum, inv) => sum + (inv.total || 0), 0);
      const invoicePaid = (invoices || []).reduce((sum, inv) => sum + (inv.invoicePaidAmount || 0), 0);
      setInvoiceTotals({ amount: invoiceAmount, paid: invoicePaid, balance: invoiceAmount - invoicePaid });

      const billAmount = (bills || []).reduce((sum, bill) => sum + (bill.total || 0), 0);
      const billPaid = (bills || []).reduce((sum, bill) => sum + (bill.billPaidAmount || 0), 0);
      setBillTotals({ amount: billAmount, paid: billPaid, balance: billAmount - billPaid });

      // Month-wise totals for the Total Revenue chart, keyed by "yyyy-MM"
      // (invoiceMonth is a full date, e.g. "2025-09-01").
      const sumByMonth = (records) => {
        const map = {};
        (records || []).forEach((record) => {
          if (!record.invoiceMonth) return;
          const monthKey = record.invoiceMonth.substring(0, 7);
          map[monthKey] = (map[monthKey] || 0) + (record.total || 0);
        });
        return map;
      };

      const invoiceByMonth = sumByMonth(invoices);
      const billByMonth = sumByMonth(bills);
      const months = Array.from(new Set([...Object.keys(invoiceByMonth), ...Object.keys(billByMonth)])).sort();

      setMonthlyChart({
        categories: months.map((m) => formatMonthYear(m)),
        invoiceSeries: months.map((m) => invoiceByMonth[m] || 0),
        billSeries: months.map((m) => billByMonth[m] || 0),
      });
    } catch (error) {
      console.error("Error fetching invoice/bill totals:", error);
    }
  };

  useEffect(() => {
    fetchData();
    fetchTotals();
  }, []);

  // Passed down to each tab's own Refresh (and any bulk-save action) so
  // that refreshing WorkOrders/Invoices/Bills also refreshes the Project
  // Overview panel above (totals table + revenue chart) — those numbers
  // are derived from the same invoice/bill data those tabs edit.
  const refreshOverview = () => {
    fetchData();
    fetchTotals();
  };

  const { TabPane } = Tabs;
  //const history = useHistory();
  const items = [
    {
      key: 1,
      label: "PROJECT SUMMARY",
      title: "Project Summary Page /",
      children: <ProjectPersonalFile rowData={rowData} />,
    },
    {
      key: 2,
      label: "Assignments",
      title: "Assignments",
      children: <AssignmentDetails projectId={rowData.projectId} isCollapsed={isCollapsed} />,
    },
    {
      key: 3,
      label: "WorkOrders",
      children: <WorkOrderDetails rowData={workOrders} isCollapsed={isCollapsed} onRefresh={refreshOverview} />,
    },
    {
      key: 4,
      label: "Invoices",
      children: (
        <InvoiceDetails
          projectId={rowData.projectId}
          employeeId={rowData.employeeId}
          isCollapsed={isCollapsed}
          onRefresh={refreshOverview}
        />
      ),
    },
    {
      key: 5,
      label: "Bills",
      children: (
        <BillingDetails
          url={API_ENDPOINTS.getBillsForProject(rowData.projectId)}
          isCollapsed={isCollapsed}
          onRefresh={refreshOverview}
        />
      ),
    },
    {
      key: 6,
      label: "Documents",
      children: <DocumentsPanel entityType="Project" entityId={rowData.projectId} />,
    },
  ];
  const visibleItems = items.filter((item) => tabAllowed(user?.role, item.label));

  const handleCollapseChange = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (  
      <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Collapsible Left Section */}
        <Collapse
          activeKey={isCollapsed ? "1" : null}
          onChange={handleCollapseChange}
          style={{
            flex: isCollapsed ? "0 0 25%" : "0 0 5%", // Shrinks when collapsed
            marginBottom: "10px",
            transition: "flex 0.3s ease-in-out",
          }}
        >
          <Panel
            header={
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: "bold" }}>Project Overview</span>
                <Button
                  type="text"
                  icon={isCollapsed ? <UpOutlined /> : <DownOutlined />}
                  onClick={handleCollapseChange}
                />
              </div>
            }
            key="1"
          >
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={8}>
              {responseData && (
                <Card className="responsive-card" style={{ width: "100%" }}>
                  <Typography.Text className="name-span" style={{ color: "blue", fontSize: "20px" }}>
                  <ProjectOutlined style={{ marginRight: 5, color: "#1890ff" }} />
                  Project: {responseData.projectName}
                </Typography.Text>
                <br />
                <Typography.Text className="designation-style">
                  <BankOutlined style={{ marginRight: 5, color: "#52c41a" }} />
                  {responseData.customer?.customerName}
                </Typography.Text>
                <Typography.Text
                  style={{ float: "right", color: "black", fontSize: "10px" }}
                >
                  <UserOutlined style={{ marginRight: 5, color: "#faad14" }} />
                  {responseData.employeeName}
                </Typography.Text>
                </Card>
              )}
              {/* </Col> */}
  
              {/* Bill Rate & Dates
              <Col xs={24} sm={8}>
                <Card> */}
                  <div className="details-row">
                    <div className="field">
                    <Typography.Text>
                      <DollarOutlined style={{ marginRight: 5, color: "#13c2c2" }} />
                      <b>Bill Rate:</b> {responseData?.wage}
                    </Typography.Text>
                  </div>
                  <div className="field">
                    <Typography.Text>
                      <CalendarOutlined style={{ marginRight: 5, color: "#722ed1" }} />
                      <b>Start Date:</b> {responseData?.startDate}
                    </Typography.Text>
                  </div>
                  <div className="field">
                    <Typography.Text>
                      <CalendarOutlined style={{ marginRight: 5, color: "#eb2f96" }} />
                      <b>End Date:</b> {responseData?.endDate}
                    </Typography.Text>
                    </div>
                  </div>
                  <table className="project-totals-table">
                    <thead>
                      <tr>
                        <th></th>
                        <th>Total</th>
                        <th>Paid</th>
                        <th>Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>Invoice</td>
                        <td>{formatCurrency(invoiceTotals.amount)}</td>
                        <td>{formatCurrency(invoiceTotals.paid)}</td>
                        <td>{formatCurrency(invoiceTotals.balance)}</td>
                      </tr>
                      <tr>
                        <td>Bill</td>
                        <td>{formatCurrency(billTotals.amount)}</td>
                        <td>{formatCurrency(billTotals.paid)}</td>
                        <td>{formatCurrency(billTotals.balance)}</td>
                      </tr>
                    </tbody>
                  </table>
              </Col>
  
              {/* Total Revenue & Chart */}
              <Col xs={24} sm={16}>
                <Card className="totalRevenceCard">
                  <div style={{ display: "flex", gap: 60 }}>
                    <div>
                      <span className="totalRevenueLabel">Total Revenue</span>
                      <span className="totalRevenueCount">{formatCurrency(invoiceTotals.amount)}</span>
                    </div>
                    <div>
                      <span className="totalRevenueLabel">Total Expense</span>
                      <span className="totalRevenueCount">{formatCurrency(billTotals.amount)}</span>
                    </div>
                  </div>
                  <RevenueCharts
                    thisMonthData={monthlyChart.invoiceSeries}
                    lastMonthData={monthlyChart.billSeries}
                    categories={monthlyChart.categories}
                    series1Name="Invoice"
                    series2Name="Bill"
                  />
                </Card>
              </Col>
            </Row>
          </Panel>
        </Collapse>
  
        {/* Right Section (Tabs) */}
        <div style={{ flex: "1", overflow: "hidden" }}>
          <Card className="employeeTableCard" style={{ height: "100%" }}>
            <Tabs className="bean-home-tabs" defaultActiveKey="2" items={visibleItems} />
          </Card>
        </div>
      </div>
    );
};

export default ProjectFullDetails;
