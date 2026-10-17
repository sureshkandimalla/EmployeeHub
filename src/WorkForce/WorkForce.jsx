import React, { useContext, useState, useMemo, useEffect } from "react";
import { Tabs, Card, Collapse, Button, Drawer, message, Checkbox } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { QueryClient, useQuery } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import Newemployee from "../Newemployee/Newemployee";
import WorkForceList from "./WorkForceList";
import WorkForceReconcileList from "./WorkForceReconcileList"
import { useChartOverview, ChartSettingsIcon } from "../Utils/ChartOverviewPanel";
import { GLOBAL_CHARTS } from "../Charts/globalChartRegistry";
import "../WorkForce/WorkForce.css"
import AuthContext from "../Authentication/Context/AuthContext";
import { canAccessEntity } from "../Utils/roleAccess";
import API_ENDPOINTS from "../config";
import { useNudgeResize } from "../Utils/useNudgeResize";

const fetchEmployees = async () => {
  const response = await fetch(API_ENDPOINTS.getAllEmployees);
  return response.json();
};
const fetchReconcileRecords = async () => {
  const response = await fetch(API_ENDPOINTS.reconcileRecords);
  return response.json();
};

const { Panel } = Collapse;

const WorkForceContent = () => {
  const { user } = useContext(AuthContext);
  const [open, setOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showNewHires, setShowNewHires] = useState(false);
  useNudgeResize();

  const {
    data: reconcileData,
    isLoading: isreconcileDatasLoading,
    error: reconcileDataError,
    refetch: refetchReconcileData,
  } = useQuery({
    queryKey: ["reconcileData"],
    queryFn: fetchReconcileRecords,
     staleTime: 5 * 60 * 1000,
     cacheTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  const {
    data: employeeData,
    isLoading: isEmployeesLoading,
    error: employeesError,
    refetch: refetchEmployees,
  } = useQuery({
    queryKey: ["employees"],
    queryFn: fetchEmployees,
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const handleCollapseChange = () => {
    setIsCollapsed((prev) => !prev);
  };

  const processedData = useMemo(() => {
    if (!Array.isArray(employeeData)) {
      return {
        all: [],
        usa: [],
        india: [],
        active: [],
        onboarding: [],
        approved: [],
        terminated: [],
        billable: [],
        fulltime: [],
        corpData: [],
      };
    }
    const visibleEmployees = showNewHires
      ? employeeData
      : employeeData.filter(({ status }) => status !== "NewHires");

    return {
      all: visibleEmployees,
      usa: visibleEmployees.filter(({ workCountry }) => ["USA", "US"].includes((workCountry || "").toUpperCase())),
      india: visibleEmployees.filter(({ workCountry }) => ["INDIA", "IN"].includes((workCountry || "").toUpperCase())),
      active: visibleEmployees.filter(({ status }) => status === "Active"),
      onboarding: visibleEmployees.filter(({ status }) => status === "Onboarding"),
      approved: visibleEmployees.filter(({ status }) => status === "Approved"),
      terminated: visibleEmployees.filter(({ status }) => status !== "Active"),
      billable: visibleEmployees.filter(
        ({ resourceType }) => resourceType === "Billable",
      ),
      fulltime: visibleEmployees.filter(({ employmentType }) =>
        ["W2", "Full-Time"].includes(employmentType),
      ),
      corpData: visibleEmployees.filter(({ employmentType }) =>
        ["1099", "C2C"].includes(employmentType),
      ),
    };
  }, [employeeData, showNewHires]);

  // Company Overview reuses the same standardized chart widgets as the Home
  // page (colors, time-range dropdown, legend styling) instead of hand-rolled
  // PieCharts/PieLegend pairs, so the two pages look consistent.
  const CHART_ENTITY = {
    invoiceStatus: "invoice",
    workforceStatus: "team",
    activeProjectsByMonth: "project",
    activeEmployeesByMonth: "team",
  };
  const companyOverviewCharts = GLOBAL_CHARTS.filter(
    (c) =>
      ["invoiceStatus", "workforceStatus", "activeProjectsByMonth", "activeEmployeesByMonth"].includes(c.key) &&
      canAccessEntity(user?.role, CHART_ENTITY[c.key]),
  );
  const { settingsContent, contentNode } = useChartOverview(companyOverviewCharts);

  const items = [
    {
      key: "0",
      label: "USA",
      children: <WorkForceList employees={processedData.usa} isCollapsed={isCollapsed} onRefresh={refetchEmployees} />,
    },
    // { key: '1', label: 'USA', children: <WorkForceList employees={processedData.usa} /> },
    {
      key: "2",
      label: "India",
      children: <WorkForceList employees={processedData.india} isCollapsed={isCollapsed} onRefresh={refetchEmployees} />,
    },
    {
      key: "3",
      label: "Billable Employees",
      children: <WorkForceList employees={processedData.billable} isCollapsed={isCollapsed} onRefresh={refetchEmployees} />,
    },
    {
      key: "4",
      label: "Workforce",
      children: <WorkForceList employees={processedData.all} isCollapsed={isCollapsed} onRefresh={refetchEmployees} />,
    },
    {
      key: "5",
      label: "Active Employees",
      children: <WorkForceList employees={processedData.active} isCollapsed={isCollapsed} onRefresh={refetchEmployees} />,
    },
    {
      key: "6",
      label: "Onboarding",
      children: <WorkForceList employees={processedData.onboarding} isCollapsed={isCollapsed} onRefresh={refetchEmployees} />,
    },
    {
      key: "7",
      label: "Fulltime",
      children: <WorkForceList employees={processedData.terminated} isCollapsed={isCollapsed} onRefresh={refetchEmployees} />,
    },
    {
      key: "8",
      label: "Corp to Corp",
      children: <WorkForceList employees={processedData.terminated} isCollapsed={isCollapsed} onRefresh={refetchEmployees} />,
    },
    {
      key: "9",
      label: "Terminated",
      children: <WorkForceList employees={processedData.terminated} isCollapsed={isCollapsed} onRefresh={refetchEmployees} />,
    },
    {
      key: "10",
      label: "Reconcile",
      children: <WorkForceReconcileList employees={Array.isArray(reconcileData) ? reconcileData : []} isCollapsed={isCollapsed} onRefresh={refetchReconcileData} />,
    },
  ];

  const handleAddNewEmployee = () => setOpen(true);

  // Left-nav "Create > Team > Employee" links here with ?new=1 to land
  // straight on the add-employee drawer instead of just the grid.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("new") === "1") {
      setOpen(true);
    }
  }, []);

  const handleDrawerClose = (action) => {
    setOpen(false);
    if (action === "submit") refetchEmployees();
  };

  if (employeesError || reconcileDataError) {
    message.error("Error fetching data. Please try again later.");
  }

  return (
    <>
    {/* Drawer for Adding Employee */}
    <Drawer title="Employee Onboarding" placement="right" size="large" onClose={handleDrawerClose} open={open}>
        <Newemployee onClose={handleDrawerClose} />
      </Drawer>

    <div style={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden", // Prevents unwanted scroll
        }}>
      {/* Collapsible Section (Takes 30% Height) */}
<Collapse
  onChange={handleCollapseChange}
  style={{
    flex: isCollapsed ? "0 0 45%":"0 0 5%", /* Hide when collapsed */
    marginBottom: "10px",
    transition: "flex 0.3s ease-in-out", /* Smooth transition */
    minHeight: 0, /* let the panel body's own overflow:auto do the scrolling, not get clipped by this flex item's own box */
  }}
>
  <Panel
    header="Company Overview"
    key="1"
    extra={
      <div onClick={(e) => e.stopPropagation()}>
        <ChartSettingsIcon settingsContent={settingsContent} />
      </div>
    }
  >
    {/* Charts are individually resizable (see useChartOverview) and can grow
        taller than whatever budget this panel has — scroll instead of
        silently clipping them via the page's outer overflow:hidden. */}
    <div style={{ maxHeight: "calc(100vh - 260px)", overflowY: "auto" }}>
      {contentNode}
    </div>
  </Panel>
</Collapse>


<div className={`workforce-c ${isCollapsed ? "expanded" : "collapsed"}`}>
  <Card className="employeeTableCard" style={{ height: "100%" }}>
    <Tabs
      className="bean-home-tabs"
      defaultActiveKey="4"
      items={items}
      tabBarExtraContent={
        <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Checkbox
            checked={showNewHires}
            onChange={(e) => setShowNewHires(e.target.checked)}
          >
            Show New Hires
          </Checkbox>
          <Button type="primary" onClick={handleAddNewEmployee}>
            <PlusOutlined /> Add New Employee
          </Button>
        </span>
      }
    />
  </Card>
</div>

    </div>
  </>
  );
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

const persister = createSyncStoragePersister({
  storage: window.localStorage,
});

const WorkForce = () => {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister }}
      onSuccess={() => queryClient.resumePausedMutations()}
    >
      <WorkForceContent />
    </PersistQueryClientProvider>
  );
};

export default WorkForce;
