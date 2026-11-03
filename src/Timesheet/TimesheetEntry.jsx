import React, { useState, useEffect, useMemo, useRef, useContext } from "react";
import { Card, Select, DatePicker, InputNumber, Button, Table, Tag, message, Row, Col } from "antd";
import {
  SaveOutlined,
  SendOutlined,
  CheckCircleOutlined,
  UnlockOutlined,
  PlusOutlined,
  ArrowLeftOutlined,
} from "@ant-design/icons";
import axios from "axios";
import dayjs from "dayjs";
import { useLocation, useNavigate } from "react-router-dom";
import API_ENDPOINTS from "../config";
import AuthContext from "../Authentication/Context/AuthContext";
import { ROLES } from "../Utils/roleAccess";

const { Option } = Select;

// Builds every day of the given year/month (1-based month) as a local date —
// deliberately not `new Date(isoString)`, which parses as UTC midnight and
// renders as the previous day in any timezone behind UTC (the same bug the
// rest of this app has already had to fix for Payroll/Passport dates).
const buildMonthDays = (year, month) => {
  const daysInMonth = new Date(year, month, 0).getDate();
  const days = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month - 1, d);
    const dow = date.getDay(); // 0 = Sun ... 6 = Sat
    days.push({
      date: `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
      label: date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
      isWeekend: dow === 0 || dow === 6,
      hours: 0,
      timesheetId: null,
      status: null,
    });
  }
  return days;
};

const STATUS_COLOR = { Draft: "default", Submitted: "gold", Approved: "green" };

// The assignment's stored `status` column is only recomputed when the
// assignment itself is next saved/edited — one whose endDate has since
// passed would otherwise keep showing as "Active" indefinitely. Compute it
// live from the actual dates instead for display.
const liveAssignmentStatus = (assignment) => {
  const today = dayjs().format("YYYY-MM-DD");
  if (assignment.endDate && assignment.endDate < today) return "Inactive";
  if (assignment.startDate && assignment.startDate > today) return "Upcoming";
  return "Active";
};

const pad = (n) => String(n).padStart(2, "0");
const toIsoDate = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

// Groups the month's days into Monday-Sunday week rows for a calendar-style
// grid. Weeks overlapping the month boundary are padded with out-of-month
// cells (blank/disabled) so every row always has exactly 7 columns aligned
// to the same weekday. Built entirely from local Date math (never
// `new Date(isoString)`) for the same UTC-parse reason as buildMonthDays.
const buildWeeks = (year, month, dayMap) => {
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstOfMonth = new Date(year, month - 1, 1);
  const lastOfMonth = new Date(year, month - 1, daysInMonth);

  const firstMondayOffset = (firstOfMonth.getDay() + 6) % 7; // Mon=0 ... Sun=6
  const gridStart = new Date(year, month - 1, 1 - firstMondayOffset);

  const lastMondayOffset = (lastOfMonth.getDay() + 6) % 7;
  const gridEnd = new Date(year, month - 1, daysInMonth + (6 - lastMondayOffset));

  const weeks = [];
  let weekStart = new Date(gridStart);
  while (weekStart <= gridEnd) {
    const weekDays = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      const iso = toIsoDate(d);
      const inMonth = d.getMonth() === month - 1 && d.getFullYear() === year;
      const entry = dayMap[iso];
      weekDays.push({
        date: iso,
        dayNum: d.getDate(),
        inMonth,
        hours: entry ? entry.hours : 0,
        status: entry ? entry.status : null,
      });
    }
    weeks.push({
      key: toIsoDate(weekStart),
      weekStartLabel: weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      days: weekDays,
    });
    weekStart = new Date(weekStart);
    weekStart.setDate(weekStart.getDate() + 7);
  }
  return weeks;
};

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const TimesheetEntry = () => {
  // Arrives here from Generate Invoice's "Timesheet" link (and similar) with
  // { employeeId, projectId or assignmentId, yearMonth } in route state, to
  // land directly on that employee/project/month instead of the blank
  // picker state.
  const location = useLocation();
  const navigate = useNavigate();
  const preselectionApplied = useRef(false);
  // Approve/Reopen are ADMIN-only server-side (TimeSheetController) —
  // mirrored here so the buttons aren't shown as clickable only to 403.
  const { user } = useContext(AuthContext);
  const isAdmin = user?.role === ROLES.ADMIN;

  const [employees, setEmployees] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(() => location.state?.employeeId ?? null);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(() =>
    location.state?.yearMonth ? dayjs(`${location.state.yearMonth}-01`) : dayjs(),
  );
  const [days, setDays] = useState([]);
  const [totalHoursInput, setTotalHoursInput] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    axios
      .get(API_ENDPOINTS.getAllEmployees)
      .then((response) => {
        // Referral-company employees aren't tracked through Timesheets.
        const eligible = (response.data || []).filter(
          (emp) => (emp.companyName || "").trim().toLowerCase() !== "referral",
        );
        setEmployees(eligible);
      })
      .catch((error) => console.error("Error fetching employees:", error));
  }, []);

  useEffect(() => {
    setSelectedAssignmentId(null);
    setAssignments([]);
    setDays([]);
    if (!selectedEmployeeId) return;
    axios
      .get(API_ENDPOINTS.assignmentsForEmployee(selectedEmployeeId))
      .then((response) => {
        const data = response.data || [];
        setAssignments(data);
        // Apply the incoming project/assignment pre-selection once, right
        // after the matching employee's assignments load — not on every
        // later employee switch the user makes manually.
        if (!preselectionApplied.current && (location.state?.assignmentId || location.state?.projectId)) {
          preselectionApplied.current = true;
          const match = location.state.assignmentId
            ? data.find((a) => a.assignmentId === location.state.assignmentId)
            : data.find((a) => a.projectId === location.state.projectId);
          if (match) setSelectedAssignmentId(match.assignmentId);
        } else if (data.length > 0) {
          // No pre-selection came in via route state — default to the
          // employee's most recent project (latest start date) instead of
          // leaving the picker empty.
          const latest = [...data].sort((a, b) => (b.startDate || "").localeCompare(a.startDate || ""))[0];
          setSelectedAssignmentId(latest.assignmentId);
        }
      })
      .catch((error) => console.error("Error fetching assignments:", error));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEmployeeId]);

  useEffect(() => {
    if (!selectedAssignmentId || !selectedMonth) {
      setDays([]);
      return;
    }
    fetchMonth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAssignmentId, selectedMonth]);

  const fetchMonth = () => {
    const year = selectedMonth.year();
    const month = selectedMonth.month() + 1;
    const yearMonth = `${year}-${String(month).padStart(2, "0")}`;
    setLoading(true);
    axios
      .get(API_ENDPOINTS.getTimesheetByAssignmentAndMonth(selectedAssignmentId, yearMonth))
      .then((response) => {
        const entries = response.data || [];
        const entryByDate = {};
        entries.forEach((e) => (entryByDate[e.workDate] = e));
        const monthDays = buildMonthDays(year, month).map((day) => {
          const entry = entryByDate[day.date];
          return entry
            ? { ...day, hours: entry.hours || 0, timesheetId: entry.timesheetId, status: entry.status }
            : day;
        });
        setDays(monthDays);
      })
      .catch((error) => console.error("Error fetching timesheet month:", error))
      .finally(() => setLoading(false));
  };

  // Most-restrictive status across the month: any Approved locks the whole
  // month; otherwise any Submitted marks it submitted; otherwise Draft.
  const monthStatus = useMemo(() => {
    if (days.some((d) => d.status === "Approved")) return "Approved";
    if (days.some((d) => d.status === "Submitted")) return "Submitted";
    return "Draft";
  }, [days]);

  const isLocked = monthStatus === "Approved";

  const selectedAssignment = useMemo(
    () => assignments.find((a) => a.assignmentId === selectedAssignmentId),
    [assignments, selectedAssignmentId],
  );

  // Dates are plain "yyyy-MM-dd" strings, which sort lexicographically the
  // same as chronologically, so a straight string comparison is enough —
  // no need to parse into Date objects for this check.
  const isDateInRange = (date) => {
    if (!selectedAssignment) return true;
    if (selectedAssignment.startDate && date < selectedAssignment.startDate) return false;
    if (selectedAssignment.endDate && date > selectedAssignment.endDate) return false;
    return true;
  };

  // The month picker should only offer months from the project's start date
  // up through its end date or the current month, whichever is earlier —
  // no picking a month before the project began, after it ended, or in the
  // future.
  const monthBounds = useMemo(() => {
    if (!selectedAssignment) return { minMonth: null, maxMonth: null };
    const minMonth = selectedAssignment.startDate
      ? dayjs(selectedAssignment.startDate).startOf("month")
      : null;
    const endMonth = selectedAssignment.endDate
      ? dayjs(selectedAssignment.endDate).startOf("month")
      : null;
    const currentMonth = dayjs().startOf("month");
    const maxMonth = endMonth && endMonth.isBefore(currentMonth) ? endMonth : currentMonth;
    return { minMonth, maxMonth };
  }, [selectedAssignment]);

  const isMonthDisabled = (current) => {
    const { minMonth, maxMonth } = monthBounds;
    if (!current) return false;
    if (minMonth && current.isBefore(minMonth, "month")) return true;
    if (maxMonth && current.isAfter(maxMonth, "month")) return true;
    return false;
  };

  // Snap the selected month back into range whenever it switches to an
  // assignment whose valid window doesn't include the month currently shown.
  useEffect(() => {
    if (!selectedAssignment) return;
    const { minMonth, maxMonth } = monthBounds;
    if (minMonth && selectedMonth.isBefore(minMonth, "month")) {
      setSelectedMonth((maxMonth || minMonth).clone());
    } else if (maxMonth && selectedMonth.isAfter(maxMonth, "month")) {
      setSelectedMonth(maxMonth.clone());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAssignment, monthBounds]);

  const weekdayCount = useMemo(
    () => days.filter((d) => !d.isWeekend && isDateInRange(d.date)).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [days, selectedAssignment],
  );
  const standardHours = weekdayCount * 8;
  const currentTotal = useMemo(() => days.reduce((sum, d) => sum + (Number(d.hours) || 0), 0), [days]);

  const handleDistribute = () => {
    setDays((prev) => prev.map((d) => (d.isWeekend || !isDateInRange(d.date) ? d : { ...d, hours: 8 })));
  };

  const handleHourChange = (date, value) => {
    setDays((prev) => prev.map((d) => (d.date === date ? { ...d, hours: value ?? 0 } : d)));
  };

  const assignmentId = selectedAssignmentId;
  const yearMonth = selectedMonth ? `${selectedMonth.year()}-${String(selectedMonth.month() + 1).padStart(2, "0")}` : null;

  const handleSave = () => {
    const entries = days
      .filter((d) => (Number(d.hours) || 0) > 0 || d.timesheetId)
      .map((d) => ({
        employeeId: selectedEmployeeId,
        assignmentId,
        projectId: assignments.find((a) => a.assignmentId === assignmentId)?.projectId,
        workDate: d.date,
        hours: Number(d.hours) || 0,
      }));

    if (entries.length === 0) {
      message.info("Nothing to save yet.");
      return;
    }

    setSaving(true);
    axios
      .post(API_ENDPOINTS.saveTimesheetBulk, entries)
      .then((response) => {
        const { saved, lockedDates, outOfRangeDates } = response.data || {};
        message.success(`Saved ${saved ?? 0} day(s).`);
        if (lockedDates && lockedDates.length > 0) {
          message.warning(`${lockedDates.length} day(s) are Approved and locked — reopen the month to edit them.`);
        }
        if (outOfRangeDates && outOfRangeDates.length > 0) {
          message.warning(`${outOfRangeDates.length} day(s) are outside the project's active dates and were not saved.`);
        }
        fetchMonth();
      })
      .catch((error) => {
        console.error("Error saving timesheet:", error);
        message.error("Save failed: " + (error.response?.data?.message || error.message));
      })
      .finally(() => setSaving(false));
  };

  const handleSubmit = () => {
    axios
      .post(API_ENDPOINTS.submitTimesheetMonth(assignmentId, yearMonth))
      .then(() => {
        message.success("Submitted for approval.");
        fetchMonth();
      })
      .catch((error) => message.error("Submit failed: " + (error.response?.data?.message || error.message)));
  };

  const handleApprove = () => {
    axios
      .post(API_ENDPOINTS.approveTimesheetMonth(assignmentId, yearMonth))
      .then(() => {
        message.success("Month approved.");
        fetchMonth();
      })
      .catch((error) => message.error("Approve failed: " + (error.response?.data?.message || error.message)));
  };

  const handleReopen = () => {
    axios
      .post(API_ENDPOINTS.reopenTimesheetMonth(assignmentId, yearMonth))
      .then(() => {
        message.success("Month reopened for editing.");
        fetchMonth();
      })
      .catch((error) => message.error("Reopen failed: " + (error.response?.data?.message || error.message)));
  };

  // Mirrors InvoiceDetails.jsx's employeeId-scoped generateInvoice(): same
  // "anything left to generate" pre-check, same endpoint, same destination
  // (GenerateInvoiceDetails via /generateInvoice), so hours auto-populate
  // from timesheets exactly as they do from the Employee Full Details
  // Invoices tab.
  const handleGenerateInvoice = () => {
    if (!selectedEmployeeId) return;
    axios
      .get(API_ENDPOINTS.activeProjectsForInvoiceByEmployee(selectedEmployeeId))
      .then((response) => {
        const rows = response.data || [];
        const remaining = rows.filter((row) => !row.invoiceId);
        if (rows.length > 0 && remaining.length === 0) {
          message.success(`Invoices for ${rows[0].employeeName || "this employee"} is up to date`);
          return;
        }
        navigate("/generateInvoice", {
          state: { url: API_ENDPOINTS.activeProjectsForInvoiceByEmployee(selectedEmployeeId) },
        });
      })
      .catch((error) => {
        console.error("Error checking invoice status:", error);
        navigate("/generateInvoice", {
          state: { url: API_ENDPOINTS.activeProjectsForInvoiceByEmployee(selectedEmployeeId) },
        });
      });
  };

  const diff = totalHoursInput != null ? Number(totalHoursInput) - standardHours : null;

  const dayMap = useMemo(() => {
    const map = {};
    days.forEach((d) => (map[d.date] = d));
    return map;
  }, [days]);

  const weeks = useMemo(() => {
    if (!selectedMonth) return [];
    return buildWeeks(selectedMonth.year(), selectedMonth.month() + 1, dayMap);
  }, [selectedMonth, dayMap]);

  const renderDayCell = (day) => {
    if (!day.inMonth) {
      return <div style={{ textAlign: "center", color: "#ccc" }}>—</div>;
    }
    const outOfRange = !isDateInRange(day.date);
    return (
      <div style={{ textAlign: "center" }} title={outOfRange ? "Outside the project's active dates" : undefined}>
        <div style={{ fontSize: 11, color: outOfRange ? "#ccc" : "#888" }}>{day.dayNum}</div>
        <InputNumber
          size="small"
          min={0}
          max={24}
          step={0.5}
          value={day.hours}
          disabled={isLocked || outOfRange}
          onChange={(value) => handleHourChange(day.date, value)}
          style={{ width: "100%" }}
        />
      </div>
    );
  };

  const columns = [
    { title: "Week Of", dataIndex: "weekStartLabel", key: "weekStartLabel", width: 110, fixed: "left" },
    ...DAY_NAMES.map((name, i) => ({
      title: name,
      key: name,
      width: 90,
      onHeaderCell: () => (i >= 5 ? { style: { background: "#fafafa" } } : {}),
      onCell: () => (i >= 5 ? { style: { background: "#fafafa" } } : {}),
      render: (_, row) => renderDayCell(row.days[i]),
    })),
    {
      title: "Week Total",
      key: "weekTotal",
      width: 100,
      render: (_, row) => {
        const total = row.days.reduce((sum, d) => sum + (d.inMonth ? Number(d.hours) || 0 : 0), 0);
        return <strong>{total}</strong>;
      },
    },
  ];

  return (
    <div style={{ padding: 16 }}>
      <Button icon={<ArrowLeftOutlined />} style={{ marginBottom: 16 }} onClick={() => navigate("/timesheets")}>
        Back to Timesheets
      </Button>

      <Card
        style={{ marginBottom: 16 }}
        extra={
          <Button type="primary" disabled={!selectedEmployeeId} onClick={handleGenerateInvoice}>
            <PlusOutlined /> Generate Invoice
          </Button>
        }
      >
        <Row gutter={16} align="middle">
          <Col span={6}>
            <div style={{ marginBottom: 4 }}>Employee</div>
            <Select
              showSearch
              style={{ width: "100%" }}
              placeholder="Select employee"
              value={selectedEmployeeId}
              onChange={setSelectedEmployeeId}
              optionFilterProp="children"
              filterOption={(input, option) =>
                (option.children || "").toLowerCase().includes(input.toLowerCase())
              }
            >
              {employees.map((emp) => (
                <Option key={emp.employeeId} value={emp.employeeId}>
                  {`${emp.firstName} ${emp.lastName}`}
                </Option>
              ))}
            </Select>
          </Col>
          <Col span={8}>
            <div style={{ marginBottom: 4 }}>Project</div>
            <Select
              style={{ width: "100%" }}
              placeholder="Select project"
              value={selectedAssignmentId}
              onChange={setSelectedAssignmentId}
              disabled={!selectedEmployeeId}
            >
              {assignments.map((a) => (
                <Option key={a.assignmentId} value={a.assignmentId}>
                  {a.projectName} ({liveAssignmentStatus(a)})
                </Option>
              ))}
            </Select>
            {selectedAssignment && (
              <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>
                Active {selectedAssignment.startDate} to {selectedAssignment.endDate} — days outside this range are locked.
              </div>
            )}
          </Col>
          <Col span={5}>
            <div style={{ marginBottom: 4 }}>Month</div>
            <DatePicker
              picker="month"
              style={{ width: "100%" }}
              value={selectedMonth}
              allowClear={false}
              disabledDate={isMonthDisabled}
              onChange={(value) => setSelectedMonth(value || dayjs())}
            />
          </Col>
          <Col span={5}>
            <div style={{ marginBottom: 4 }}>Status</div>
            <Tag color={STATUS_COLOR[monthStatus]} style={{ fontSize: 13, padding: "4px 10px" }}>
              {monthStatus}
            </Tag>
          </Col>
        </Row>
      </Card>

      {selectedAssignmentId && (
        <>
          <Card style={{ marginBottom: 16 }}>
            <Row gutter={16} align="middle">
              <Col span={6}>
                <div style={{ marginBottom: 4 }}>Total Hours for Month</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <InputNumber
                    style={{ width: 100 }}
                    min={0}
                    placeholder="Target"
                    value={totalHoursInput}
                    onChange={setTotalHoursInput}
                  />
                  <span style={{ fontSize: 18, color: "#888" }}>/</span>
                  <span style={{ fontSize: 18, fontWeight: "bold" }}>{currentTotal}</span>
                </div>
                <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>
                  Target you enter / total currently entered across days.
                </div>
              </Col>
              <Col span={4}>
                <Button style={{ marginTop: 20 }} onClick={handleDistribute} disabled={isLocked}>
                  Fill 8h / weekday
                </Button>
              </Col>
              <Col span={14}>
                <div style={{ marginTop: 20, lineHeight: 1.6 }}>
                  <div>
                    {weekdayCount} weekdays this month × 8h = <strong>{standardHours}</strong> standard hours.
                  </div>
                  {diff != null && diff !== 0 && (
                    <div style={{ color: diff > 0 ? "#d46b08" : "#cf1322" }}>
                      Your target ({totalHoursInput}h) is {Math.abs(diff)}h {diff > 0 ? "more" : "less"} than
                      the 8h/weekday standard — adjust individual days below to match it.
                    </div>
                  )}
                </div>
              </Col>
            </Row>
          </Card>

          <Card
            title="Daily Hours"
            extra={
              <div style={{ display: "flex", gap: 8 }}>
                <Button icon={<SaveOutlined />} type="primary" onClick={handleSave} loading={saving} disabled={isLocked}>
                  Save
                </Button>
                <Button icon={<SendOutlined />} onClick={handleSubmit} disabled={monthStatus !== "Draft"}>
                  Submit
                </Button>
                {isAdmin && (
                  <Button icon={<CheckCircleOutlined />} onClick={handleApprove} disabled={monthStatus !== "Submitted"}>
                    Approve
                  </Button>
                )}
                {isAdmin && (
                  <Button icon={<UnlockOutlined />} onClick={handleReopen} disabled={monthStatus === "Draft"}>
                    Reopen
                  </Button>
                )}
              </div>
            }
          >
            <Table
              rowKey="key"
              dataSource={weeks}
              columns={columns}
              loading={loading}
              pagination={false}
              size="small"
              scroll={{ x: true }}
            />
          </Card>
        </>
      )}
    </div>
  );
};

export default TimesheetEntry;
