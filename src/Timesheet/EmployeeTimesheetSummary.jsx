import React, { useState, useEffect, useMemo, useContext } from "react";
import { AgGridReact } from "@ag-grid-community/react";
import { Tag, Button, Dropdown, message } from "antd";
import { MoreOutlined, FormOutlined } from "@ant-design/icons";
import axios from "axios";
import dayjs from "dayjs";
import { useNavigate } from "react-router-dom";
import API_ENDPOINTS from "../config";
import "ag-grid-enterprise";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import { getCellCopyContextMenuItems } from "../Utils/agGridCellCopy";
import AuthContext from "../Authentication/Context/AuthContext";
import { ROLES } from "../Utils/roleAccess";

const STATUS_COLOR = { Draft: "default", Submitted: "gold", Approved: "green", Rejected: "red" };
const STATUS_ICON_COLOR = { Draft: "#595959", Submitted: "#d48806", Approved: "#389e0d", Rejected: "#cf1322" };

// Month-by-month status/totals for one employee across all their active
// projects — the "Timesheets" tab on Employee Full Details. Read-only for
// hours (editing happens on Monthly Timesheets — "Fill Timesheet" jumps
// there with this employee/month pre-selected), but status can be changed
// right here via the per-row action menu.
const EmployeeTimesheetSummary = ({ employeeId, isCollapsed, gridHeight = "calc(100vh - 320px)" }) => {
  const [rowData, setRowData] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  // Approve/Reopen are ADMIN-only server-side (TimeSheetController) —
  // mirrored here so the menu items aren't shown only to 403.
  const { user } = useContext(AuthContext);
  const isAdmin = user?.role === ROLES.ADMIN;

  useEffect(() => {
    if (employeeId) fetchSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId]);

  const fetchSummary = () => {
    setLoading(true);
    axios
      .get(API_ENDPOINTS.assignmentsForEmployee(employeeId))
      .then((response) => {
        const assignments = response.data || [];
        if (assignments.length === 0) {
          setRowData([]);
          setLoading(false);
          return;
        }

        const currentMonth = dayjs().startOf("month");
        let overallStart = null;
        let overallEnd = null;
        assignments.forEach((a) => {
          if (a.startDate) {
            const start = dayjs(a.startDate);
            if (!overallStart || start.isBefore(overallStart)) overallStart = start;
          }
          const endMonth = a.endDate ? dayjs(a.endDate).startOf("month") : currentMonth;
          const cappedEnd = (endMonth.isBefore(currentMonth) ? endMonth : currentMonth).endOf("month");
          if (!overallEnd || cappedEnd.isAfter(overallEnd)) overallEnd = cappedEnd;
        });

        axios
          .get(
            API_ENDPOINTS.getTimesheetsByEmployeeAndRange(
              employeeId,
              overallStart.format("YYYY-MM-DD"),
              overallEnd.format("YYYY-MM-DD"),
            ),
          )
          .then((entriesResponse) => {
            const entries = entriesResponse.data || [];
            const entriesByAssignmentMonth = {};
            entries.forEach((e) => {
              const key = `${e.assignmentId}_${e.workDate.substring(0, 7)}`;
              if (!entriesByAssignmentMonth[key]) entriesByAssignmentMonth[key] = [];
              entriesByAssignmentMonth[key].push(e);
            });

            const rows = [];
            assignments.forEach((a) => {
              const startMonth = a.startDate ? dayjs(a.startDate).startOf("month") : currentMonth;
              const endMonth = a.endDate ? dayjs(a.endDate).startOf("month") : currentMonth;
              const cappedEndMonth = endMonth.isBefore(currentMonth) ? endMonth : currentMonth;

              let cursor = startMonth;
              while (!cursor.isAfter(cappedEndMonth, "month")) {
                const yearMonth = cursor.format("YYYY-MM");
                const monthEntries = entriesByAssignmentMonth[`${a.assignmentId}_${yearMonth}`] || [];
                const totalHours = monthEntries.reduce((sum, e) => sum + (e.hours || 0), 0);
                const statuses = monthEntries.map((e) => e.status).filter(Boolean);
                let status = "Draft";
                if (statuses.includes("Approved")) status = "Approved";
                else if (statuses.includes("Rejected")) status = "Rejected";
                else if (statuses.includes("Submitted")) status = "Submitted";

                rows.push({
                  key: `${a.assignmentId}_${yearMonth}`,
                  assignmentId: a.assignmentId,
                  projectName: a.projectName,
                  yearMonth,
                  monthLabel: cursor.format("MMM YYYY"),
                  totalHours,
                  status,
                });
                cursor = cursor.add(1, "month");
              }
            });

            rows.sort((r1, r2) => r2.yearMonth.localeCompare(r1.yearMonth) || r1.projectName.localeCompare(r2.projectName));
            setRowData(rows);
          })
          .finally(() => setLoading(false));
      })
      .catch((error) => {
        console.error("Error fetching employee timesheet summary:", error);
        setLoading(false);
      });
  };

  const handleStatusAction = (endpointFn, verb, row) => {
    const monthStart = dayjs(`${row.yearMonth}-01`);
    axios
      .post(endpointFn(row.assignmentId, monthStart.format("YYYY-MM-DD"), monthStart.endOf("month").format("YYYY-MM-DD")))
      .then(() => {
        message.success(`Month ${verb}.`);
        fetchSummary();
      })
      .catch((error) => message.error(`${verb} failed: ` + (error.response?.data?.message || error.message)));
  };

  const goToFillTimesheet = (row) => {
    navigate("/monthlytimesheets", { state: { employeeId, yearMonth: row.yearMonth } });
  };

  const columnDefs = useMemo(
    () => [
      { headerName: "Project", field: "projectName", sortable: true, minWidth: 180, enableRowGroup: true },
      { headerName: "Month", field: "monthLabel", sortable: true, minWidth: 130 },
      {
        headerName: "Total Hours",
        field: "totalHours",
        sortable: true,
        aggFunc: "sum",
        minWidth: 130,
        cellStyle: { fontWeight: "bold" },
      },
      {
        headerName: "Status",
        field: "status",
        sortable: true,
        minWidth: 130,
        enableRowGroup: true,
        cellRenderer: (params) => (params.value ? <Tag color={STATUS_COLOR[params.value]}>{params.value}</Tag> : null),
      },
      {
        headerName: "",
        colId: "actions",
        minWidth: 210,
        maxWidth: 230,
        sortable: false,
        filter: false,
        cellRenderer: (params) => {
          // Group header rows (when grouping by Project/Status) have no
          // params.data — nothing to act on there, just render nothing.
          if (!params.data) return null;
          const row = params.data;
          const status = row.status;
          const items = [
            {
              key: "submit",
              label: "Submit",
              disabled: status !== "Draft",
              onClick: () => handleStatusAction(API_ENDPOINTS.submitTimesheetRange, "submitted", row),
            },
            {
              key: "reject",
              label: "Reject",
              disabled: status !== "Submitted",
              onClick: () => handleStatusAction(API_ENDPOINTS.rejectTimesheetRange, "rejected", row),
            },
            // Approve/Reopen are ADMIN-only server-side (TimeSheetController)
            // — left out of the menu entirely for anyone else.
            ...(isAdmin
              ? [
                  {
                    key: "approve",
                    label: "Approve",
                    disabled: status !== "Submitted",
                    onClick: () => handleStatusAction(API_ENDPOINTS.approveTimesheetRange, "approved", row),
                  },
                  {
                    key: "reopen",
                    label: "Reopen",
                    disabled: status !== "Approved" && status !== "Rejected",
                    onClick: () => handleStatusAction(API_ENDPOINTS.reopenTimesheetRange, "reopened", row),
                  },
                ]
              : []),
          ];
          return (
            <div style={{ display: "flex", alignItems: "center", gap: 8, height: "100%" }}>
              <Dropdown trigger={["click"]} menu={{ items }}>
                <Button
                  size="small"
                  icon={<MoreOutlined />}
                  style={{ color: STATUS_ICON_COLOR[status], borderColor: STATUS_ICON_COLOR[status] }}
                />
              </Dropdown>
              <Button size="small" icon={<FormOutlined />} onClick={() => goToFillTimesheet(row)}>
                Fill Timesheet
              </Button>
            </div>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <div
      className="ag-theme-alpine employee-List-grid"
      style={{ height: "100%", overflow: "hidden" }}
    >
      <div style={{ height: gridHeight, minHeight: 300, width: "100%" }}>
        <AgGridReact
          getContextMenuItems={getCellCopyContextMenuItems}
          enableCellTextSelection={true}
          ensureDomOrder={true}
          rowData={rowData}
          columnDefs={columnDefs}
          loading={loading}
          defaultColDef={{ resizable: true, filter: "agSetColumnFilter", enableRowGroup: true }}
          domLayout="normal"
          rowGroupPanelShow="always"
          sideBar={{
            toolPanels: [
              {
                id: "columns",
                labelDefault: "Columns",
                labelKey: "columns",
                iconKey: "columns",
                toolPanel: "agColumnsToolPanel",
                toolPanelParams: {
                  suppressRowGroups: false,
                  suppressValues: true,
                  suppressPivots: false,
                  suppressPivotMode: true,
                  suppressColumnFilter: true,
                  suppressColumnSelectAll: true,
                  suppressColumnExpandAll: true,
                },
              },
            ],
          }}
          pagination
          paginationPageSize={100}
          popupParent={document.body}
        />
      </div>
    </div>
  );
};

export default EmployeeTimesheetSummary;
