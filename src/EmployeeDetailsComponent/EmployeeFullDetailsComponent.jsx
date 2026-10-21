import React, { useContext, useState, useEffect, useMemo, useRef } from "react";
import axios from "axios";
import API_ENDPOINTS from "../config";
import "ag-grid-enterprise";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import "./EmployeeFullDetailsComponent.css";
import ProjectGrid from "../Project/ProjectGrid";
import { useLocation } from "react-router-dom";
import EmployeePersonnelFilePage from "../EmployeeDetailsComponent/EmployeePersonnelFilePage";
import VisaProfile from "../VisaDetails/VisaProfile";
import { useChartOverview, ChartSettingsIcon } from "../Utils/ChartOverviewPanel";
import { employeeRevenueByMonth } from "../Charts/globalChartRegistry";
import InvoiceDetails from "../Invoice/InvoiceDetails";
import PayrollDetails from "../Payroll/PayrollDetails";
import AdjustementDetails from "../Adjustments/AdjustmentDetails";
import ReconciliationDetails from "../Reconciliation/ReconciliationDetails";
import FinalReportDetails from "../Reconciliation/FinalReportDetails";
import BillingDetails from "../Billings/BillingDetails";
import PassportController from "../Passport/PassportController";
import EmployeeTimesheetSummary from "../Timesheet/EmployeeTimesheetSummary";
import DocumentsPanel from "../Documents/DocumentsPanel";
import EmployeeDocumentsPanel from "../Documents/EmployeeDocumentsPanel";
import FormI9Panel from "../Documents/FormI9Panel";
import { UpOutlined, DownOutlined,CalendarOutlined, DollarOutlined,MailOutlined,PhoneOutlined, UserOutlined, FolderOutlined, PlusOutlined, IdcardOutlined } from "@ant-design/icons";
import { formatDateMDY, parseLocalDateSafe } from "../Utils/dateFormat";
import { Tabs, Card,Typography,Collapse, Row, Col, Button, Drawer, Spin, message } from "antd";
import AuthContext from "../Authentication/Context/AuthContext";
import { ROLES, canAccessEntity } from "../Utils/roleAccess";

// Which role(s) can see each tab, besides ADMIN (always full access). Tabs
// not listed here (WA, FORMS, TASKS, EVALUATION, LEAVE REPORT) have no
// content built yet, so they're left ungated.
const TAB_ROLES = {
  "PERSONNEL FILE": [ROLES.HR, ROLES.IMMIGRATION],
  "VISA PROFILE": [ROLES.HR, ROLES.IMMIGRATION],
  DOCUMENTS: [ROLES.HR, ROLES.IMMIGRATION],
  "EMPLOYEE DOCUMENTS": [ROLES.HR, ROLES.IMMIGRATION],
  // I-9 is the most sensitive document category (SSN/A-numbers, work
  // authorization) — HR + IMMIGRATION + ADMIN, same access as the other
  // Employee Documents tabs above (not HR-only, which the I-9 rules spec's
  // own guardrail literally says, but the access already granted here).
  "FORM I-9": [ROLES.HR, ROLES.IMMIGRATION],
  PROJECTS: [ROLES.HR],
  INVOICES: [ROLES.ACCOUNTING],
  PAYROLLS: [ROLES.ACCOUNTING],
  TIMESHEETS: [ROLES.ACCOUNTING, ROLES.IMMIGRATION],
  ADJUSTMENTS: [ROLES.ACCOUNTING],
  RECONCILIATION: [ROLES.ACCOUNTING],
  Bills: [ROLES.ACCOUNTING],
  "FINAL REPORT": [ROLES.ACCOUNTING],
};

const tabAllowed = (role, label) => {
  if (!role) return false;
  if (role === ROLES.ADMIN) return true;
  const allowed = TAB_ROLES[label];
  return !allowed || allowed.includes(role);
};

const { Panel } = Collapse;

const EmployeeFullDetails = () => {
  const { user } = useContext(AuthContext);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const divStyle = {
    border: "1px solid #ccc",
    padding: "20px",
    background: "#ffffff",
  };
  const handleClick = () => {
    console.log("Button clicked!");
  };
  const location = useLocation();
  const { rowData, activeTab } = location.state || {};
  console.log(location.state);
  const [responseData, setResponseData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState();
  const [passports, setPassports] = useState([]);
  const passportRef = useRef(null);

  const fetchPassports = (employeeId) => {
    if (!employeeId) return;
    axios
      .get(API_ENDPOINTS.getPassportsByEmployee(employeeId))
      .then((res) => setPassports(res.data || []))
      .catch(() => setPassports([]));
  };

  useEffect(() => {
    fetchPassports(responseData?.employeeId);
  }, [responseData?.employeeId]);

  // The most recently-expiring passport that hasn't expired yet — if the
  // employee has one on file, there's nothing to prompt for; an expired-only
  // passport still needs replacing, so that still falls through to "Add".
  const currentPassport = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const valid = passports.filter((p) => {
      const exp = parseLocalDateSafe(p.expiryDate);
      return exp && exp >= today;
    });
    if (valid.length === 0) return null;
    return valid.sort((a, b) => new Date(b.expiryDate) - new Date(a.expiryDate))[0];
  }, [passports]);

  // Just the one chart, but still wrapped in useChartOverview so it gets
  // the same resize/download controls as every other Overview panel's
  // charts.
  const employeeOverviewCharts = rowData?.employeeId ? [employeeRevenueByMonth(rowData.employeeId)] : [];
  const visibleEmployeeOverviewCharts = employeeOverviewCharts.filter(() =>
    canAccessEntity(user?.role, "invoice"),
  );
  const { settingsContent: revenueSettingsContent, contentNode: revenueContentNode } =
    useChartOverview(visibleEmployeeOverviewCharts);

  useEffect(() => {
    console.log("rowData:", rowData);
    setResponseData(rowData);
  }, [rowData]);

  const { TabPane } = Tabs;
  //const history = useHistory();
  const gridHeight = isCollapsed ? "calc(100vh - 560px)" : "calc(100vh - 320px)";
  const items = [
    {
      key: 1,
      label: "PERSONNEL FILE",
      title: "EmployeePersonnelFilePage /",
      children: (
        // .employee-List-grid's global rule is overflow:hidden (correct
        // for the AG-Grid tabs, which manage their own internal scroll) —
        // this tab is a plain stack of cards with no such grid, so it
        // needs the override other non-grid tabs already have, or its
        // content gets clipped below the fold with no way to reach it.
        <div className="employee-List-grid" style={{ height: "100%", overflow: "auto" }}>
          <EmployeePersonnelFilePage />
        </div>
      ),
    },
    {
      key: 15,
      label: "VISA PROFILE",
      children: (
        <div className="employee-List-grid" style={{ height: "100%", overflow: "auto" }}>
          <VisaProfile employeeId={rowData.employeeId} employee={rowData} />
        </div>
      ),
    },
    {
      key: 16,
      label: "DOCUMENTS",
      children: (
        <div className="employee-List-grid" style={{ height: "100%", overflow: "auto", padding: 16 }}>
          <Card
            title={
              <>
                <FolderOutlined /> Documents
              </>
            }
          >
            <DocumentsPanel entityType="Employee" entityId={rowData.employeeId} />
          </Card>
        </div>
      ),
    },
    {
      key: 17,
      label: "EMPLOYEE DOCUMENTS",
      children: (
        <div className="employee-List-grid" style={{ height: "100%", overflow: "auto", padding: 16 }}>
          <Card
            title={
              <>
                <FolderOutlined /> Employee Documents
              </>
            }
          >
            <EmployeeDocumentsPanel entityId={rowData.employeeId} visaCategory={rowData.visa} />
          </Card>
        </div>
      ),
    },
    {
      key: 18,
      label: "FORM I-9",
      children: (
        <div className="employee-List-grid" style={{ height: "100%", overflow: "auto", padding: 16 }}>
          <Card
            title={
              <>
                <FolderOutlined /> Form I-9
              </>
            }
          >
            <FormI9Panel entityId={rowData.employeeId} visaCategory={rowData.visa} />
          </Card>
        </div>
      ),
    },
    {
      key: 2,
      label: "PROJECTS",
      title: "Emplyee Projects",
      children: (
        <div className="employee-List-grid" style={{ height: "100%" }}>
          <ProjectGrid employeeId={rowData.employeeId} isCollapsed={isCollapsed} />
        </div>
      ),
    },
    {
      key: 3,
      label: "INVOICES",
      children: (
        <div className="employee-List-grid" style={{ height: "100%" }}>
          <InvoiceDetails
            employeeId={rowData.employeeId}
            isCollapsed={isCollapsed}
            gridHeight={gridHeight}
          />
        </div>
      ),
    },
    {
      key: 4,
      label: "PAYROLLS",
      children: (
        <div className="employee-List-grid" style={{ height: "100%" }}>
          <PayrollDetails
            employeeId={rowData.employeeId}
            isCollapsed={isCollapsed}
            gridHeight={gridHeight}
          />
        </div>
      ),
    },
    {
      key: 14,
      label: "TIMESHEETS",
      children: (
        <div className="employee-List-grid" style={{ height: "100%" }}>
          <EmployeeTimesheetSummary
            employeeId={rowData.employeeId}
            isCollapsed={isCollapsed}
            gridHeight={gridHeight}
          />
        </div>
      ),
    },
    {
      key: 5,
      label: "ADJUSTMENTS",
      children: (
        <div className="employee-List-grid" style={{ height: "100%" }}>
          <AdjustementDetails employeeId={rowData.employeeId} isCollapsed={isCollapsed} />
        </div>
      ),
    },
    {
      key: 6,
      label: "RECONCILIATION",
      children: (
        <div className="employee-List-grid" style={{ height: "100%" }}>
          <ReconciliationDetails employeeId={rowData.employeeId} isCollapsed={isCollapsed} />
        </div>
      ),
    },
    {
      key: 7,
      label: "Bills",
      children: (
        <div className="employee-List-grid" style={{ height: "100%" }}>
          <BillingDetails
            url={API_ENDPOINTS.getBillsForEmployee(rowData.employeeId)}
            isCollapsed={isCollapsed}
          />
        </div>
      ),
    },
    {
      key: 8,
      label: "WA",
      title: "WORK AUTHORIZATION",
    },
    {
      key: 9,
      label: "FORMS",
    },
    {
      key: 10,
      label: "TASKS",
    },
    {
      key: 11,
      label: "EVALUATION",
    },
    {
      key: 12,
      label: "LEAVE REPORT",
    },
    {
      key: 13,
      label: "FINAL REPORT",
      children: (
        <div className="employee-List-grid" style={{ height: "100%" }}>
          <FinalReportDetails employeeId={rowData.employeeId} />
        </div>
      ),
    },
  ];
  const visibleItems = items.filter((item) => tabAllowed(user?.role, item.label));

  const toggleTabs = (e) => {
    //TODO
  };

  const handleCollapseChange = () => {
    setIsCollapsed(!isCollapsed);
  };

  function toggleContent() {
    alert("toogle");
  }
  return (
    <div style={{ height: "100%", minHeight: 0, display: "flex", flexDirection: "column", overflow: "auto" }}>
      {/* Collapsible Left Section. flex-basis is a % of this column's own
          height, not of the viewport — on a short screen that % can be
          too little room for the Overview cards to render without
          clipping, so this section gets its own min-height floor and
          scrolls internally instead of being cut off silently (the
          column's overflow was "hidden" before, which suppressed any
          scrollbar entirely rather than letting the user reach the rest
          of the page). */}
      <Collapse
        activeKey={isCollapsed ? "1" : null}
        onChange={handleCollapseChange}
        style={{
          flex: isCollapsed ? "0 0 25%" : "0 0 5%", // Shrinks when collapsed
          minHeight: isCollapsed ? 220 : undefined,
          overflow: "auto",
          marginBottom: "10px",
          transition: "flex 0.3s ease-in-out",
        }}
      >
        <Panel
          header={
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: "bold" }}>Employee Overview</span>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <span onClick={(e) => e.stopPropagation()}>
                  <ChartSettingsIcon settingsContent={revenueSettingsContent} />
                </span>
                <Button
                  type="text"
                  icon={isCollapsed ? <UpOutlined /> : <DownOutlined />}
                  onClick={handleCollapseChange}
                />
              </div>
            </div>
          }
          key="1"
        >
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={8}>
              {responseData && (
                <Card className="responsive-card" style={{ width: "100%" }}>
                  <Typography.Text className="name-span" style={{ color: "blue", fontSize: "20px" }}>
                    <UserOutlined style={{ marginRight: 5, color: "#1890ff" }} />
                    {responseData.firstName} {responseData.lastName}
                  </Typography.Text>
                  <br />
                  <Typography.Text className="designation-style">
                    {responseData.designation}
                  </Typography.Text>
                  <Typography.Text
                    style={{ float: "right", color: "black", fontSize: "10px" }}
                  >
                    {responseData.employmentType}
                  </Typography.Text>
                  <div style={{ marginTop: "10px" }}>
                    <Typography.Text>
                      <MailOutlined style={{ marginRight: 5 }} />
                      {responseData.emailId}
                    </Typography.Text>
                  </div>
                  <div>
                    <Typography.Text>
                      <PhoneOutlined style={{ marginRight: 5 }} />
                      {responseData.phone}
                    </Typography.Text>
                  </div>
                  <div style={{ marginTop: "12px" }}>
                    <PassportController
                      ref={passportRef}
                      employeeData={responseData}
                      onSuccess={() => fetchPassports(responseData.employeeId)}
                    />
                    {currentPassport ? (
                      <Typography.Text
                        style={{ color: "#1677ff", cursor: "pointer" }}
                        onClick={() => passportRef.current?.openEdit(currentPassport)}
                      >
                        <IdcardOutlined style={{ marginRight: 5 }} />
                        Passport: {currentPassport.passportNumber} (exp. {formatDateMDY(currentPassport.expiryDate)})
                      </Typography.Text>
                    ) : (
                      <Button type="primary" onClick={() => passportRef.current?.open()}>
                        <PlusOutlined /> Add Passport
                      </Button>
                    )}
                  </div>
                </Card>
              )}

            {/* // <Col xs={24} sm={8}> */}
              {/* <Card> */}
                <div className="details-row">
                  <Typography.Text>
                    <DollarOutlined style={{ marginRight: 5, color: "#13c2c2" }} />
                    <b>Bill Rate:</b> {responseData?.wage}
                  </Typography.Text>
                </div>
                <div className="details-row">
                  <Typography.Text>
                    <CalendarOutlined style={{ marginRight: 5, color: "#722ed1" }} />
                    <b>Start Date:</b> {responseData?.startDate}
                  </Typography.Text>
                </div>
                <div className="details-row">
                  <Typography.Text>
                    <CalendarOutlined style={{ marginRight: 5, color: "#eb2f96" }} />
                    <b>End Date:</b> {responseData?.endDate}
                  </Typography.Text>
                </div> 
              </Col>             

            {/* Invoiced vs Paid, by month */}
            <Col xs={24} sm={16}>
              {revenueContentNode}
            </Col>
          </Row>
        </Panel>
      </Collapse>

      {/* Right Section (Tabs). overflow:auto, not hidden — AG-Grid-heavy
          tabs (Documents, Projects, ...) already manage their own bounded
          internal scroll area (e.g. height: "70vh") so this almost never
          visibly scrolls for them, but plain card-stack tabs (Personnel
          File) have no such inner scroll container of their own and were
          silently clipped below the fold with no way to reach the rest of
          the page. */}
      <div style={{ flex: "1", overflow: "auto" }}>
        <Card className="employeeTableCard" style={{ height: "100%" }}>
          <Tabs className="bean-home-tabs" defaultActiveKey={activeTab || "2"} items={visibleItems} />
        </Card>
      </div>
    </div>
  );
};

export default EmployeeFullDetails;
