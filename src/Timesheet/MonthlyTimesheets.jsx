import React, { useState, useEffect, useMemo, useRef } from "react";
import { AgGridReact } from "@ag-grid-community/react";
import { Card, Button, DatePicker, Dropdown, Select, Popover, Badge, List, Empty, message } from "antd";
import { ReloadOutlined, SaveOutlined, MoreOutlined, BellOutlined } from "@ant-design/icons";
import axios from "axios";
import dayjs from "dayjs";
import { useLocation } from "react-router-dom";
import API_ENDPOINTS from "../config";
import "ag-grid-enterprise";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import "./MonthlyTimesheets.css";
import { getCellCopyContextMenuItems } from "../Utils/agGridCellCopy";

const pad = (n) => String(n).padStart(2, "0");

// Every "yyyy-MM-dd" date in the given year/month (1-based), built from
// local Date math — never `new Date(isoString)`, which parses as UTC
// midnight and renders as the previous day in any timezone behind UTC.
const getMonthDates = (year, month) => {
  const daysInMonth = new Date(year, month, 0).getDate();
  const dates = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month - 1, d);
    dates.push({
      iso: `${year}-${pad(month)}-${pad(d)}`,
      dayNum: d,
      isWeekend: date.getDay() === 0 || date.getDay() === 6,
      label: date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
      inMonth: true,
    });
  }
  return dates;
};

const toIsoDate = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

// Real Monday-Sunday calendar weeks covering the month — not simple "day
// 1-7, 8-14" chunks. A month rarely starts/ends on a Monday, so the first
// and last week routinely spill into the previous/next month; those
// out-of-month days are included as non-editable placeholders purely so
// the week's column group lines up with real weekdays, matching the same
// calendar-grid approach already used on the per-project Timesheet page.
const buildCalendarWeeks = (year, month, monthDates) => {
  const dateByIso = {};
  monthDates.forEach((d) => (dateByIso[d.iso] = d));

  const daysInMonth = monthDates.length;
  const firstOfMonth = new Date(year, month - 1, 1);
  const lastOfMonth = new Date(year, month - 1, daysInMonth);

  const firstMondayOffset = (firstOfMonth.getDay() + 6) % 7; // Mon=0 ... Sun=6
  const gridStart = new Date(year, month - 1, 1 - firstMondayOffset);

  const lastMondayOffset = (lastOfMonth.getDay() + 6) % 7;
  const gridEnd = new Date(year, month - 1, daysInMonth + (6 - lastMondayOffset));

  const weeks = [];
  let weekStart = new Date(gridStart);
  while (weekStart <= gridEnd) {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      const iso = toIsoDate(d);
      days.push(
        dateByIso[iso] || {
          iso,
          dayNum: d.getDate(),
          isWeekend: d.getDay() === 0 || d.getDay() === 6,
          label: d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
          inMonth: false,
        },
      );
    }
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weeks.push({
      label: `${weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${weekEnd.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
      days,
    });
    weekStart = new Date(weekStart);
    weekStart.setDate(weekStart.getDate() + 7);
  }
  return weeks;
};

const isOutOfAssignmentRange = (row, iso) =>
  (row.startDate && iso < row.startDate) || (row.endDate && iso > row.endDate);

const isCellEditable = (row, iso) => {
  if (isOutOfAssignmentRange(row, iso)) return false;
  if (row.dayStatus?.[iso] === "Approved") return false;
  return true;
};

// Background/text tint per saved entry status, so a glance at the grid
// shows what's Approved/Submitted/Rejected without opening each week's
// action menu. Draft is intentionally left uncolored (the default look).
const STATUS_CELL_TINT = {
  Approved: { background: "#f6ffed", color: "#389e0d" },
  Rejected: { background: "#fff1f0", color: "#cf1322" },
  Submitted: { background: "#fffbe6", color: "#d48806" },
};

// Most-restrictive status across a date range's saved entries: Approved
// beats Rejected beats Submitted beats Draft. Days with no saved entry yet
// don't count — a range with nothing saved is just Draft.
const getRangeStatus = (row, rangeDates) => {
  const statuses = rangeDates.map(({ iso }) => row.dayStatus?.[iso]).filter(Boolean);
  if (statuses.includes("Approved")) return "Approved";
  if (statuses.includes("Rejected")) return "Rejected";
  if (statuses.includes("Submitted")) return "Submitted";
  return "Draft";
};

const STATUS_COLOR = { Draft: "#595959", Submitted: "#d48806", Approved: "#389e0d", Rejected: "#cf1322" };

// Action menu (Save / Submit / Approve / Reject / Reopen) scoped to a date
// range — used both inside each week's column group (rangeDates = that
// week) and in the pinned "Monthly Actions" column (rangeDates = the whole
// month). `rangeDates` and the handlers arrive via cellRendererParams.
const RangeActionsCell = (params) => {
  const { data: row, rangeDates, scopeLabel, onSave, onSubmit, onApprove, onReject, onReopen } = params;
  const status = getRangeStatus(row, rangeDates);

  const items = [
    { key: "save", label: `Save ${scopeLabel}`, onClick: () => onSave(row, rangeDates) },
    { key: "submit", label: "Submit", disabled: status !== "Draft", onClick: () => onSubmit(row, rangeDates) },
    { key: "approve", label: "Approve", disabled: status !== "Submitted", onClick: () => onApprove(row, rangeDates) },
    { key: "reject", label: "Reject", disabled: status !== "Submitted", onClick: () => onReject(row, rangeDates) },
    {
      key: "reopen",
      label: "Reopen",
      disabled: status !== "Approved" && status !== "Rejected",
      onClick: () => onReopen(row, rangeDates),
    },
  ];

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
      <Dropdown trigger={["click"]} menu={{ items }}>
        <Button
          size="small"
          icon={<MoreOutlined />}
          style={{ color: STATUS_COLOR[status], borderColor: STATUS_COLOR[status] }}
        />
      </Dropdown>
    </div>
  );
};

const daysInYearMonth = (yearMonth) => {
  const [y, m] = yearMonth.split("-").map(Number);
  return new Date(y, m, 0).getDate();
};

const isWeekendForYearMonthDay = (yearMonth, dayNum) => {
  const [y, m] = yearMonth.split("-").map(Number);
  const dow = new Date(y, m - 1, dayNum).getDay();
  return dow === 0 || dow === 6;
};

// Real Monday-Sunday calendar weeks for a summary row's own month (each row
// is a different month, so this can't be computed once and shared — every
// row needs its own, since Jan and Feb don't align to the same weekdays).
const getRowCalendarWeeks = (row) => {
  const [year, month] = row.yearMonth.split("-").map(Number);
  return buildCalendarWeeks(year, month, getMonthDates(year, month));
};

// Action menu for the per-employee monthly-summary grid, where each row is
// (assignment, month) rather than a real shared calendar month — so unlike
// RangeActionsCell (which takes a literal rangeDates array), this derives
// the real iso date range from the row's own `yearMonth`, either the whole
// month (weekIdx omitted) or one real Monday-Sunday week of it (weekIdx =
// index into getRowCalendarWeeks, clipped to that week's in-month days).
const MonthRowActionsCell = (params) => {
  const { data: row, weekIdx, onSave, onSubmit, onApprove, onReject, onReopen } = params;
  const scopeLabel = weekIdx == null ? "Month" : "Week";
  let rangeDates;
  if (weekIdx == null) {
    rangeDates = [];
    for (let d = 1; d <= row.daysInMonth; d++) rangeDates.push({ iso: `${row.yearMonth}-${pad(d)}` });
  } else {
    const week = getRowCalendarWeeks(row)[weekIdx];
    rangeDates = week ? week.days.filter((d) => d.inMonth).map((d) => ({ iso: d.iso })) : [];
  }
  const status = getRangeStatus(row, rangeDates);
  const minimalRow = { assignmentId: row.assignmentId };

  const items = [
    { key: "save", label: `Save ${scopeLabel}`, onClick: () => onSave(row, rangeDates) },
    { key: "submit", label: "Submit", disabled: status !== "Draft", onClick: () => onSubmit(minimalRow, rangeDates) },
    {
      key: "approve",
      label: "Approve",
      disabled: status !== "Submitted",
      onClick: () => onApprove(minimalRow, rangeDates),
    },
    { key: "reject", label: "Reject", disabled: status !== "Submitted", onClick: () => onReject(minimalRow, rangeDates) },
    {
      key: "reopen",
      label: "Reopen",
      disabled: status !== "Approved" && status !== "Rejected",
      onClick: () => onReopen(minimalRow, rangeDates),
    },
  ];

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
      <Dropdown trigger={["click"]} menu={{ items }}>
        <Button
          size="small"
          icon={<MoreOutlined />}
          style={{ color: STATUS_COLOR[status], borderColor: STATUS_COLOR[status] }}
        />
      </Dropdown>
    </div>
  );
};

const MonthlyTimesheets = () => {
  const gridRef = useRef(null);
  // "Fill Timesheet" on the Employee Full Details Timesheets tab links here
  // with { employeeId, yearMonth } in route state, to land straight on that
  // employee's month instead of starting from the blank picker state.
  const location = useLocation();
  // No default month — the grid starts empty until the user picks a month,
  // an employee, or both (unless we arrived with a month pre-selected).
  const [selectedMonth, setSelectedMonth] = useState(() =>
    location.state?.yearMonth ? dayjs(`${location.state.yearMonth}-01`) : null,
  );
  const [assignments, setAssignments] = useState([]);
  const [rowData, setRowData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [summaryRows, setSummaryRows] = useState([]);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summarySaving, setSummarySaving] = useState(false);
  // No employee picked = show every active assignment for the month.
  // Employee picked = narrow to just theirs, and bound the month picker to
  // their own project(s) active window.
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(() => location.state?.employeeId ?? null);

  // Derived from assignments rather than a separate employee-list fetch —
  // only employees with an active assignment are worth offering here, since
  // that's all this grid ever shows.
  const employeeOptions = useMemo(() => {
    const seen = new Map();
    assignments.forEach((a) => {
      if (!seen.has(a.employeeId)) seen.set(a.employeeId, a.employeeName);
    });
    return Array.from(seen, ([employeeId, employeeName]) => ({ value: employeeId, label: employeeName })).sort(
      (a, b) => a.label.localeCompare(b.label),
    );
  }, [assignments]);

  // Once an employee is picked, the month picker is bounded by the union of
  // that employee's own assignment(s) — earliest start date to latest end
  // date (capped at the current month), same rule as the per-project
  // Timesheet page's month picker.
  const employeeMonthBounds = useMemo(() => {
    if (!selectedEmployeeId) return { minMonth: null, maxMonth: null };
    const empAssignments = assignments.filter((a) => a.employeeId === selectedEmployeeId);
    if (empAssignments.length === 0) return { minMonth: null, maxMonth: null };

    const currentMonth = dayjs().startOf("month");
    let minMonth = null;
    let maxMonth = null;
    empAssignments.forEach((a) => {
      if (a.startDate) {
        const start = dayjs(a.startDate).startOf("month");
        if (!minMonth || start.isBefore(minMonth)) minMonth = start;
      }
      const endMonth = a.endDate ? dayjs(a.endDate).startOf("month") : currentMonth;
      const cappedEnd = endMonth.isBefore(currentMonth) ? endMonth : currentMonth;
      if (!maxMonth || cappedEnd.isAfter(maxMonth)) maxMonth = cappedEnd;
    });
    return { minMonth, maxMonth };
  }, [selectedEmployeeId, assignments]);

  // Snap the selected month back into range whenever picking a new employee
  // whose window doesn't include the month currently shown. Only applies
  // once a month is actually being shown — picking an employee with no
  // month selected should stay on the no-month summary view.
  useEffect(() => {
    if (!selectedEmployeeId || !selectedMonth) return;
    const { minMonth, maxMonth } = employeeMonthBounds;
    if (minMonth && selectedMonth.isBefore(minMonth, "month")) {
      setSelectedMonth(maxMonth || minMonth);
    } else if (maxMonth && selectedMonth.isAfter(maxMonth, "month")) {
      setSelectedMonth(maxMonth);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEmployeeId, employeeMonthBounds]);

  const monthDates = useMemo(
    () => (selectedMonth ? getMonthDates(selectedMonth.year(), selectedMonth.month() + 1) : []),
    [selectedMonth],
  );

  // Real Monday-Sunday weeks for weekly invoicing — a month's first/last
  // week routinely spans into the previous/next month, so each week's
  // `days` list can mix in-month and out-of-month entries (the latter
  // marked inMonth: false and rendered as locked placeholders).
  const calendarWeeks = useMemo(
    () => (selectedMonth ? buildCalendarWeeks(selectedMonth.year(), selectedMonth.month() + 1, monthDates) : []),
    [selectedMonth, monthDates],
  );

  useEffect(() => {
    fetchAssignments();
  }, []);

  useEffect(() => {
    if (assignments.length === 0) return;
    if (selectedMonth) {
      fetchMonthData();
    } else if (selectedEmployeeId) {
      fetchEmployeeSummary();
    } else {
      setRowData([]);
      setSummaryRows([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignments, selectedMonth, selectedEmployeeId]);

  const fetchAssignments = () => {
    axios
      .get(API_ENDPOINTS.getActiveAssignmentsWithDetails)
      .then((response) => setAssignments(response.data || []))
      .catch((error) => console.error("Error fetching active assignments:", error));
  };

  // Alert bell: for every active assignment, any fully-completed month
  // within its active window (start through last month — this month is
  // still in progress, so it's never flagged) with zero hours logged is a
  // missing timesheet. One fetch per employee (covering the union of their
  // assignments' check ranges), not one per assignment.
  const [timesheetAlerts, setTimesheetAlerts] = useState([]);

  useEffect(() => {
    if (assignments.length === 0) {
      setTimesheetAlerts([]);
      return;
    }

    const lastCheckMonth = dayjs().startOf("month").subtract(1, "month");

    const checksByAssignment = assignments
      .map((a) => {
        const startMonth = a.startDate ? dayjs(a.startDate).startOf("month") : null;
        if (!startMonth) return { assignment: a, months: [] };
        const endMonth = a.endDate ? dayjs(a.endDate).startOf("month") : lastCheckMonth;
        const cappedEndMonth = endMonth.isBefore(lastCheckMonth) ? endMonth : lastCheckMonth;
        const months = [];
        if (!startMonth.isAfter(cappedEndMonth, "month")) {
          let cursor = startMonth;
          while (!cursor.isAfter(cappedEndMonth, "month")) {
            months.push(cursor.format("YYYY-MM"));
            cursor = cursor.add(1, "month");
          }
        }
        return { assignment: a, months };
      })
      .filter((c) => c.months.length > 0);

    if (checksByAssignment.length === 0) {
      setTimesheetAlerts([]);
      return;
    }

    const rangeByEmployee = {};
    checksByAssignment.forEach(({ assignment, months }) => {
      const rangeStart = `${months[0]}-01`;
      const rangeEnd = dayjs(`${months[months.length - 1]}-01`).endOf("month").format("YYYY-MM-DD");
      const existing = rangeByEmployee[assignment.employeeId];
      if (!existing) {
        rangeByEmployee[assignment.employeeId] = { minStart: rangeStart, maxEnd: rangeEnd };
      } else {
        if (rangeStart < existing.minStart) existing.minStart = rangeStart;
        if (rangeEnd > existing.maxEnd) existing.maxEnd = rangeEnd;
      }
    });

    const employeeIds = Object.keys(rangeByEmployee);
    Promise.all(
      employeeIds.map((empId) =>
        axios
          .get(API_ENDPOINTS.getTimesheetsByEmployeeAndRange(empId, rangeByEmployee[empId].minStart, rangeByEmployee[empId].maxEnd))
          .then((response) => ({ empId, entries: response.data || [] }))
          .catch((error) => {
            console.error("Error checking timesheet coverage for employee " + empId, error);
            return { empId, entries: [] };
          }),
      ),
    ).then((results) => {
      const entriesByEmployee = {};
      results.forEach(({ empId, entries }) => {
        entriesByEmployee[empId] = entries;
      });

      const alerts = [];
      checksByAssignment.forEach(({ assignment, months }) => {
        const entries = entriesByEmployee[assignment.employeeId] || [];
        const hoursByMonth = {};
        entries.forEach((e) => {
          if (e.assignmentId !== assignment.assignmentId) return;
          const monthKey = e.workDate.substring(0, 7);
          hoursByMonth[monthKey] = (hoursByMonth[monthKey] || 0) + (e.hours || 0);
        });
        const missingMonths = months.filter((m) => !(hoursByMonth[m] > 0));
        if (missingMonths.length > 0) {
          alerts.push({
            assignmentId: assignment.assignmentId,
            employeeId: assignment.employeeId,
            employeeName: assignment.employeeName,
            projectName: assignment.projectName,
            months: missingMonths,
          });
        }
      });
      setTimesheetAlerts(alerts);
    });
  }, [assignments]);

  const timesheetAlertContent = (
    <div style={{ maxHeight: 320, overflowY: "auto", minWidth: 320 }}>
      {timesheetAlerts.length === 0 ? (
        <Empty description="No alerts" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <List
          size="small"
          dataSource={timesheetAlerts}
          renderItem={(item) => (
            <List.Item key={item.assignmentId}>
              <List.Item.Meta
                title={`${item.employeeName} — ${item.projectName}`}
                description={
                  <>
                    <div>{item.months.length} month{item.months.length === 1 ? "" : "s"} with no hours logged:</div>
                    <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
                      {item.months.map((m) => (
                        <li key={m}>{dayjs(`${m}-01`).format("MMM YYYY")}</li>
                      ))}
                    </ul>
                  </>
                }
              />
            </List.Item>
          )}
        />
      )}
    </div>
  );

  const fetchMonthData = () => {
    const yearMonth = `${selectedMonth.year()}-${pad(selectedMonth.month() + 1)}`;
    setLoading(true);
    axios
      .get(API_ENDPOINTS.getTimesheetsByMonth(yearMonth))
      .then((response) => {
        const entries = response.data || [];
        const entriesByAssignment = {};
        entries.forEach((e) => {
          if (!entriesByAssignment[e.assignmentId]) entriesByAssignment[e.assignmentId] = {};
          entriesByAssignment[e.assignmentId][e.workDate] = e;
        });

        // Only show assignments whose active window overlaps the selected
        // month at all — a project that ended before this month, or hasn't
        // started yet, has nothing to log here and shouldn't appear. If an
        // employee is picked, also narrow down to just theirs.
        const monthStartIso = monthDates[0]?.iso;
        const monthEndIso = monthDates[monthDates.length - 1]?.iso;
        const relevantAssignments = assignments.filter((a) => {
          if (selectedEmployeeId && a.employeeId !== selectedEmployeeId) return false;
          const endsOnOrAfterMonthStart = !a.endDate || a.endDate >= monthStartIso;
          const startsOnOrBeforeMonthEnd = !a.startDate || a.startDate <= monthEndIso;
          return endsOnOrAfterMonthStart && startsOnOrBeforeMonthEnd;
        });

        const rows = relevantAssignments.map((a) => {
          const row = {
            assignmentId: a.assignmentId,
            employeeId: a.employeeId,
            employeeName: a.employeeName,
            projectId: a.projectId,
            projectName: a.projectName,
            customerName: a.customerName,
            startDate: a.startDate,
            endDate: a.endDate,
            dayStatus: {},
          };
          let total = 0;
          const assignmentEntries = entriesByAssignment[a.assignmentId] || {};
          monthDates.forEach(({ iso }) => {
            const entry = assignmentEntries[iso];
            row[iso] = entry ? entry.hours || 0 : 0;
            row.dayStatus[iso] = entry ? entry.status : null;
            total += row[iso];
          });
          row.monthlyHours = total;
          return row;
        });
        setRowData(rows);
      })
      .catch((error) => console.error("Error fetching monthly timesheet data:", error))
      .finally(() => setLoading(false));
  };

  // One row per (assignment, month) spanning that assignment's whole active
  // period (start month through its own end month, capped at the current
  // month) — the no-month, employee-only summary view. Fetches the whole
  // range in a single call, then groups client-side.
  const fetchEmployeeSummary = () => {
    const empAssignments = assignments.filter((a) => a.employeeId === selectedEmployeeId);
    if (empAssignments.length === 0) {
      setSummaryRows([]);
      return;
    }

    const currentMonth = dayjs().startOf("month");
    let overallStart = null;
    let overallEnd = null;
    empAssignments.forEach((a) => {
      if (a.startDate) {
        const start = dayjs(a.startDate);
        if (!overallStart || start.isBefore(overallStart)) overallStart = start;
      }
      const endMonth = a.endDate ? dayjs(a.endDate).startOf("month") : currentMonth;
      const cappedEnd = (endMonth.isBefore(currentMonth) ? endMonth : currentMonth).endOf("month");
      if (!overallEnd || cappedEnd.isAfter(overallEnd)) overallEnd = cappedEnd;
    });
    if (!overallStart || !overallEnd) {
      setSummaryRows([]);
      return;
    }

    setSummaryLoading(true);
    axios
      .get(
        API_ENDPOINTS.getTimesheetsByEmployeeAndRange(
          selectedEmployeeId,
          overallStart.format("YYYY-MM-DD"),
          overallEnd.format("YYYY-MM-DD"),
        ),
      )
      .then((response) => {
        const entries = response.data || [];
        const entriesByAssignmentMonth = {};
        entries.forEach((e) => {
          const key = `${e.assignmentId}_${e.workDate.substring(0, 7)}`;
          if (!entriesByAssignmentMonth[key]) entriesByAssignmentMonth[key] = [];
          entriesByAssignmentMonth[key].push(e);
        });

        const rows = [];
        empAssignments.forEach((a) => {
          const startMonth = a.startDate ? dayjs(a.startDate).startOf("month") : currentMonth;
          const endMonth = a.endDate ? dayjs(a.endDate).startOf("month") : currentMonth;
          const cappedEndMonth = endMonth.isBefore(currentMonth) ? endMonth : currentMonth;

          let cursor = startMonth;
          while (!cursor.isAfter(cappedEndMonth, "month")) {
            const yearMonth = cursor.format("YYYY-MM");
            const monthEntriesByDate = {};
            (entriesByAssignmentMonth[`${a.assignmentId}_${yearMonth}`] || []).forEach((e) => {
              monthEntriesByDate[e.workDate] = e;
            });
            const daysInMonth = daysInYearMonth(yearMonth);

            const row = {
              key: `${a.assignmentId}_${yearMonth}`,
              assignmentId: a.assignmentId,
              employeeId: a.employeeId,
              employeeName: a.employeeName,
              projectId: a.projectId,
              projectName: a.projectName,
              customerName: a.customerName,
              startDate: a.startDate,
              endDate: a.endDate,
              yearMonth,
              monthLabel: cursor.format("MMM YYYY"),
              daysInMonth,
              dayStatus: {},
            };
            let total = 0;
            for (let d = 1; d <= daysInMonth; d++) {
              const iso = `${yearMonth}-${pad(d)}`;
              const entry = monthEntriesByDate[iso];
              row[`day${d}`] = entry ? entry.hours || 0 : 0;
              row.dayStatus[iso] = entry ? entry.status : null;
              total += row[`day${d}`];
            }
            row.monthlyHours = total;
            rows.push(row);
            cursor = cursor.add(1, "month");
          }
        });

        rows.sort((r1, r2) => r1.projectName.localeCompare(r2.projectName) || r1.yearMonth.localeCompare(r2.yearMonth));
        setSummaryRows(rows);
      })
      .catch((error) => console.error("Error fetching employee summary:", error))
      .finally(() => setSummaryLoading(false));
  };

  const onSummaryCellValueChanged = (params) => {
    const field = params.colDef.field;
    const rowKey = params.data.key;

    if (field === "monthlyHours") {
      setSummaryRows((prev) =>
        prev.map((row) => {
          if (row.key !== rowKey) return row;
          const updated = { ...row };
          for (let d = 1; d <= row.daysInMonth; d++) {
            const iso = `${row.yearMonth}-${pad(d)}`;
            // Weekends are never auto-filled — only weekdays get the 8h
            // default; the user can still type weekend hours in manually.
            if (!isWeekendForYearMonthDay(row.yearMonth, d) && isCellEditable(row, iso)) {
              updated[`day${d}`] = 8;
            }
          }
          return updated;
        }),
      );
      return;
    }

    if (field) {
      setSummaryRows((prev) =>
        prev.map((row) => (row.key === rowKey ? { ...row, [field]: Number(params.newValue) || 0 } : row)),
      );
      return;
    }

    // Day cells have no static `field` (their real day-of-month varies per
    // row, so they use valueGetter/valueSetter on a positional colId
    // instead) — the valueSetter already mutated params.data in place, so
    // just replace the row with a fresh copy to get React to re-render
    // (Hours/Total, other weeks' cells, etc).
    setSummaryRows((prev) => prev.map((row) => (row.key === rowKey ? { ...params.data } : row)));
  };

  // Saves one summary row's days for a given date range (a real week, or
  // the whole month) — the per-row/per-week "Save" action in the M and
  // week-action columns, same bulk endpoint as Save All.
  const handleSummaryRowSave = (row, rangeDates) => {
    const entries = rangeDates
      .map(({ iso }) => {
        const dayNum = Number(iso.split("-")[2]);
        return { iso, hours: Number(row[`day${dayNum}`]) || 0, hadEntry: row.dayStatus[iso] != null };
      })
      .filter((d) => d.hours > 0 || d.hadEntry)
      .map((d) => ({
        employeeId: row.employeeId,
        assignmentId: row.assignmentId,
        projectId: row.projectId,
        workDate: d.iso,
        hours: d.hours,
      }));

    if (entries.length === 0) {
      message.info("Nothing to save.");
      return;
    }

    axios
      .post(API_ENDPOINTS.saveTimesheetBulk, entries)
      .then((response) => {
        const { saved, lockedDates, outOfRangeDates } = response.data || {};
        message.success(`Saved ${saved ?? 0} day(s).`);
        if (lockedDates && lockedDates.length > 0) {
          message.warning(`${lockedDates.length} day(s) are Approved and locked.`);
        }
        if (outOfRangeDates && outOfRangeDates.length > 0) {
          message.warning(`${outOfRangeDates.length} day(s) are outside the project's active dates.`);
        }
        fetchEmployeeSummary();
      })
      .catch((error) => message.error("Save failed: " + (error.response?.data?.message || error.message)));
  };

  const handleSummarySaveAll = () => {
    const entries = [];
    summaryRows.forEach((row) => {
      for (let d = 1; d <= row.daysInMonth; d++) {
        const iso = `${row.yearMonth}-${pad(d)}`;
        const hours = Number(row[`day${d}`]) || 0;
        const hadEntry = row.dayStatus[iso] != null;
        if (hours > 0 || hadEntry) {
          entries.push({
            employeeId: row.employeeId,
            assignmentId: row.assignmentId,
            projectId: row.projectId,
            workDate: iso,
            hours,
          });
        }
      }
    });

    if (entries.length === 0) {
      message.info("Nothing to save yet.");
      return;
    }

    setSummarySaving(true);
    axios
      .post(API_ENDPOINTS.saveTimesheetBulk, entries)
      .then((response) => {
        const { saved, lockedDates, outOfRangeDates } = response.data || {};
        message.success(`Saved ${saved ?? 0} entr${saved === 1 ? "y" : "ies"}.`);
        if (lockedDates && lockedDates.length > 0) {
          message.warning(`${lockedDates.length} entr${lockedDates.length === 1 ? "y is" : "ies are"} Approved and locked — skipped.`);
        }
        if (outOfRangeDates && outOfRangeDates.length > 0) {
          message.warning(`${outOfRangeDates.length} entr${outOfRangeDates.length === 1 ? "y is" : "ies are"} outside the project's active dates — skipped.`);
        }
        fetchEmployeeSummary();
      })
      .catch((error) => {
        console.error("Error saving employee summary:", error);
        message.error("Save failed: " + (error.response?.data?.message || error.message));
      })
      .finally(() => setSummarySaving(false));
  };

  const refreshCurrentView = () => {
    if (selectedMonth) fetchMonthData();
    else if (selectedEmployeeId) fetchEmployeeSummary();
  };

  // The Refresh button (unlike refreshCurrentView, used internally after
  // save/status actions to keep the current selection) starts the page
  // over: clear the employee/month picks and pull the latest assignment
  // list, back to the initial empty-state view.
  const handleResetView = () => {
    setSelectedEmployeeId(null);
    setSelectedMonth(null);
    fetchAssignments();
  };

  const onCellValueChanged = (params) => {
    const field = params.colDef.field;
    const { assignmentId } = params.data;

    if (field === "monthlyHours") {
      setRowData((prev) =>
        prev.map((row) => {
          if (row.assignmentId !== assignmentId) return row;
          const updated = { ...row };
          monthDates.forEach(({ iso, isWeekend }) => {
            // Weekends are never auto-filled — only weekdays get the 8h
            // default; the user can still type weekend hours in manually.
            if (!isWeekend && isCellEditable(row, iso)) updated[iso] = 8;
          });
          return updated;
        }),
      );
      return;
    }

    setRowData((prev) =>
      prev.map((row) =>
        row.assignmentId === assignmentId ? { ...row, [field]: Number(params.newValue) || 0 } : row,
      ),
    );
  };

  const handleSaveAll = () => {
    const entries = [];
    rowData.forEach((row) => {
      monthDates.forEach(({ iso }) => {
        const hours = Number(row[iso]) || 0;
        const hadEntry = row.dayStatus[iso] != null;
        if (hours > 0 || hadEntry) {
          entries.push({
            employeeId: row.employeeId,
            assignmentId: row.assignmentId,
            projectId: row.projectId,
            workDate: iso,
            hours,
          });
        }
      });
    });

    if (entries.length === 0) {
      message.info("Nothing to save yet.");
      return;
    }

    setSaving(true);
    axios
      .post(API_ENDPOINTS.saveTimesheetBulk, entries)
      .then((response) => {
        const { saved, lockedDates, outOfRangeDates } = response.data || {};
        message.success(`Saved ${saved ?? 0} entr${saved === 1 ? "y" : "ies"}.`);
        if (lockedDates && lockedDates.length > 0) {
          message.warning(`${lockedDates.length} entr${lockedDates.length === 1 ? "y is" : "ies are"} Approved and locked — skipped.`);
        }
        if (outOfRangeDates && outOfRangeDates.length > 0) {
          message.warning(`${outOfRangeDates.length} entr${outOfRangeDates.length === 1 ? "y is" : "ies are"} outside the project's active dates — skipped.`);
        }
        refreshCurrentView();
      })
      .catch((error) => {
        console.error("Error saving monthly timesheets:", error);
        message.error("Save failed: " + (error.response?.data?.message || error.message));
      })
      .finally(() => setSaving(false));
  };

  const isMonthDisabled = (current) => {
    if (!current) return false;
    if (current.isAfter(dayjs(), "month")) return true;
    if (selectedEmployeeId) {
      const { minMonth, maxMonth } = employeeMonthBounds;
      if (minMonth && current.isBefore(minMonth, "month")) return true;
      if (maxMonth && current.isAfter(maxMonth, "month")) return true;
    }
    return false;
  };

  // Saves one row's days for a given date range (a week, or the whole
  // month), via the same bulk endpoint used by Save All.
  const handleRangeSave = (row, rangeDates) => {
    const entries = rangeDates
      .map(({ iso }) => ({ iso, hours: Number(row[iso]) || 0, hadEntry: row.dayStatus[iso] != null }))
      .filter((d) => d.hours > 0 || d.hadEntry)
      .map((d) => ({
        employeeId: row.employeeId,
        assignmentId: row.assignmentId,
        projectId: row.projectId,
        workDate: d.iso,
        hours: d.hours,
      }));

    if (entries.length === 0) {
      message.info("Nothing to save.");
      return;
    }

    axios
      .post(API_ENDPOINTS.saveTimesheetBulk, entries)
      .then((response) => {
        const { saved, lockedDates, outOfRangeDates } = response.data || {};
        message.success(`Saved ${saved ?? 0} day(s).`);
        if (lockedDates && lockedDates.length > 0) {
          message.warning(`${lockedDates.length} day(s) are Approved and locked.`);
        }
        if (outOfRangeDates && outOfRangeDates.length > 0) {
          message.warning(`${outOfRangeDates.length} day(s) are outside the project's active dates.`);
        }
        refreshCurrentView();
      })
      .catch((error) => message.error("Save failed: " + (error.response?.data?.message || error.message)));
  };

  // Builds a submit/approve/reject/reopen handler bound to a specific range
  // endpoint — all four just call that endpoint with the range's bounds
  // (a week's Mon-Sun, the whole displayed month, or a summary row's month)
  // and refresh whichever view (day-grid or employee summary) is showing.
  const handleRangeStatusAction = (endpointFn, verb) => (row, rangeDates) => {
    const startDate = rangeDates[0].iso;
    const endDate = rangeDates[rangeDates.length - 1].iso;
    axios
      .post(endpointFn(row.assignmentId, startDate, endDate))
      .then(() => {
        message.success(`Range ${verb}.`);
        refreshCurrentView();
      })
      .catch((error) => message.error(`${verb} failed: ` + (error.response?.data?.message || error.message)));
  };

  const handleRangeSubmit = handleRangeStatusAction(API_ENDPOINTS.submitTimesheetRange, "submitted");
  const handleRangeApprove = handleRangeStatusAction(API_ENDPOINTS.approveTimesheetRange, "approved");
  const handleRangeReject = handleRangeStatusAction(API_ENDPOINTS.rejectTimesheetRange, "rejected");
  const handleRangeReopen = handleRangeStatusAction(API_ENDPOINTS.reopenTimesheetRange, "reopened");

  // Not memoized — small column set, recomputed each render so the action
  // handlers' closures stay fresh (this grid has no natural dependency that
  // would double as a safe memo key, unlike the day-grid's columnDefs).
  // Day columns are positional (Week 1 Mon, Week 1 Tue, ... Week 6 Sun) —
  // slot position is fixed and always means the same weekday, but which
  // real day-of-month (and whether it's in-month at all) fills that slot
  // is computed per row via getRowCalendarWeeks, since every row is a
  // different month with its own Monday-Sunday alignment. 6 week-groups
  // covers the longest possible real calendar layout; rows whose month
  // needs fewer weeks just show blank cells in the trailing group(s).
  const summaryColumnDefs = (() => {
    const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const MAX_WEEK_GROUPS = 6;

    return [
      { headerName: "Employee", field: "employeeName", pinned: "left", minWidth: 160, editable: false },
      { headerName: "Customer", field: "customerName", pinned: "left", minWidth: 160, editable: false },
      { headerName: "Month", field: "monthLabel", pinned: "left", minWidth: 100, editable: false },
      {
        headerName: "Hours",
        field: "monthlyHours",
        pinned: "left",
        minWidth: 110,
        editable: true,
        cellStyle: { fontWeight: "bold" },
      },
      {
        headerName: "M",
        colId: "monthActions",
        pinned: "left",
        width: 60,
        minWidth: 60,
        maxWidth: 60,
        sortable: false,
        filter: false,
        editable: false,
        cellRenderer: MonthRowActionsCell,
        cellRendererParams: {
          onSave: handleSummaryRowSave,
          onSubmit: handleRangeSubmit,
          onApprove: handleRangeApprove,
          onReject: handleRangeReject,
          onReopen: handleRangeReopen,
        },
      },
      ...Array.from({ length: MAX_WEEK_GROUPS }, (_, weekIdx) => ({
        headerName: `Week ${weekIdx + 1}`,
        children: [
          ...WEEKDAY_LABELS.map((label, slotIdx) => ({
            headerName: label,
            headerClass: "timesheet-day-header",
            colId: `w${weekIdx}_${slotIdx}`,
            width: 64,
            minWidth: 64,
            maxWidth: 64,
            sortable: false,
            filter: false,
            suppressHeaderMenuButton: true,
            suppressMovable: true,
            valueGetter: (params) => {
              const row = params.data;
              const day = getRowCalendarWeeks(row)[weekIdx]?.days[slotIdx];
              return day && day.inMonth ? row[`day${day.dayNum}`] ?? 0 : null;
            },
            valueSetter: (params) => {
              const row = params.data;
              const day = getRowCalendarWeeks(row)[weekIdx]?.days[slotIdx];
              if (!day || !day.inMonth) return false;
              row[`day${day.dayNum}`] = Number(params.newValue) || 0;
              return true;
            },
            editable: (params) => {
              const row = params.data;
              const day = getRowCalendarWeeks(row)[weekIdx]?.days[slotIdx];
              if (!day || !day.inMonth) return false;
              return isCellEditable(row, `${row.yearMonth}-${pad(day.dayNum)}`);
            },
            tooltipValueGetter: (params) => {
              const row = params.data;
              const day = getRowCalendarWeeks(row)[weekIdx]?.days[slotIdx];
              return day && day.inMonth ? day.label : undefined;
            },
            cellStyle: (params) => {
              const row = params.data;
              const day = getRowCalendarWeeks(row)[weekIdx]?.days[slotIdx];
              if (!day || !day.inMonth) return { background: "#f5f5f5", color: "#ccc" };
              const iso = `${row.yearMonth}-${pad(day.dayNum)}`;
              if (isOutOfAssignmentRange(row, iso)) return { background: "#f0f0f0", color: "#bbb" };
              const tint = STATUS_CELL_TINT[row.dayStatus?.[iso]];
              if (tint) return { ...tint, fontWeight: 600 };
              return null;
            },
          })),
          {
            headerName: "",
            colId: `weekActions_${weekIdx}`,
            width: 56,
            minWidth: 56,
            maxWidth: 56,
            sortable: false,
            filter: false,
            suppressHeaderMenuButton: true,
            suppressMovable: true,
            editable: false,
            cellRenderer: MonthRowActionsCell,
            cellRendererParams: {
              weekIdx,
              onSave: handleSummaryRowSave,
              onSubmit: handleRangeSubmit,
              onApprove: handleRangeApprove,
              onReject: handleRangeReject,
              onReopen: handleRangeReopen,
            },
          },
        ],
      })),
      {
        headerName: "Total",
        field: "total",
        pinned: "right",
        minWidth: 90,
        editable: false,
        valueGetter: (params) => {
          const row = params.data;
          if (!row) return 0;
          let sum = 0;
          for (let d = 1; d <= row.daysInMonth; d++) sum += Number(row[`day${d}`]) || 0;
          return sum;
        },
        cellStyle: { fontWeight: "bold" },
      },
    ];
  })();

  const columnDefs = useMemo(() => {
    const cols = [
      {
        headerName: "Employee",
        field: "employeeName",
        pinned: "left",
        minWidth: 160,
        editable: false,
      },
      {
        headerName: "Customer",
        field: "customerName",
        pinned: "left",
        minWidth: 160,
        editable: false,
      },
      {
        headerName: "Hours",
        field: "monthlyHours",
        pinned: "left",
        minWidth: 130,
        editable: true,
        cellStyle: { fontWeight: "bold" },
      },
      {
        headerName: "Monthly Actions",
        colId: "monthActions",
        pinned: "left",
        width: 70,
        minWidth: 70,
        maxWidth: 70,
        sortable: false,
        filter: false,
        editable: false,
        cellRenderer: RangeActionsCell,
        cellRendererParams: {
          rangeDates: monthDates,
          scopeLabel: "Month",
          onSave: handleRangeSave,
          onSubmit: handleRangeSubmit,
          onApprove: handleRangeApprove,
          onReject: handleRangeReject,
          onReopen: handleRangeReopen,
        },
      },
      ...calendarWeeks.map((week) => ({
        headerName: week.label,
        children: [
          ...week.days.map(({ iso, dayNum, isWeekend, label, inMonth }) => ({
            headerName: pad(dayNum),
            headerTooltip: label,
            headerClass: "timesheet-day-header",
            field: iso,
            width: 64,
            minWidth: 64,
            maxWidth: 64,
            sortable: false,
            filter: false,
            suppressHeaderMenuButton: true,
            suppressMovable: true,
            editable: (params) => inMonth && isCellEditable(params.data, iso),
            cellStyle: (params) => {
              if (!inMonth) return { background: "#f5f5f5", color: "#ccc" };
              const row = params.data;
              if (isOutOfAssignmentRange(row, iso)) return { background: "#f0f0f0", color: "#bbb" };
              const tint = STATUS_CELL_TINT[row.dayStatus?.[iso]];
              if (tint) return { ...tint, fontWeight: 600 };
              if (isWeekend) return { background: "#fafafa" };
              return null;
            },
          })),
          {
            headerName: "",
            colId: `weekActions_${week.days[0].iso}`,
            width: 56,
            minWidth: 56,
            maxWidth: 56,
            sortable: false,
            filter: false,
            suppressHeaderMenuButton: true,
            suppressMovable: true,
            editable: false,
            cellRenderer: RangeActionsCell,
            cellRendererParams: {
              rangeDates: week.days,
              scopeLabel: "Week",
              onSave: handleRangeSave,
              onSubmit: handleRangeSubmit,
              onApprove: handleRangeApprove,
              onReject: handleRangeReject,
              onReopen: handleRangeReopen,
            },
          },
        ],
      })),
      {
        headerName: "Total",
        field: "total",
        pinned: "right",
        minWidth: 90,
        editable: false,
        valueGetter: (params) =>
          monthDates.reduce((sum, { iso }) => sum + (Number(params.data?.[iso]) || 0), 0),
        cellStyle: { fontWeight: "bold" },
      },
    ];
    return cols;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calendarWeeks, monthDates]);

  return (
    <div style={{ padding: 16, height: "100%", display: "flex", flexDirection: "column" }}>
      <Card style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Button icon={<ReloadOutlined />} onClick={handleResetView}>
            Refresh
          </Button>
          <Popover content={timesheetAlertContent} title="Timesheet Alerts" trigger="click" placement="bottomRight">
            <Badge count={timesheetAlerts.length} size="small">
              <Button icon={<BellOutlined />} />
            </Badge>
          </Popover>
          <Select
            showSearch
            allowClear
            style={{ width: 220 }}
            placeholder="All employees"
            value={selectedEmployeeId}
            onChange={setSelectedEmployeeId}
            options={employeeOptions}
            optionFilterProp="label"
          />
          <DatePicker
            picker="month"
            value={selectedMonth}
            allowClear
            placeholder="Pick a month"
            disabledDate={isMonthDisabled}
            onChange={(value) => setSelectedMonth(value)}
          />
          {selectedMonth && (
            <Button type="primary" icon={<SaveOutlined />} onClick={handleSaveAll} loading={saving}>
              Save All
            </Button>
          )}
          {!selectedMonth && selectedEmployeeId && (
            <Button type="primary" icon={<SaveOutlined />} onClick={handleSummarySaveAll} loading={summarySaving}>
              Save All
            </Button>
          )}
          <div style={{ fontSize: 12, color: "#888" }}>
            {selectedMonth ? (
              <>
                Type a number in Hours and tab out to fill weekdays with 8h each — weekends stay blank for you to
                enter manually. Each week and the "Monthly Actions" column both have their own menu (⋯) for
                Save/Submit/Approve/Reject/Reopen, scoped to that week or the whole month. Saved days are
                color-coded: <span style={{ color: "#d48806", fontWeight: 600 }}>Submitted</span>,{" "}
                <span style={{ color: "#389e0d", fontWeight: 600 }}>Approved</span>,{" "}
                <span style={{ color: "#cf1322", fontWeight: 600 }}>Rejected</span>.
              </>
            ) : selectedEmployeeId ? (
              "One row per month across this employee's project(s) active period — days here are keyed by day-of-month, not a real shared calendar, since each row is a different month."
            ) : (
              "Pick a month to see everyone's hours, or an employee to see their month-by-month history."
            )}
          </div>
        </div>
      </Card>

      {selectedMonth ? (
        <div className="ag-theme-alpine" style={{ flex: 1, minHeight: 0 }}>
          <AgGridReact
            getContextMenuItems={getCellCopyContextMenuItems}
            enableCellTextSelection={true}
            ensureDomOrder={true}
            ref={gridRef}
            rowData={rowData}
            columnDefs={columnDefs}
            onCellValueChanged={onCellValueChanged}
            singleClickEdit
            stopEditingWhenCellsLoseFocus
            loading={loading}
            defaultColDef={{ resizable: true, sortable: true }}
            domLayout="normal"
            suppressHorizontalScroll={false}
            popupParent={document.body}
          />
        </div>
      ) : selectedEmployeeId ? (
        <div className="ag-theme-alpine" style={{ flex: 1, minHeight: 0 }}>
          <AgGridReact
            getContextMenuItems={getCellCopyContextMenuItems}
            enableCellTextSelection={true}
            ensureDomOrder={true}
            rowData={summaryRows}
            columnDefs={summaryColumnDefs}
            onCellValueChanged={onSummaryCellValueChanged}
            singleClickEdit
            stopEditingWhenCellsLoseFocus
            loading={summaryLoading}
            defaultColDef={{ resizable: true, sortable: true }}
            domLayout="normal"
            popupParent={document.body}
          />
        </div>
      ) : (
        <Card>
          <div style={{ textAlign: "center", color: "#888", padding: 32 }}>
            Pick a month or an employee above to get started.
          </div>
        </Card>
      )}
    </div>
  );
};

export default MonthlyTimesheets;
