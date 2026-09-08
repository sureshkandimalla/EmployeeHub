import React, { useEffect, useMemo, useState } from "react";
import { useLocation, Link } from "react-router-dom";
import axios from "axios";
import { AgGridReact } from "@ag-grid-community/react";
import "ag-grid-enterprise";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import { Card, Tabs, Typography, Row, Col } from "antd";
import { ShopOutlined, MailOutlined, PhoneOutlined, GlobalOutlined, CalendarOutlined } from "@ant-design/icons";
import API_ENDPOINTS from "../config";
import { sizeColumnsForHeader } from "../Utils/agGridColumnSizing";
import { formatDateMDY } from "../Utils/dateFormat";
import CoiGrid from "../Coi/CoiGrid";

const cellClassRules = {
  darkGreyBackground: (params) => params.node?.rowIndex !== undefined && params.node.rowIndex % 2 === 1,
};

// A labeled field in the Overview tab — blank values are simply skipped
// rather than shown as "undefined"/empty, since not every vendor has every
// optional field filled in.
const DetailRow = ({ label, value }) => {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div style={{ marginBottom: 10 }}>
      <Typography.Text type="secondary" style={{ display: "block", fontSize: 12 }}>
        {label}
      </Typography.Text>
      <Typography.Text>{value}</Typography.Text>
    </div>
  );
};

// The only link from Employee back to Vendor is employee.vendorId (set on
// the C2C employee, added alongside the vendor picker in the onboarding
// form) — matched here by id, the one real FK the two sides share.
const EmployeesTab = ({ vendorId }) => {
  const [rowData, setRowData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios
      .get(API_ENDPOINTS.getAllEmployees)
      .then((res) => {
        const all = res.data || [];
        setRowData(vendorId ? all.filter((e) => Number(e.vendorId) === Number(vendorId)) : []);
      })
      .finally(() => setLoading(false));
  }, [vendorId]);

  const columnDefs = useMemo(
    () => [
      {
        headerName: "Employee Name",
        field: "firstName",
        filter: "agSetColumnFilter",
        cellClassRules,
        cellRenderer: (params) => (
          <Link to="/employeeFullDetails" state={{ rowData: params.data }}>
            {`${params.data.firstName || ""} ${params.data.lastName || ""}`.trim()}
          </Link>
        ),
      },
      { headerName: "Designation", field: "designation", filter: "agSetColumnFilter", cellClassRules },
      { headerName: "Status", field: "status", filter: "agSetColumnFilter", cellClassRules },
      { headerName: "Employee Type", field: "employeeType", filter: "agSetColumnFilter", cellClassRules },
      { headerName: "Email", field: "emailId", filter: "agSetColumnFilter", cellClassRules },
      { headerName: "Start Date", field: "startDate", filter: "agSetColumnFilter", cellClassRules, valueFormatter: (params) => formatDateMDY(params.value) },
    ],
    [],
  );

  return (
    <div className="ag-theme-alpine" style={{ height: 420 }}>
      <AgGridReact
        rowData={rowData}
        columnDefs={sizeColumnsForHeader(columnDefs)}
        loading={loading}
        defaultColDef={{ resizable: true, filter: "agSetColumnFilter", minWidth: 100 }}
        pagination={true}
        paginationPageSize={20}
        domLayout="normal"
      />
    </div>
  );
};

const VendorFullDetailsComponent = () => {
  const location = useLocation();
  const { rowData } = location.state || {};

  if (!rowData) {
    return <Typography.Text type="danger">No vendor selected.</Typography.Text>;
  }

  const items = [
    {
      key: "overview",
      label: "OVERVIEW",
      children: (
        <Row gutter={[32, 16]} style={{ padding: "8px 4px" }}>
          <Col xs={24} md={8}>
            <DetailRow label="Vendor Name" value={rowData.vendorName} />
            <DetailRow label="EIN" value={rowData.ein} />
            <DetailRow label="Status" value={rowData.vendorStatus} />
            <DetailRow label="Vendor Type" value={rowData.vendorType} />
          </Col>
          <Col xs={24} md={8}>
            <DetailRow label="Contact Email" value={rowData.vendorContactEmail} />
            <DetailRow label="Payment Terms" value={rowData.paymentTerms} />
            <DetailRow label="Payment Policy" value={rowData.paymentPolicy} />
          </Col>
          <Col xs={24} md={8}>
            <DetailRow label="Start Date" value={rowData.vendorStartDate} />
            <DetailRow label="End Date" value={rowData.vendorEndDate} />
            <DetailRow label="Address" value={rowData.vendorAddress} />
          </Col>
        </Row>
      ),
    },
    {
      key: "employees",
      label: "EMPLOYEES",
      children: <EmployeesTab vendorId={rowData.vendorId} />,
    },
    {
      key: "coi",
      label: "COI",
      children: (
        <div style={{ height: 420 }}>
          <CoiGrid vendorId={rowData.vendorId} isCollapsed={true} />
        </div>
      ),
    },
  ];

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <Card style={{ marginBottom: 10 }}>
        <Typography.Text style={{ color: "#1677ff", fontSize: 20 }}>
          <ShopOutlined style={{ marginRight: 8 }} />
          {rowData.vendorCompanyName}
        </Typography.Text>
        <div style={{ marginTop: 10, display: "flex", gap: 24, flexWrap: "wrap" }}>
          {rowData.vendorEmail && (
            <Typography.Text>
              <MailOutlined style={{ marginRight: 5 }} />
              {rowData.vendorEmail}
            </Typography.Text>
          )}
          {rowData.vendorPhone && (
            <Typography.Text>
              <PhoneOutlined style={{ marginRight: 5 }} />
              {rowData.vendorPhone}
            </Typography.Text>
          )}
          {rowData.website && (
            <Typography.Text>
              <GlobalOutlined style={{ marginRight: 5 }} />
              {rowData.website}
            </Typography.Text>
          )}
          {rowData.vendorStartDate && (
            <Typography.Text>
              <CalendarOutlined style={{ marginRight: 5 }} />
              {rowData.vendorStartDate}
            </Typography.Text>
          )}
        </div>
      </Card>
      <div style={{ flex: 1, overflow: "hidden" }}>
        <Card style={{ height: "100%" }}>
          <Tabs items={items} />
        </Card>
      </div>
    </div>
  );
};

export default VendorFullDetailsComponent;
