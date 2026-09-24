import { useEffect, useMemo, useRef, useState } from "react";
import { AgGridReact } from "@ag-grid-community/react";
import { Button, Select } from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import "ag-grid-enterprise";
import axios from "axios";
import API_ENDPOINTS from "../config";
import { formatCurrency } from "../Utils/CurrencyFormatter";
import { formatMonthYear, formatDate, formatDateMDY } from "../Utils/dateFormat";
import { sizeColumnsForHeader } from "../Utils/agGridColumnSizing";
import GridToolbar from "../Utils/GridToolbar";

// One grid, two categories ("Projects" and "Payments"), grouped/collapsed
// under a single "Category" column. Not every column applies to every
// category — Projects use Billing/Income/Income Paid, Payments use Total
// Payment — cells that don't apply to a row's category are just left blank.
//
// Projects: Income/Income Paid are computed from the Bills table (one bill
// per assignment per invoice, employeeId already on each bill) rather than
// re-deriving from invoices — Income is every bill for the employee on
// that project; Income Paid is just the bills whose invoice has cleared
// (status !== "Created", i.e. "Invoice Cleared" or "Paid"). Expanding a
// project row (master/detail) shows those bill records.
//
// Payments: one row per YEAR (from payroll), aggregated client-side.
// Expanding a year row (same master/detail mechanism) shows every
// individual pay record for that year.
export default function FinalReportDetails({ employeeId }) {
  const gridRef = useRef(null);
  const [rowData, setRowData] = useState([]);
  const [loading, setLoading] = useState(false);
  // Cutoffs: null means "no filter, show everything" (the default). When
  // set, they scope the Payments/Projects categories to records on or
  // before the chosen date — Payroll Date against payroll checkDate,
  // Invoice Date against a bill's endDate (which now mirrors its
  // invoice's endDate, see bills-and-invoices.md). Adjustments/Expenses
  // aren't payroll- or invoice-dated, so they're left unfiltered.
  const [payrollCutoffDate, setPayrollCutoffDate] = useState(null);
  const [invoiceCutoffDate, setInvoiceCutoffDate] = useState(null);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId]);

  const fetchProjectRows = async () => {
    const { data: projects } = await axios.get(API_ENDPOINTS.projectsByEmployeeId(employeeId));

    return Promise.all(
      (projects || []).map(async (project) => {
        const { data: allBills } = await axios.get(
          API_ENDPOINTS.getBillsForProject(project.projectId),
        );
        // A project can have bills for more than one employee (multiple
        // assignments) — scope to this employee's own bills.
        const bills = (allBills || []).filter(
          (bill) => Number(bill.employeeId) === Number(employeeId),
        );
        // Cleared: the client has paid the invoice this bill was billed
        // against (status moved past "Created" to "Invoice Cleared", or
        // further to "Paid").
        const clearedBills = bills.filter((bill) => bill.status !== "Created");

        // "Billing" here is what the employee is paid (EMP_PAY assignment
        // wage), not the client billing rate — shown for reference only,
        // Income/Income Paid come from the bills themselves.
        const empPayAssignment = (project.assignments || []).find(
          (assignment) =>
            assignment.assignmentType === "EMP_PAY" &&
            Number(assignment.employeeId) === Number(employeeId),
        );
        const billing = empPayAssignment?.wage || 0;

        return {
          category: "Projects",
          detailType: "bills",
          projectId: project.projectId,
          description: `Consulting services provided for ${project.customer?.customerCompanyName || project.projectName}`,
          billing,
          hours: bills.reduce((sum, bill) => sum + (bill.hours || 0), 0),
          paidHours: clearedBills.reduce((sum, bill) => sum + (bill.hours || 0), 0),
          income: bills.reduce((sum, bill) => sum + (bill.total || 0), 0),
          incomePaid: clearedBills.reduce((sum, bill) => sum + (bill.total || 0), 0),
          billRecords: bills,
        };
      }),
    );
  };

  const fetchPaymentRows = async () => {
    const { data: payrolls } = await axios.get(API_ENDPOINTS.getPayrollsForEmp(employeeId));

    const byYear = {};
    (payrolls || [])
      .filter((payroll) => payroll.checkDate)
      .forEach((payroll) => {
        const year = payroll.checkDate.substring(0, 4);
        if (!byYear[year]) byYear[year] = [];
        byYear[year].push(payroll);
      });

    return Object.entries(byYear).map(([year, records]) => ({
      category: "Payments",
      detailType: "payroll",
      description: `Payroll for ${year}`,
      totalPayment: records.reduce((sum, r) => sum + (r.totalPaid || 0), 0),
      payRecords: records,
    }));
  };

  // Adjustments: one combined row at the top level (Total Payment / Income /
  // Income Paid summed across every adjustment), same as Projects/Payments —
  // expanding it (master/detail) reveals every individual adjustment
  // record. Per the employee's role on each record: when they're the
  // recipient ("to"), it's money paid to them — Total Payment; when they're
  // the source ("from"), it's Income they're owed back, so it counts as
  // both Income and Income Paid.
  const fetchAdjustmentRows = async () => {
    const { data: adjustments } = await axios.get(
      `${API_ENDPOINTS.findAdjustmentsByEmployeeId}?id=${employeeId}`,
    );

    const adjustmentRecords = (adjustments || []).map((adjustment) => {
      const isRecipient = Number(adjustment.toId) === Number(employeeId);
      const amount = Math.abs(adjustment.amount || 0);
      return {
        description: adjustment.adjustmentType,
        from: adjustment.fromName,
        to: adjustment.toName,
        date: adjustment.adjustmentDate,
        notes: adjustment.notes,
        totalPayment: isRecipient ? amount : undefined,
        income: !isRecipient ? amount : undefined,
        incomePaid: !isRecipient ? amount : undefined,
      };
    });

    if (adjustmentRecords.length === 0) return [];

    return [
      {
        category: "Adjustments",
        detailType: "adjustments",
        description: "Adjustments",
        totalPayment: adjustmentRecords.reduce((sum, r) => sum + (r.totalPayment || 0), 0),
        income: adjustmentRecords.reduce((sum, r) => sum + (r.income || 0), 0),
        incomePaid: adjustmentRecords.reduce((sum, r) => sum + (r.incomePaid || 0), 0),
        adjustmentRecords,
      },
    ];
  };

  // Expenses: same combined-row-with-drilldown pattern as Adjustments — but
  // reimbursable expenses are money the EMPLOYEE owes the company (not
  // money paid to them), so they reduce Income rather than count toward
  // Total Payment. Non-reimbursable expenses still show in the drill-down
  // for the full picture, they just don't count toward either total.
  const fetchExpenseRows = async () => {
    const { data: expenses } = await axios.get(API_ENDPOINTS.getExpensesForEmployee(employeeId));

    const expenseRecords = (expenses || []).map((expense) => ({
      description: expense.description,
      amount: expense.amount || 0,
      reimbursable: expense.reimbursable,
      date: expense.expenseDate,
      status: expense.status,
    }));

    if (expenseRecords.length === 0) return [];

    return [
      {
        category: "Expenses",
        detailType: "expenses",
        description: "Expenses",
        income: -expenseRecords
          .filter((r) => r.reimbursable)
          .reduce((sum, r) => sum + r.amount, 0),
        expenseRecords,
      },
    ];
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [projectRows, paymentRows, adjustmentRows, expenseRows] = await Promise.all([
        fetchProjectRows(),
        fetchPaymentRows(),
        fetchAdjustmentRows(),
        fetchExpenseRows(),
      ]);
      setRowData([...projectRows, ...paymentRows, ...adjustmentRows, ...expenseRows]);
    } catch (error) {
      console.error("Error fetching final report data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Every payroll checkDate / bill endDate seen across the fetched data —
  // the dropdown options are drawn from the employee's own actual dates
  // rather than a free-form date picker, so there's no way to pick a
  // cutoff that doesn't correspond to a real record.
  const payrollDateOptions = useMemo(() => {
    const payPeriodByCheckDate = new Map();
    rowData.forEach((row) => {
      if (row.detailType === "payroll") {
        (row.payRecords || []).forEach((r) => {
          if (r.checkDate && !payPeriodByCheckDate.has(r.checkDate)) {
            payPeriodByCheckDate.set(r.checkDate, {
              startDate: r.payPeriodStartDate,
              endDate: r.payPeriodEndDate,
            });
          }
        });
      }
    });
    return Array.from(payPeriodByCheckDate.entries())
      .map(([checkDate, payPeriod]) => ({ checkDate, ...payPeriod }))
      .sort((a, b) => a.checkDate.localeCompare(b.checkDate));
  }, [rowData]);

  const invoiceDateOptions = useMemo(() => {
    const dates = new Set();
    rowData.forEach((row) => {
      if (row.detailType === "bills") {
        (row.billRecords || []).forEach((r) => r.endDate && dates.add(r.endDate));
      }
    });
    return Array.from(dates).sort();
  }, [rowData]);

  // Applies the two cutoffs by re-deriving each Projects/Payments row's
  // aggregates from its own already-fetched detail records (billRecords /
  // payRecords) rather than re-fetching — cheap, and keeps the drill-down
  // grids in sync with the filtered totals automatically.
  const filteredRowData = useMemo(() => {
    return rowData
      .map((row) => {
        if (row.detailType === "bills" && invoiceCutoffDate) {
          const filteredBills = (row.billRecords || []).filter(
            (bill) => bill.endDate && bill.endDate <= invoiceCutoffDate,
          );
          const clearedBills = filteredBills.filter((bill) => bill.status !== "Created");
          return {
            ...row,
            hours: filteredBills.reduce((sum, bill) => sum + (bill.hours || 0), 0),
            paidHours: clearedBills.reduce((sum, bill) => sum + (bill.hours || 0), 0),
            income: filteredBills.reduce((sum, bill) => sum + (bill.total || 0), 0),
            incomePaid: clearedBills.reduce((sum, bill) => sum + (bill.total || 0), 0),
            billRecords: filteredBills,
          };
        }
        if (row.detailType === "payroll" && payrollCutoffDate) {
          const filteredRecords = (row.payRecords || []).filter(
            (r) => r.checkDate && r.checkDate <= payrollCutoffDate,
          );
          return {
            ...row,
            totalPayment: filteredRecords.reduce((sum, r) => sum + (r.totalPaid || 0), 0),
            payRecords: filteredRecords,
          };
        }
        return row;
      })
      // A payroll year-row with every record filtered out has nothing left
      // to show — drop it rather than leaving a $0 row behind.
      .filter((row) => !(row.detailType === "payroll" && payrollCutoffDate && row.payRecords.length === 0));
  }, [rowData, invoiceCutoffDate, payrollCutoffDate]);

  // Totals reflect the cutoff-date filters above (filteredRowData). They
  // don't react to interactive AG Grid column filters — two different
  // attempts at reading that live from the grid API (forEachNodeAfterFilter,
  // then getDisplayedRowCount/RowAtIndex) both crashed, because this
  // environment mixes ag-grid-enterprise v31 (registered globally via the
  // plain `import "ag-grid-enterprise"` below) with the v32
  // @ag-grid-community packages this file's AgGridReact actually comes
  // from — its legacy compat shim (VanillaFrameworkOverrides) doesn't
  // proxy newer GridApi methods through correctly, so nothing that queries
  // the live grid instance can be trusted here. Plain React state is the
  // safe option.
  const pinnedTopRowData = useMemo(
    () =>
      filteredRowData.length > 0
        ? [
            (() => {
              const hours = filteredRowData.reduce((sum, row) => sum + (row.hours || 0), 0);
              const paidHours = filteredRowData.reduce((sum, row) => sum + (row.paidHours || 0), 0);
              const income = filteredRowData.reduce((sum, row) => sum + (row.income || 0), 0);
              const incomePaid = filteredRowData.reduce((sum, row) => sum + (row.incomePaid || 0), 0);
              const totalPayment = filteredRowData.reduce((sum, row) => sum + (row.totalPayment || 0), 0);
              return {
                description: "Total",
                hours,
                paidHours,
                income,
                incomePaid,
                totalPayment,
                balancePaid: incomePaid - totalPayment,
                balance: income - totalPayment,
              };
            })(),
          ]
        : [],
    [filteredRowData],
  );

  const columnDefs = [
    {
      field: "category",
      headerName: "Category",
      rowGroup: true,
      hide: true,
    },
    {
      field: "description",
      headerName: "Description",
      cellRenderer: "agGroupCellRenderer",
      cellRendererParams: { suppressCount: true },
      minWidth: 260,
    },
    {
      field: "hours",
      headerName: "Total Hours",
      aggFunc: "sum",
      valueFormatter: (params) => (params.value ? params.value : ""),
    },
    { field: "paidHours", headerName: "Paid Hours", aggFunc: "sum" },
    {
      field: "billing",
      headerName: "Billing",
      valueFormatter: (params) => (params.value ? formatCurrency(params.value) : ""),
    },
    {
      field: "income",
      headerName: "Income",
      aggFunc: "sum",
      valueFormatter: (params) => (params.value ? formatCurrency(params.value) : ""),
    },
    {
      field: "incomePaid",
      headerName: "Income Paid",
      aggFunc: "sum",
      valueFormatter: (params) => (params.value ? formatCurrency(params.value) : ""),
    },
    {
      field: "totalPayment",
      headerName: "Total Payment",
      aggFunc: "sum",
      valueFormatter: (params) => (params.value ? formatCurrency(params.value) : ""),
    },
    {
      field: "balancePaid",
      headerName: "Balance-Paid",
      valueFormatter: (params) => (params.value !== undefined ? formatCurrency(params.value) : ""),
    },
    {
      field: "balance",
      headerName: "Balance",
      valueFormatter: (params) => (params.value !== undefined ? formatCurrency(params.value) : ""),
    },
  ];

  const billDetailConfig = {
    detailGridOptions: {
      domLayout: "autoHeight",
      columnDefs: [
        { field: "billId", headerName: "Bill Id", filter: "agSetColumnFilter" },
        {
          field: "invoiceMonth",
          headerName: "Invoice Month",
          filter: "agSetColumnFilter",
          valueFormatter: (params) => formatMonthYear(params.value),
        },
        { field: "hours", headerName: "Hours", filter: "agSetColumnFilter" },
        {
          field: "total",
          headerName: "Total",
          filter: "agSetColumnFilter",
          valueFormatter: (params) => (params.value ? formatCurrency(params.value) : ""),
        },
        { field: "status", headerName: "Status", filter: "agSetColumnFilter" },
      ],
      defaultColDef: { flex: 1, minWidth: 20, resizable: true },
    },
    getDetailRowData: (params) => {
      params.successCallback(params.data.billRecords || []);
    },
  };

  const payrollDetailConfig = {
    detailGridOptions: {
      domLayout: "autoHeight",
      columnDefs: [
        {
          field: "checkDate",
          headerName: "Pay Check Date",
          filter: "agSetColumnFilter",
          valueFormatter: (params) => formatDate(params.value),
        },
        { field: "hours", headerName: "Hours", filter: "agSetColumnFilter" },
        {
          field: "totalPaid",
          headerName: "Total Paid",
          filter: "agSetColumnFilter",
          valueFormatter: (params) => formatCurrency(params.value),
        },
        { field: "paymentDetails", headerName: "Payment Details", filter: "agSetColumnFilter" },
        { field: "payPeriodStartDate", headerName: "Pay Cycle Start", filter: "agSetColumnFilter", valueFormatter: (params) => formatDateMDY(params.value) },
        { field: "payPeriodEndDate", headerName: "Pay Cycle End", filter: "agSetColumnFilter", valueFormatter: (params) => formatDateMDY(params.value) },
      ],
      defaultColDef: { flex: 1, minWidth: 20, resizable: true },
    },
    getDetailRowData: (params) => {
      params.successCallback(params.data.payRecords || []);
    },
  };

  const adjustmentDetailConfig = {
    detailGridOptions: {
      domLayout: "autoHeight",
      columnDefs: [
        { field: "description", headerName: "Type", filter: "agSetColumnFilter" },
        { field: "from", headerName: "From", filter: "agSetColumnFilter" },
        { field: "to", headerName: "To", filter: "agSetColumnFilter" },
        { field: "date", headerName: "Date", filter: "agSetColumnFilter", valueFormatter: (params) => formatDateMDY(params.value) },
        { field: "notes", headerName: "Notes", filter: "agSetColumnFilter" },
        {
          field: "totalPayment",
          headerName: "Total Payment",
          filter: "agSetColumnFilter",
          valueFormatter: (params) => (params.value ? formatCurrency(params.value) : ""),
        },
        {
          field: "income",
          headerName: "Income",
          filter: "agSetColumnFilter",
          valueFormatter: (params) => (params.value ? formatCurrency(params.value) : ""),
        },
        {
          field: "incomePaid",
          headerName: "Income Paid",
          filter: "agSetColumnFilter",
          valueFormatter: (params) => (params.value ? formatCurrency(params.value) : ""),
        },
      ],
      defaultColDef: { flex: 1, minWidth: 20, resizable: true },
    },
    getDetailRowData: (params) => {
      params.successCallback(params.data.adjustmentRecords || []);
    },
  };

  const expenseDetailConfig = {
    detailGridOptions: {
      domLayout: "autoHeight",
      columnDefs: [
        { field: "description", headerName: "Description", filter: "agSetColumnFilter" },
        {
          field: "amount",
          headerName: "Amount",
          filter: "agSetColumnFilter",
          valueFormatter: (params) => (params.value ? formatCurrency(params.value) : ""),
        },
        {
          field: "reimbursable",
          headerName: "Reimbursable",
          filter: "agSetColumnFilter",
          valueFormatter: (params) => (params.value ? "Yes" : "No"),
        },
        { field: "date", headerName: "Date", filter: "agSetColumnFilter", valueFormatter: (params) => formatDateMDY(params.value) },
        { field: "status", headerName: "Status", filter: "agSetColumnFilter" },
      ],
      defaultColDef: { flex: 1, minWidth: 20, resizable: true },
    },
    getDetailRowData: (params) => {
      params.successCallback(params.data.expenseRecords || []);
    },
  };

  // Which detail grid to show depends on the row's own category — Projects
  // drill down into bills, Payments (year rows) drill down into the
  // individual pay records for that year, Adjustments/Expenses drill down
  // into their own individual records.
  const detailCellRendererParams = (params) => {
    if (params.data?.detailType === "payroll") return payrollDetailConfig;
    if (params.data?.detailType === "adjustments") return adjustmentDetailConfig;
    if (params.data?.detailType === "expenses") return expenseDetailConfig;
    return billDetailConfig;
  };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div className="ag-theme-alpine project-List-grid">
        <GridToolbar className="workforce-search-container">
          <Button
            type="default"
            icon={<ReloadOutlined />}
            onClick={fetchData}
            loading={loading}
            style={{ marginRight: "10px" }}
          >
            Refresh
          </Button>
          <Select
            allowClear
            placeholder="Payroll Cutoff (All)"
            style={{ width: 280, marginRight: "10px" }}
            value={payrollCutoffDate || undefined}
            onChange={(value) => setPayrollCutoffDate(value || null)}
            options={payrollDateOptions.map(({ checkDate, startDate, endDate }) => ({
              value: checkDate,
              label:
                startDate && endDate
                  ? `${formatDate(checkDate)} (Pay Period: ${formatDate(startDate)} - ${formatDate(endDate)})`
                  : formatDate(checkDate),
            }))}
          />
          <Select
            allowClear
            placeholder="Invoice Cutoff (All)"
            style={{ width: 200 }}
            value={invoiceCutoffDate || undefined}
            onChange={(value) => setInvoiceCutoffDate(value || null)}
            options={invoiceDateOptions.map((date) => ({ value: date, label: formatDate(date) }))}
          />
        </GridToolbar>
        <div className="project-grid-wrapper">
          <AgGridReact
            enableCellTextSelection={true}
            ensureDomOrder={true}
            ref={gridRef}
            onGridReady={(params) => {
              gridRef.current = params.api;
            }}
            onSortChanged={(params) => params.api.refreshCells({ force: true })}
            onFilterChanged={(params) => params.api.refreshCells({ force: true })}
            onFirstDataRendered={(params) => {
              try {
                params.api.autoSizeAllColumns();
              } catch (e) {}
            }}
            autoSizeStrategy={{ type: "fitCellContents" }}
            rowHeight={48}
            rowData={filteredRowData}
            columnDefs={sizeColumnsForHeader(columnDefs)}
            masterDetail={true}
            isRowMaster={(dataItem) => Boolean(dataItem?.detailType)}
            detailCellRendererParams={detailCellRendererParams}
            groupDefaultExpanded={0}
            groupIncludeTotalFooter={false}
            suppressAggFuncInHeader={true}
            pinnedTopRowData={pinnedTopRowData}
            getRowStyle={(params) =>
              params.node.rowPinned ? { backgroundColor: "#d3f4ff", fontWeight: "bold" } : null
            }
            defaultColDef={{
              minWidth: 100,
              resizable: true,
              filter: "agSetColumnFilter",
              headerClass: "ag-header-cell",
              cellClassRules: {
                darkGreyBackground: (params) =>
                  params.node?.rowIndex !== undefined && params.node.rowIndex % 2 === 1,
              },
            }}
            domLayout="normal"
            enableBrowserTooltips={true}
            popupParent={document.body}
            animateRows={true}
            pagination={true}
            paginationPageSize={100}
            paginationPageSizeSelector={[20, 50, 100]}
            detailRowAutoHeight={true}
          />
        </div>
      </div>
    </div>
  );
}
