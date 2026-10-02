import React, { useContext, useMemo, useState, useEffect } from "react";
import "@ag-grid-community/styles/ag-grid.css";
import { PlusOutlined, BellOutlined } from "@ant-design/icons";
import { useChartOverview, ChartSettingsIcon } from "../Utils/ChartOverviewPanel";
import { GLOBAL_CHARTS } from "../Charts/globalChartRegistry";
import { Col, Row, Card, Button, Tabs, Collapse, Drawer, Spin, Popover, Badge, List, Empty } from "antd";
import ProjectOnBoardingForm from "../OnBoardingComponent/ProjectOnBoarding";
import "./ProjectDashboard.css";
import "@ag-grid-community/styles/ag-theme-alpine.css";
import ProjectList from "./ProjectsList";
import API_ENDPOINTS from "../config";
import AuthContext from "../Authentication/Context/AuthContext";
import { canAccessEntity } from "../Utils/roleAccess";
import { useNudgeResize } from "../Utils/useNudgeResize";

const { Panel } = Collapse;

const ProjectDashboard = () => {
  const { user } = useContext(AuthContext);
  const [rowData, setRowData] = useState();
  const [activeKey, setActiveKey] = useState("0"); // State for active tab
  const [isEmployeesLoading, setEmployeeLoading] = useState(true);
  const [isCollapsed, setIsCollapsed] = useState(false);
  useNudgeResize();

  const [open, setOpen] = useState(false);
  // Set when a row's Project Id is clicked (full nested Project entity,
  // fetched by ProjectsList) — passed to ProjectOnBoardingForm so it opens
  // pre-filled in edit mode instead of a blank "create" form.
  const [editingProject, setEditingProject] = useState(null);

  const addNewProject = () => {
    setEditingProject(null);
    setOpen(true);
  };

  const openEditProject = (project) => {
    setEditingProject(project);
    setOpen(true);
  };

  const onClose = () => {
    setOpen(false);
    setEditingProject(null);
    fetchData();
  };

  const handleCollapseChange = () => {
    setIsCollapsed((prev) => !prev);
  };

  // Left-nav "Create > Customers > Project" links here with ?new=1 to land
  // straight on the add-project drawer instead of just the grid.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("new") === "1") {
      setOpen(true);
    }
  }, []);

  const processedData = useMemo(() => {
    if (!rowData) return {};
    const today = new Date().toISOString().split("T")[0];
    const isActive = ({ status }) => (status || "").toUpperCase() === "ACTIVE";
    const isYetToStart = ({ startDate }) => !!startDate && startDate > today;
    return {
      all: rowData,
      active: rowData.filter(isActive),
      yetToStart: rowData.filter(isYetToStart),
      current: rowData.filter((row) => isActive(row) || isYetToStart(row)),
    };
  }, [rowData]);

  const PROJECT_CHART_KEYS = ["invoicesVsBillsByProject", "billRateBreakdown", "activeProjectsByMonth"];
  const visibleProjectOverviewCharts = GLOBAL_CHARTS.filter(
    (c) => PROJECT_CHART_KEYS.includes(c.key) && canAccessEntity(user?.role, "project"),
  );
  const { settingsContent, contentNode } = useChartOverview(visibleProjectOverviewCharts);

  const getFlattenedData = (data) => {
    let updatedData = data.map((dataObj) => {
      return { ...dataObj };

      // return { ...dataObj,...dataObj.assignments[0],...dataObj.employee.firstName.value, ...dataObj.employee.employeeAssignments[0],...dataObj.customer,...dataObj.billRates[0] }
    });
    console.log(updatedData);
    return updatedData || [];
  };

  const fetchData = async () => {
    try {
      const response = await fetch(API_ENDPOINTS.getProjects);
      const data = await response.json();
      const flattendData = getFlattenedData(data);
      setRowData(flattendData);
      setEmployeeLoading(false);
      console.log(flattendData);
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };

  const [employees, setEmployees] = useState([]);

  const fetchEmployees = async () => {
    try {
      const response = await fetch(API_ENDPOINTS.getAllEmployees);
      const data = await response.json();
      setEmployees(data || []);
    } catch (error) {
      console.error("Error fetching employees:", error);
    }
  };

  useEffect(() => {
    fetchData();
    fetchEmployees();
  }, []);

  // Two data-quality checks against the full employee roster: an Active
  // employee with no active project row at all, or the reverse — someone
  // who still has an active project assigned despite no longer being
  // Active themselves. A Closed/Inactive project on an Inactive employee is
  // a perfectly consistent state, not an alert — only the project's own
  // status (not just its existence) counts as "has a project" here.
  const projectAlerts = useMemo(() => {
    if (!rowData || employees.length === 0) return [];
    const employeeIdsWithActiveProjects = new Set(
      rowData.filter((r) => (r.status || "").toUpperCase() === "ACTIVE").map((r) => r.employeeId).filter(Boolean),
    );

    const alerts = [];
    employees.forEach((emp) => {
      const isActive = (emp.status || "").toUpperCase() === "ACTIVE";
      const hasProject = employeeIdsWithActiveProjects.has(emp.employeeId);
      const employeeName = `${emp.firstName || ""} ${emp.lastName || ""}`.trim();
      if (isActive && !hasProject) {
        alerts.push({
          employeeId: emp.employeeId,
          employeeName,
          reason: "Active employee with no active project assigned",
        });
      } else if (hasProject && !isActive) {
        alerts.push({
          employeeId: emp.employeeId,
          employeeName,
          reason: `Has an active project assigned but employee status is "${emp.status || "Unknown"}"`,
        });
      }
    });
    return alerts;
  }, [rowData, employees]);

  const alertContent = (
    <div style={{ maxHeight: 320, overflowY: "auto", minWidth: 320 }}>
      {projectAlerts.length === 0 ? (
        <Empty description="No alerts" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <List
          size="small"
          dataSource={projectAlerts}
          renderItem={(item) => (
            <List.Item key={`${item.employeeId}-${item.reason}`}>
              <List.Item.Meta title={item.employeeName} description={item.reason} />
            </List.Item>
          )}
        />
      )}
    </div>
  );

  const items = [
    {
      key: "1",
      label: "Active",
      children: (
        <ProjectList
          projectsList={processedData?.active}
          isCollapsed={isCollapsed}
          onRefresh={fetchData}
          onEditProject={openEditProject}
        />
      ),
    },
    {
      key: "3",
      label: "Yet to Start",
      children: (
        <ProjectList
          projectsList={processedData?.yetToStart}
          isCollapsed={isCollapsed}
          onRefresh={fetchData}
          onEditProject={openEditProject}
        />
      ),
    },
    {
      key: "4",
      label: "Current",
      children: (
        <ProjectList
          projectsList={processedData?.current}
          isCollapsed={isCollapsed}
          onRefresh={fetchData}
          onEditProject={openEditProject}
        />
      ),
    },
    {
      key: "2",
      label: "All",
      children: (
        <ProjectList
          projectsList={rowData}
          isCollapsed={isCollapsed}
          onRefresh={fetchData}
          onEditProject={openEditProject}
        />
      ),
    },
  ];

  return (
    <>
      <div className="project-dashboard-outer">
        {/* Collapsible Section (Takes 30% Height) */}
        <Collapse
          onChange={handleCollapseChange}
          style={{
            flex: isCollapsed ? "0 0 22%" : "0 0 5%" /* Hide when collapsed */,
            marginBottom: "10px",
            transition: "flex 0.3s ease-in-out" /* Smooth transition */,
          }}
        >
          <Panel
            header="Projects Overview"
            key="1"
            extra={
              <div style={{ display: "flex", alignItems: "center", gap: 16 }} onClick={(e) => e.stopPropagation()}>
                <Popover content={alertContent} title="Project Alerts" trigger="click" placement="bottomRight">
                  <Badge count={projectAlerts.length} size="small">
                    <Button icon={<BellOutlined />} size="small" />
                  </Badge>
                </Popover>
                <ChartSettingsIcon settingsContent={settingsContent} />
              </div>
            }
          >
            {contentNode}
          </Panel>
        </Collapse>

        <Drawer
          title={editingProject ? "Edit Project" : "Create New Project"}
          placement="right"
          size="large"
          onClose={onClose}
          open={open}
          // The form's prefill effect doesn't key off `editingProject` itself
          // (see ProjectOnBoarding.jsx), so without a remount, opening Edit on
          // a second project right after closing the first would still show
          // the first project's data — destroyOnClose forces a fresh mount
          // (and a fresh prefill) every time this drawer reopens.
          destroyOnClose
        >
          <ProjectOnBoardingForm onClose={onClose} editingProject={editingProject} />
        </Drawer>
        <div
          className={`project-c ${isCollapsed ? "expanded" : "collapsed"}`}
        >
          <Card className="employeeTableCard" style={{ height: "100%" }}>
            <Tabs
              className="project-home-tabs"
              onChange={setActiveKey}
              items={items}
              defaultActiveKey="0"
              tabBarExtraContent={
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Button
                    type="primary"
                    className="button-customer"
                    onClick={addNewProject}
                  >
                    <PlusOutlined /> Add New Project
                  </Button>
                </div>
              }
            />
          </Card>
        </div>
      </div>
    </>
  );
};

export default ProjectDashboard;
