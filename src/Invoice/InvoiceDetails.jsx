import React, { useContext, useState, useEffect, useRef, useMemo } from "react";
import API_ENDPOINTS from "../config";
import { sizeColumnsForHeader } from "../Utils/agGridColumnSizing";
import { AgGridReact } from "@ag-grid-community/react";
import { Button, Card, Drawer, message, Popover, Badge, List, Empty, Modal, DatePicker as AntDatePicker } from "antd";
import dayjs from "dayjs";

import { PlusOutlined, ReloadOutlined, FileExcelOutlined, SaveOutlined, CloseOutlined, BellOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "ag-grid-enterprise";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import "./Invoice.css";
import NewInvoice from "./NewInvoice";
import GenerateInvoiceDetails from "./GenerateInvoiceDetails";
import MonthlyTimesheetDialog from "../Project/TimeSheet/MonthlyTimeSheetModal";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { formatCurrency } from "../Utils/CurrencyFormatter";
import NotesActionButton from "../Notes/NotesActionButton";
import NotesModal from "../Notes/NotesModal";
import { buildRowActions } from "../Notes/rowActions";
import { formatMonthYear, formatDate, formatDateMDY } from "../Utils/dateFormat";
import GridToolbar from "../Utils/GridToolbar";
import ChartOverviewPanel from "../Utils/ChartOverviewPanel";
import { GLOBAL_CHARTS } from "../Charts/globalChartRegistry";
import AuthContext from "../Authentication/Context/AuthContext";
import { canAccessEntity } from "../Utils/roleAccess";
import { useFilteredTotalsRow } from "../Utils/useFilteredTotalsRow";

// employeeId/projectId/customerId are optional — when provided (e.g.
// embedded in the Employee Full Details "INVOICES" tab, the Project Full
// Details "Invoices" tab, or the Customer Full Details "INVOICES" tab), the
// grid scopes down to just that employee's/project's/customer's invoices,
// with every other feature (search, edit, Save/Cancel, Export to Excel, Add
// New Invoice, Generate Invoice, totals) unchanged. statusFilter is
// likewise optional — when provided (e.g. embedded in a status tab on the
// Dashboard), only invoices with that exact status are shown.
const InvoiceDetails = ({ employeeId, projectId, customerId, statusFilter, isCollapsed, gridHeight, onRefresh } = {}) => {
  const { user } = useContext(AuthContext);
  const gridRef = useRef(null);
  const [searchText, setSearchText] = useState("");
  const [selectedDate, setSelectedDate] = useState(null);
  const [rowData, setRowData] = useState();
  const [projects, setProjectsData] = useState([]);
  const [referralEmployeeIds, setReferralEmployeeIds] = useState(new Set());
  const navigate = useNavigate();
  const [pinnedBottomRowData, setPinnedBottomRowData] = useState([]);
  const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(false);

  //  const columnsList = ['Customer Id', 'Company Name', 'Email Id', 'Phone', 'Status', 'ein', 'Website','startDate','endDate' ];
  const isInitialRender = useRef(true);

  useEffect(() => {
    if (isInitialRender.current) {
        fetchData();
    } else {
      isInitialRender.current = false;
    }
  }, []);

  // Projects carry their own employeeName/projectName/customerName — used to
  // look up those display columns for each invoice by its projectId. When
  // scoped to one customer, fetch just that customer's own projects instead
  // of every project in the tenant.
  useEffect(() => {
    const url = customerId ? API_ENDPOINTS.getProjectsByCustomer(customerId) : API_ENDPOINTS.getProjects;
    fetch(url)
      .then((response) => response.json())
      .then((data) => setProjectsData(data || []))
      .catch((error) => console.error("Error fetching projects:", error));
  }, [customerId]);

  // Referral-company employees aren't run through invoicing — exclude them
  // from the page-level invoice alert below.
  useEffect(() => {
    axios
      .get(API_ENDPOINTS.getAllEmployees)
      .then((response) => {
        const ids = (response.data || [])
          .filter((emp) => (emp.companyName || "").trim().toLowerCase() === "referral")
          .map((emp) => emp.employeeId);
        setReferralEmployeeIds(new Set(ids));
      })
      .catch((error) => console.error("Error fetching employees:", error));
  }, []);

  const projectsById = useMemo(
    () => Object.fromEntries(projects.map((project) => [project.projectId, project])),
    [projects],
  );

  // Every employee with a project (active OR inactive), excluding
  // Referral-company employees — an inactive project can still have
  // un-invoiced periods sitting in its backlog (e.g. it ended before ever
  // getting fully invoiced), so it's not skipped here. Generate Invoice
  // (bulk path) and the page-level alert below both walk this list via
  // activeProjectsForInvoiceByEmployee, since that's the only endpoint that
  // surfaces a project's *entire* un-invoiced backlog (activeProjects only
  // returns the current calendar month's row per project).
  const employeeIdsForInvoicing = useMemo(
    () =>
      Array.from(
        new Set(
          projects
            .map((p) => p.employeeId)
            .filter(Boolean)
            .filter((empId) => !referralEmployeeIds.has(empId)),
        ),
      ),
    [projects, referralEmployeeIds],
  );

  // Page-level alert (only when not scoped to a single employee/project):
  // for every employee with a project, reuse the exact same per-employee
  // "active projects for invoice" endpoint Generate Invoice itself relies
  // on, and flag any (employee, project) pair with periods that still
  // don't have an invoice — i.e. invoicing has fallen behind that
  // project's own invoice-term cadence, whether or not the project is
  // still active today.
  const [invoiceAlerts, setInvoiceAlerts] = useState([]);

  useEffect(() => {
    if (employeeId || projectId || customerId) return;
    if (employeeIdsForInvoicing.length === 0) {
      setInvoiceAlerts([]);
      return;
    }

    Promise.all(
      employeeIdsForInvoicing.map((empId) =>
        axios
          .get(API_ENDPOINTS.activeProjectsForInvoiceByEmployee(empId))
          .then((response) => response.data || [])
          .catch((error) => {
            console.error("Error checking invoice status for employee " + empId, error);
            return [];
          }),
      ),
    ).then((results) => {
      const today = new Date().toISOString().split("T")[0];
      const missingByProject = {};
      results.flat().forEach((row) => {
        if (row.invoiceId) return; // already invoiced
        if (row.endDate && row.endDate > today) return; // period hasn't ended yet — nothing to invoice for it
        const key = `${row.employeeId}_${row.projectId}`;
        if (!missingByProject[key]) {
          missingByProject[key] = {
            employeeId: row.employeeId,
            employeeName: row.employeeName,
            projectName: row.projectName,
            periods: [],
          };
        }
        missingByProject[key].periods.push({ startDate: row.startDate, endDate: row.endDate });
      });
      Object.values(missingByProject).forEach((entry) => entry.periods.sort((a, b) => a.startDate.localeCompare(b.startDate)));
      setInvoiceAlerts(Object.values(missingByProject));
    });
  }, [employeeIdsForInvoicing, employeeId, projectId, customerId]);

  const invoiceAlertContent = (
    <div style={{ maxHeight: 320, overflowY: "auto", minWidth: 320 }}>
      {invoiceAlerts.length === 0 ? (
        <Empty description="No alerts" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <List
          size="small"
          dataSource={invoiceAlerts}
          renderItem={(item) => (
            <List.Item key={`${item.employeeId}-${item.projectName}`}>
              <List.Item.Meta
                title={`${item.employeeName} — ${item.projectName}`}
                description={
                  <>
                    <div>
                      {item.periods.length} invoice period{item.periods.length === 1 ? "" : "s"} not yet generated:
                    </div>
                    <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
                      {item.periods.map((period) => (
                        <li key={`${period.startDate}-${period.endDate}`}>
                          {formatDate(period.startDate)} – {formatDate(period.endDate)}
                        </li>
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

  // Merge in each invoice's project-derived display fields as real
  // properties (not just AG Grid valueGetters) so the search box — which
  // searches Object.values(row) — can actually match against them too.
  const enrichedRowData = useMemo(() => {
    if (!rowData) return rowData;
    const enriched = rowData.map((row) => {
      const project = projectsById[row.projectId];
      return {
        ...row,
        employeeName: project?.employeeName || "",
        projectName: project?.projectName || "",
        customerName: project?.customerName || "",
      };
    });
    let scoped = enriched;
    if (projectId) {
      // Invoices carry projectId directly, so this scoping is exact.
      scoped = scoped.filter((row) => Number(row.projectId) === Number(projectId));
    }
    if (employeeId) {
      // Invoices only carry a projectId, so resolve each invoice's project
      // to find its employeeId. Compared as Numbers since the
      // caller-supplied employeeId and the project's own employeeId aren't
      // guaranteed to be the same type.
      scoped = scoped.filter(
        (row) => Number(projectsById[row.projectId]?.employeeId) === Number(employeeId),
      );
    }
    if (statusFilter) {
      scoped = scoped.filter(
        (row) => (row.status || "").toLowerCase() === statusFilter.toLowerCase(),
      );
    }
    return scoped;
  }, [rowData, projectsById, employeeId, projectId, statusFilter]);

  // Flags any month (across the full history, not just the chart's last-12
  // window) where the invoiced total and paid total don't match — i.e.
  // that month still has outstanding/partially-paid invoices.
  const monthlyPaymentAlerts = useMemo(() => {
    if (!enrichedRowData || enrichedRowData.length === 0) return [];
    const byMonth = {};
    enrichedRowData.forEach((inv) => {
      if (!inv.invoiceMonth) return;
      const key = inv.invoiceMonth.substring(0, 7);
      if (!byMonth[key]) byMonth[key] = { invoiced: 0, paid: 0 };
      byMonth[key].invoiced += inv.total || 0;
      byMonth[key].paid += inv.invoicePaidAmount || 0;
    });
    return Object.keys(byMonth)
      .filter((key) => Math.round(byMonth[key].invoiced) !== Math.round(byMonth[key].paid))
      .sort()
      .map((key) => ({
        month: formatMonthYear(key),
        invoiced: byMonth[key].invoiced,
        paid: byMonth[key].paid,
        outstanding: byMonth[key].invoiced - byMonth[key].paid,
      }));
  }, [enrichedRowData]);

  const monthlyPaymentAlertContent = (
    <div style={{ maxHeight: 320, overflowY: "auto", minWidth: 320 }}>
      {monthlyPaymentAlerts.length === 0 ? (
        <Empty description="No alerts" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <List
          size="small"
          dataSource={monthlyPaymentAlerts}
          renderItem={(item) => (
            <List.Item key={item.month}>
              <List.Item.Meta
                title={item.month}
                description={`Invoiced ${formatCurrency(item.invoiced)} vs Paid ${formatCurrency(item.paid)} — outstanding ${formatCurrency(item.outstanding)}`}
              />
            </List.Item>
          )}
        />
      )}
    </div>
  );

  const INVOICE_CHART_KEYS = ["invoicesByMonth", "totalInvoicedByCustomer", "invoiceCountByMonth", "invoicesByCustomer"];
  const visibleInvoiceOverviewCharts = GLOBAL_CHARTS.filter(
    (c) => INVOICE_CHART_KEYS.includes(c.key) && canAccessEntity(user?.role, "invoice"),
  );

  const fetchData = () => {
    //default status =viewAll
    setRowData([]);
    // Scoped to one customer's own invoices server-side instead of fetching
    // every invoice in the tenant — same idea as the employeeId/projectId
    // client-side filters below, just done in the DB for this one since a
    // customer-scoped endpoint already exists (see InvoiceController).
    const request = customerId
      ? axios.get(API_ENDPOINTS.getInvoicesForCustomer(customerId))
      : axios.get(API_ENDPOINTS.getAllInvoices, { params: {} });
    request
      .then((response) => {
        setRowData(getFlattenedData(response.data));
      })
      .catch((error) => {
        console.error(error);
      });
  };

  // Double-click any editable cell (Invoice Id / Invoice Month / Hours) to
  // edit in place — this is AG Grid's built-in editing interaction, no extra
  // wiring needed once a column is marked `editable`. Pending edits are
  // tracked here so the Save/Cancel buttons only appear once something has
  // actually changed.
  const [modifiedRows, setModifiedRows] = useState({});
  // Set when a row's status is changed to "Paid" with no invoicePaidDate
  // already on it — blocks nothing by itself, but the modal it triggers
  // reverts the status edit unless the user actually picks a date.
  const [paidDatePrompt, setPaidDatePrompt] = useState(null); // { node, oldStatus }
  const [promptPaidDate, setPromptPaidDate] = useState(null);

  const onCellValueChanged = (params) => {
    const rowId = params.data?.id;
    if (rowId === undefined || rowId === null) return;

    if (params.column.colId === "hours") {
      const hours = Number(params.data.hours) || 0;
      const billing = Number(params.data.billing) || 0;
      params.data.total = hours * billing;
    }

    // Invoice PaidAmount tracks Invoice Amount minus Discounts — recomputed
    // whenever either changes so it's always what would actually be paid.
    if (params.column.colId === "hours" || params.column.colId === "discounts") {
      const total = Number(params.data.total) || 0;
      const discounts = Number(params.data.discounts) || 0;
      params.data.invoicePaidAmount = Math.max(total - discounts, 0);
      params.api.refreshCells({ rowNodes: [params.node], columns: ["total", "invoicePaidAmount"] });
    }

    // Marking an invoice Paid with no paid date set — prompt for one right
    // away instead of silently saving a Paid invoice with a blank date.
    if (params.column.colId === "status" && params.newValue === "Paid" && !params.data.invoicePaidDate) {
      setPromptPaidDate(dayjs());
      setPaidDatePrompt({ node: params.node, oldStatus: params.oldValue });
    }

    setModifiedRows((prev) => ({ ...prev, [rowId]: params.data }));
  };

  const confirmPaidDate = () => {
    if (!promptPaidDate || !paidDatePrompt) return;
    paidDatePrompt.node.setDataValue("invoicePaidDate", promptPaidDate.format("YYYY-MM-DD"));
    setPaidDatePrompt(null);
    setPromptPaidDate(null);
  };

  // Backing out without picking a date undoes the Paid transition — an
  // invoice shouldn't end up marked Paid with no paid date.
  const cancelPaidDatePrompt = () => {
    if (paidDatePrompt) {
      paidDatePrompt.node.setDataValue("status", paidDatePrompt.oldStatus);
    }
    setPaidDatePrompt(null);
    setPromptPaidDate(null);
  };

  const handleSaveChanges = () => {
    const rows = Object.values(modifiedRows);
    if (rows.length === 0) return;
    Promise.all(
      rows.map((row) => axios.put(API_ENDPOINTS.invoiceById(row.id), row)),
    )
      .then(() => {
        setModifiedRows({});
        fetchData();
        onRefresh?.();
      })
      .catch((error) => {
        console.error("Error saving invoice changes:", error);
      });
  };

  const [noteModalRow, setNoteModalRow] = useState(null);

  const handleArchiveInvoice = (row) => {
    axios
      .put(API_ENDPOINTS.invoiceById(row.id), { ...row, status: "Archived" })
      .then(() => {
        message.success("Invoice archived");
        fetchData();
        onRefresh?.();
      })
      .catch(() => message.error("Failed to archive invoice. Please try again."));
  };

  const handleDeleteInvoice = (row) => {
    Modal.confirm({
      title: `Delete invoice "${row.invoiceNumber || row.id}"?`,
      content: "This permanently removes this invoice record. This can't be undone.",
      okText: "Delete",
      okType: "danger",
      cancelText: "Cancel",
      onOk: () =>
        axios
          .delete(API_ENDPOINTS.invoiceById(row.id))
          .then(() => {
            message.success("Invoice deleted");
            fetchData();
            onRefresh?.();
          })
          .catch(() => message.error("Failed to delete invoice. It may still be referenced elsewhere (bills, etc.).")),
    });
  };

  const handleCancelChanges = () => {
    // Discard local edits by simply refetching clean data from the server.
    setModifiedRows({});
    fetchData();
  };

  const handleDateChange = (date) => {
    setSelectedDate(date);
    // //alert(date.toISOString().split('T')[0]);
    // const formttedDate = date.toISOString().split('T')[0]; //yyyy-mm-dd
    // fetchData(formttedDate);
  };

  const getFlattenedData = (data) => {
    let updatedData = data.map((dataObj) => {
      //return { ...dataObj, ...dataObj.employeeAddress[0], ...dataObj.employeeAssignments[0] }
      return { ...dataObj };
    });
    return updatedData || [];
  };

  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [isTimesheetOpen, setIsTimesheetOpen] = useState(false);

  const handleOpenTimesheet = (employee) => {
    setSelectedEmployee(employee);
    setIsTimesheetOpen(true);
  };

  const handleSaveTimesheet = (totalHours) => {
    setRowData((prevData) =>
      prevData.map((emp) =>
        emp.id === selectedEmployee.id ? { ...emp, hours: totalHours } : emp,
      ),
    );
    setIsTimesheetOpen(false);
  };

  const getColumnsDefList = (isSortable, isEditable, hasFilter) => {
    // Paid invoices are locked — nothing on the row is editable once paid.
    const editableUnlessPaid = (params) => params.data?.status !== "Paid";

    var columns = [
      {
        // invoiceNumber is a cosmetic, user-editable business label with
        // no identity meaning — the row's real identity (used for the
        // save PUT below) is the server-assigned `id`, which is never
        // shown as an editable cell so it can't be typo'd into colliding
        // with another invoice's number. Being purely cosmetic (unlike
        // Hours/Discounts/InvoiceMonth, which feed financial totals), it
        // stays editable even on an otherwise-locked Paid row — same
        // reasoning as Status/Invoice PaidDate below.
        headerName: "Invoice #",
        field: "invoiceNumber",
        sortable: isSortable,
        editable: true,
        valueFormatter: (params) => {
          // Check if this row is the pinned bottom row and show "Total"
          return params.node.rowPinned === "bottom" ? "Total" : params.value;
        },
      },
      { headerName: "Employee Name", field: "employeeName", sortable: isSortable, enableRowGroup: true },
      { headerName: "Customer Name", field: "customerName", sortable: isSortable, enableRowGroup: true },
      {
        headerName: "Year",
        field: "invoiceMonth",
        colId: "invoiceYear",
        sortable: isSortable,
        enableRowGroup: true,
        filter: "agSetColumnFilter",
        valueGetter: (params) =>
          params.data?.invoiceMonth ? params.data.invoiceMonth.substring(0, 4) : null,
        valueFormatter: (params) =>
          params.node.rowPinned === "bottom" ? "" : params.value,
      },
      {
        headerName: "InvoiceMonth",
        field: "invoiceMonth",
        sortable: isSortable,
        editable: editableUnlessPaid,
        enableRowGroup: true,
        valueFormatter: (params) => formatMonthYear(params.value),
      },
      {
        headerName: "Billing",
        field: "billing",
        sortable: isSortable,
        aggFunc: "sum",
        valueFormatter: (params) => formatCurrency(params.value), // Format with dollar sign
      },
      {
        headerName: "Hours",
        field: "hours",
        sortable: isSortable,
        editable: editableUnlessPaid,
        aggFunc: "sum",
      },
      {
        headerName: "InvoiceAmount",
        field: "total",
        sortable: isSortable,
        aggFunc: "sum",
        valueFormatter: (params) => formatCurrency(params.value), // Format with dollar sign
      },
      {
        headerName: "Discounts",
        field: "discounts",
        sortable: isSortable,
        editable: editableUnlessPaid,
        aggFunc: "sum",
        valueFormatter: (params) => formatCurrency(params.value || 0),
      },
      {
        headerName: "Invoice PaidAmount",
        field: "invoicePaidAmount",
        sortable: isSortable,
        aggFunc: "sum",
        valueFormatter: (params) => formatCurrency(params.value), // Format with dollar sign
      },
      {
        headerName: "Invoice PaidDate",
        field: "invoicePaidDate",
        sortable: isSortable,
        // Always editable, even on an otherwise-locked Paid row — the whole
        // point is letting the user correct/set this after marking Paid.
        editable: true,
        // Date-picker editor (matches the "yyyy-MM-dd" string this field is
        // stored as) instead of a free-text cell.
        cellEditor: "agDateStringCellEditor",
        filter: "agSetColumnFilter",
        valueFormatter: (params) => formatDateMDY(params.value),
      },
      { headerName: "Start Date", field: "startDate", sortable: isSortable, valueFormatter: (params) => formatDateMDY(params.value) },
      { headerName: "End Date", field: "endDate", sortable: isSortable, valueFormatter: (params) => formatDateMDY(params.value) },
      //{ headerName: 'Invoice Date', field: 'invoiceDate', sortable: isSortable},
      {
        headerName: "Status",
        field: "status",
        sortable: isSortable,
        // Always editable, even on an otherwise-locked Paid row — the whole
        // point is letting the user correct a wrong status after the fact
        // (e.g. un-mark a row accidentally set to Paid).
        editable: true,
        cellEditor: "agSelectCellEditor",
        cellEditorParams: {
          values: ["Created", "Paid", "Partially Paid", "Archived"],
        },
      },
      { headerName: "Project Id", field: "projectId", sortable: isSortable },
      { headerName: "Project Name", field: "projectName", sortable: isSortable },
      {
        colId: "action",
        headerName: "Action",
        pinned: "right",
        sortable: false,
        filter: false,
        editable: false,
        cellRenderer: (params) => {
          if (!params.data || params.node.rowPinned) return null;
          return (
            <NotesActionButton
              onOpenNotes={() => setNoteModalRow(params.data)}
              extraActions={buildRowActions({
                onArchive: () => handleArchiveInvoice(params.data),
                onDelete: () => handleDeleteInvoice(params.data),
                entityType: "Invoice",
                entityId: params.data.id,
                entityLabel: params.data.invoiceNumber,
              })}
            />
          );
        },
      },
    ];
    return columns;
  };

  const gridOptions = {
    pagination: true,
    paginationPageSize: 10, // Number of rows to show per page
    domLayout: "autoHeight",
  };

  const handleSearchInputChange = (event) => {
    setSearchText(event.target.value);
  };

  const onBtnExportDataAsExcel = () => {
    if (gridRef.current) {
      gridRef.current.exportDataAsExcel();
    }
  };

  const filterData = () => {
    if (!searchText) {
      return enrichedRowData;
    }

    return (enrichedRowData || []).filter((row) =>
      Object.values(row).some((value) =>
        String(value).toLowerCase().includes(searchText.toLowerCase()),
      ),
    );
  };

  const [open, setOpen] = useState(false);

  const addNewInvoice = () => {
    setOpen(true);
  };
  const onClose = () => {
    setOpen(false);
    // NewInvoice's own submit already saves successfully — this grid just
    // never refetched afterward, so a new invoice was invisible until a
    // manual Refresh, which looked exactly like Submit silently failing.
    fetchData();
    onRefresh?.();
  };

  // Left-nav "Create > Customers > Invoice" links here with ?new=1 to land
  // straight on the add-invoice drawer instead of just the grid.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("new") === "1") {
      setOpen(true);
    }
  }, []);

  const sumInvoiceRows = (rows, label) => ({
    invoiceNumber: label,
    hours: rows.reduce((sum, row) => sum + (row.hours || 0), 0),
    total: rows.reduce((sum, row) => sum + (row.total || 0), 0),
    discounts: rows.reduce((sum, row) => sum + (row.discounts || 0), 0),
    invoicePaidAmount: rows.reduce((sum, row) => sum + (row.invoicePaidAmount || 0), 0),
  });

  // Bottom row: grand total across every invoice currently in scope
  // (employee/project/status props), regardless of the search box or any
  // AG Grid column filter.
  useEffect(() => {
    if (enrichedRowData && enrichedRowData.length > 0) {
      setPinnedBottomRowData([sumInvoiceRows(enrichedRowData, "Total")]);
    } else {
      setPinnedBottomRowData([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enrichedRowData]);

  // Top row: same totals, but only over rows currently passing both the
  // search box and every AG Grid column filter.
  const { pinnedTopRowData, onModelUpdated } = useFilteredTotalsRow((rows) =>
    sumInvoiceRows(rows, "Filtered Total"),
  );

  const generateInvoice = () => {
    if (employeeId) {
      // Check first whether there's actually anything left to generate —
      // if every period already has an invoice, just alert and stay on
      // this page instead of swapping to an empty Generate Invoice grid.
      axios
        .get(API_ENDPOINTS.activeProjectsForInvoiceByEmployee(employeeId))
        .then((response) => {
          const rows = response.data || [];
          const remaining = rows.filter((row) => !row.invoiceId);
          if (rows.length > 0 && remaining.length === 0) {
            message.success(`Invoices for ${rows[0].employeeName || "this employee"} is up to date`);
            return;
          }
          // Scoped to just this employee's own active projects — swap the
          // grid in place instead of navigating to a separate page.
          setIsGeneratingInvoice(true);
        })
        .catch((error) => {
          console.error("Error checking invoice status:", error);
          // Fail open — let the grid itself surface any error.
          setIsGeneratingInvoice(true);
        });
      return;
    }

    const formattedDate = selectedDate
      ? new Date(selectedDate).toISOString().split("T")[0]
      : null;
    const month = formattedDate
      ? new Date(selectedDate).toLocaleString("default", { month: "long" }) // Use 'short' for abbreviated month
      : null;
    // yyyy-MM of the picked month — used to restrict Generate Invoice to
    // just this period instead of every not-yet-invoiced period.
    const selectedMonth = formattedDate ? formattedDate.substring(0, 7) : null;
    // Walk every employee's full un-invoiced backlog (active AND inactive
    // projects alike) via activeProjectsForInvoiceByEmployee — same source
    // the page-level Invoice Alerts bell uses. activeProjects (the old
    // source here) only returns the current calendar month's row per
    // active project, so it silently dropped everything older than this
    // month, and every inactive project; that's not what "no month picked"
    // or even a specific past month should mean.
    navigate("/generateInvoice", {
      state: {
        employeeIds: employeeIdsForInvoicing,
        month: month,
        selectedMonth: selectedMonth,
      },
    });
  };

  const getRowStyle = (params) => {
    if (params.node.rowPinned) {
      return { backgroundColor: "#d3f4ff", fontWeight: "bold" }; // Custom inline style for pinned rows
    }
    return null;
  };

  if (isGeneratingInvoice) {
    return (
      <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <GenerateInvoiceDetails
          url={API_ENDPOINTS.activeProjectsForInvoiceByEmployee(employeeId)}
          onBack={() => {
            setIsGeneratingInvoice(false);
            fetchData();
            onRefresh?.();
          }}
        />
      </div>
    );
  }

  return (
    <div
    style={{
      height: "100%",
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
    }}
  >
    {!employeeId && !projectId && !customerId && (
      <ChartOverviewPanel
        panelTitle="Invoice Overview"
        charts={visibleInvoiceOverviewCharts}
        alerts={
          <>
            <Popover content={invoiceAlertContent} title="Invoice Alerts" trigger="click" placement="bottomRight">
              <Badge count={invoiceAlerts.length} size="small">
                <Button icon={<BellOutlined />} size="small" />
              </Badge>
            </Popover>
            <Popover content={monthlyPaymentAlertContent} title="Invoiced vs Paid Alerts" trigger="click" placement="bottomRight">
              <Badge count={monthlyPaymentAlerts.length} size="small">
                <Button icon={<BellOutlined />} size="small" />
              </Badge>
            </Popover>
          </>
        }
      />
    )}
    <div className="ag-theme-alpine employee-List-grid">
    <Card className="employeeTableCard" style={{ height: "100%" }}>
      <Drawer
        title={`Add New Invoice`}
        placement="right"
        size="large"
        onClose={onClose}
        open={open}
      >
        <NewInvoice onClose={onClose} employeeId={employeeId} open={open} />
      </Drawer>
      <Modal
        title="Select Paid Date"
        open={!!paidDatePrompt}
        onOk={confirmPaidDate}
        onCancel={cancelPaidDatePrompt}
        okText="Confirm"
        cancelText="Cancel"
        okButtonProps={{ disabled: !promptPaidDate }}
      >
        <p>This invoice is being marked as Paid. Please choose the paid date.</p>
        <AntDatePicker
          style={{ width: "100%" }}
          value={promptPaidDate}
          onChange={setPromptPaidDate}
          format="MM/DD/YYYY"
        />
      </Modal>
      <GridToolbar className="workforce-search-container" gap={32}>
        <Button
          type="default"
          icon={<ReloadOutlined />}
          onClick={() => {
            fetchData();
            // When embedded (e.g. Project Full Details' "Invoices" tab),
            // also refreshes the host page's own totals/chart — otherwise
            // those go stale after a save made right here.
            onRefresh?.();
          }}
          style={{ marginRight: "10px" }}
        >
          Refresh
        </Button>
        <input
          type="text"
          placeholder="Search..."
          value={searchText}
          onChange={handleSearchInputChange}
        />
        <Button
          type="default"
          icon={<FileExcelOutlined />}
          onClick={onBtnExportDataAsExcel}
          style={{ marginLeft: "10px" }}
        >
          Export to Excel
        </Button>
        {Object.keys(modifiedRows).length > 0 && (
          <>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              onClick={handleSaveChanges}
              style={{ marginLeft: "10px" }}
            >
              Save
            </Button>
            <Button
              icon={<CloseOutlined />}
              onClick={handleCancelChanges}
              style={{ marginLeft: "10px" }}
            >
              Cancel
            </Button>
          </>
        )}
        <Button
          style={{ marginLeft: "20px" }}
          type="primary"
          className="button-customer"
          onClick={addNewInvoice}
        >
          <PlusOutlined /> Add New Invoice
        </Button>
        {/* Label + picker stay paired as one collapsible unit — either
            both show or both collapse together, since one without the
            other wouldn't make sense. */}
        <span className="invoice-date-field" style={{ display: "flex", alignItems: "center" }}>
          <label style={{ marginBottom: 0 }}>Invoice Date:&nbsp;</label>
          <DatePicker
            className="invoice-date-picker"
            selected={selectedDate}
            onChange={handleDateChange}
            dateFormat="MM/yyyy"
            placeholderText="Select the date"
            showMonthYearPicker
          />
        </span>
        <Button
          type="primary"
          style={{ marginLeft: "10px" }}
          className="button-customer"
          // A month is optional: with one picked, generateInvoice() scopes
          // to just that period; with none, it shows every not-yet-invoiced
          // period through today.
          onClick={generateInvoice}
        >
          <PlusOutlined /> Generate Invoice
        </Button>
      </GridToolbar>
      <div
        className="invoice1-grid-wrapper"
        style={gridHeight ? { height: gridHeight, maxHeight: gridHeight } : undefined}
      >
      <AgGridReact
        enableCellTextSelection={true}
        ensureDomOrder={true}
        ref={gridRef}
        onGridReady={(params) => {
          gridRef.current = params.api;
        }}
        onSortChanged={(params) => params.api.refreshCells({ force: true })}
        onFilterChanged={(params) => params.api.refreshCells({ force: true })}
        onModelUpdated={onModelUpdated}
        onFirstDataRendered={(params) => {
          try { params.api.autoSizeAllColumns(); } catch (e) {}
        }}
        autoSizeStrategy={{ type: "fitCellContents" }}
        onCellValueChanged={onCellValueChanged}
        rowHeight={48}
        rowData={filterData()}
        columnDefs={sizeColumnsForHeader(getColumnsDefList(true))}
        gridOptions={gridOptions}
        defaultColDef={{
          minWidth: 100,
          maxWidth: 220,
          resizable: true,
          filter: "agSetColumnFilter",
          headerClass: "ag-header-cell",
          cellClassRules: {
            darkGreyBackground: (params) => params.node?.rowIndex !== undefined
            && params.node.rowIndex % 2 === 1,
          }
        }}
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
        sortable={true}
        rowGroupPanelShow="always"
        domLayout="normal"
        pagination={true}
        paginationPageSize={100}
        paginationPageSizeSelector={[20, 50, 100]}
        pinnedTopRowData={pinnedTopRowData}
        pinnedBottomRowData={pinnedBottomRowData}
        getRowStyle={getRowStyle}
        enableBrowserTooltips={true}
        popupParent={document.body}
      />
      {isTimesheetOpen && (
        <MonthlyTimesheetDialog
          open={isTimesheetOpen}
          onClose={() => setIsTimesheetOpen(false)}
          onSave={handleSaveTimesheet}
          initialData={Array(30).fill(0)}
        />
      )}
      </div>
    </Card>
    <NotesModal
      open={!!noteModalRow}
      entityType="Invoice"
      entityId={noteModalRow?.id}
      title={noteModalRow?.invoiceNumber}
      onClose={() => setNoteModalRow(null)}
    />
    </div>
    </div>
  );
};

export default InvoiceDetails;
