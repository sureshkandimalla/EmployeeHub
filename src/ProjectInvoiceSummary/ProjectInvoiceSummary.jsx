import { useEffect, useMemo, useRef, useState } from "react";
import { AgGridReact } from "@ag-grid-community/react";
import { Button } from "antd";
import { ReloadOutlined, FileExcelOutlined } from "@ant-design/icons";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import "ag-grid-enterprise";
import axios from "axios";
import API_ENDPOINTS from "../config";
import { formatCurrency } from "../Utils/CurrencyFormatter";
import { formatMonthYear, formatDateMDY } from "../Utils/dateFormat";
import { sizeColumnsForHeader } from "../Utils/agGridColumnSizing";
import { useFilteredTotalsRow } from "../Utils/useFilteredTotalsRow";
import GridToolbar from "../Utils/GridToolbar";

// One row per Project — Total Invoice/Invoice Paid/Discounts/Pending are
// aggregated across every invoice billed against that project, and Last
// Paid is the invoicePaidDate of the most recently paid one. Expanding a
// row (master/detail, same mechanism as FinalReportDetails/VisaDetailsList)
// shows every individual invoice that rolled into those totals.
//
// There's no Vendor entity linked to Project/Invoice in the data model —
// only Customer is (Project→Customer), so "Customer Name" is shown here in
// place of a vendor column, matching what InvoiceDetails.jsx already
// exposes for each project.
export default function ProjectInvoiceSummary() {
  const gridRef = useRef(null);
  const [invoices, setInvoices] = useState([]);
  const [projects, setProjects] = useState([]);
  const [searchText, setSearchText] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      axios.get(API_ENDPOINTS.getAllInvoices).then((res) => res.data || []),
      axios.get(API_ENDPOINTS.getProjects).then((res) => res.data || []),
    ])
      .then(([invoiceData, projectData]) => {
        setInvoices(invoiceData);
        setProjects(projectData);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, []);

  const projectsById = useMemo(
    () => Object.fromEntries(projects.map((p) => [p.projectId, p])),
    [projects],
  );

  const rowData = useMemo(() => {
    const byProject = {};
    invoices.forEach((inv) => {
      if (inv.projectId == null) return;
      (byProject[inv.projectId] ||= []).push(inv);
    });

    return Object.entries(byProject).map(([pid, invs]) => {
      const project = projectsById[pid] || {};
      const totalInvoice = invs.reduce((sum, i) => sum + (i.total || 0), 0);
      const totalPaid = invs.reduce((sum, i) => sum + (i.invoicePaidAmount || 0), 0);
      const totalDiscounts = invs.reduce((sum, i) => sum + (i.discounts || 0), 0);
      const lastPaidDate = invs
        .map((i) => i.invoicePaidDate)
        .filter(Boolean)
        .sort()
        .pop() || null;

      return {
        projectId: Number(pid),
        projectName: project.projectName || "",
        employeeName: project.employeeName || "",
        customerName: project.customerName || "",
        totalInvoice,
        totalPaid,
        totalDiscounts,
        pending: totalInvoice - totalPaid - totalDiscounts,
        lastPaidDate,
        invoices: [...invs].sort((a, b) => (a.invoiceMonth || "").localeCompare(b.invoiceMonth || "")),
      };
    });
  }, [invoices, projectsById]);

  const filteredRowData = useMemo(() => {
    if (!searchText) return rowData;
    const q = searchText.toLowerCase();
    return rowData.filter((row) =>
      Object.entries(row).some(
        ([key, value]) => key !== "invoices" && value != null && String(value).toLowerCase().includes(q),
      ),
    );
  }, [rowData, searchText]);

  const sumProjectRows = (rows, label) => {
    const totals = rows.reduce(
      (acc, row) => ({
        totalInvoice: acc.totalInvoice + row.totalInvoice,
        totalPaid: acc.totalPaid + row.totalPaid,
        totalDiscounts: acc.totalDiscounts + row.totalDiscounts,
        pending: acc.pending + row.pending,
      }),
      { totalInvoice: 0, totalPaid: 0, totalDiscounts: 0, pending: 0 },
    );
    return { projectName: label, ...totals };
  };

  // Bottom row: grand total across every project, regardless of the search
  // box or any AG Grid column filter.
  const pinnedBottomRowData = useMemo(
    () => (rowData.length > 0 ? [sumProjectRows(rowData, "Total")] : []),
    [rowData],
  );

  // Top row: same totals, but only over rows currently passing both the
  // search box and every AG Grid column filter.
  const { pinnedTopRowData, onModelUpdated } = useFilteredTotalsRow((rows) =>
    sumProjectRows(rows, "Filtered Total"),
  );

  const cellClassRules = {
    darkGreyBackground: (params) =>
      params.node?.rowIndex !== undefined && params.node.rowIndex % 2 === 1,
  };

  const onBtnExportDataAsExcel = () => {
    gridRef.current?.exportDataAsExcel();
  };

  const currencyCol = (field, headerName) => ({
    field,
    headerName,
    filter: "agNumberColumnFilter",
    cellClassRules,
    aggFunc: "sum",
    valueFormatter: (params) => formatCurrency(params.value),
  });

  const columnDefs = [
    {
      headerName: "#",
      valueGetter: (params) => (params.node.rowPinned ? "" : params.node.rowIndex + 1),
      width: 90,
      minWidth: 90,
      maxWidth: 90,
      pinned: "left",
      sortable: false,
      filter: false,
      suppressSizeToFit: true,
      cellStyle: { textAlign: "center", fontWeight: 500 },
      cellClassRules,
    },
    {
      field: "projectId",
      headerName: "Project Id",
      pinned: "left",
      filter: "agSetColumnFilter",
      cellClassRules,
      cellRenderer: (params) => (params.node.rowPinned ? "" : params.value),
      cellRendererSelector: (params) =>
        params.node.rowPinned ? undefined : { component: "agGroupCellRenderer" },
      onCellClicked: (params) => {
        if (params.node.rowPinned) return;
        params.node.setExpanded(!params.node.expanded);
      },
      cellStyle: (params) => (params.node.rowPinned ? null : { cursor: "pointer" }),
    },
    { field: "projectName", headerName: "Project Name", filter: "agSetColumnFilter", cellClassRules },
    { field: "employeeName", headerName: "Employee Name", filter: "agSetColumnFilter", cellClassRules },
    { field: "customerName", headerName: "Customer Name", filter: "agSetColumnFilter", cellClassRules },
    currencyCol("totalInvoice", "Total Invoice"),
    currencyCol("totalPaid", "Invoice Paid"),
    currencyCol("totalDiscounts", "Discounts"),
    {
      ...currencyCol("pending", "Pending"),
      cellStyle: (params) =>
        params.node.rowPinned
          ? null
          : { ...(params.value > 0 ? { color: "#cf1322", fontWeight: 600 } : { color: "#389e0d", fontWeight: 600 }) },
    },
    {
      field: "lastPaidDate",
      headerName: "Last Paid",
      filter: "agSetColumnFilter",
      cellClassRules,
      valueFormatter: (params) => (params.node.rowPinned ? "" : formatDateMDY(params.value)),
    },
  ];

  const detailCellRendererParams = {
    detailGridOptions: {
      domLayout: "autoHeight",
      columnDefs: [
        {
          headerName: "#",
          valueGetter: (params) => params.node.rowIndex + 1,
          width: 70,
          minWidth: 70,
          maxWidth: 70,
          pinned: "left",
          sortable: false,
          filter: false,
          cellStyle: { textAlign: "center", fontWeight: 500 },
        },
        {
          field: "invoiceMonth",
          headerName: "Invoice Month",
          filter: "agSetColumnFilter",
          valueFormatter: (params) => formatMonthYear(params.value),
        },
        { field: "billing", headerName: "Billing", filter: "agSetColumnFilter", valueFormatter: (p) => formatCurrency(p.value) },
        { field: "hours", headerName: "Hours", filter: "agSetColumnFilter" },
        { field: "total", headerName: "Invoice Amount", filter: "agSetColumnFilter", valueFormatter: (p) => formatCurrency(p.value) },
        { field: "discounts", headerName: "Discounts", filter: "agSetColumnFilter", valueFormatter: (p) => formatCurrency(p.value) },
        { field: "invoicePaidAmount", headerName: "Invoice Paid Amount", filter: "agSetColumnFilter", valueFormatter: (p) => formatCurrency(p.value) },
        { field: "invoicePaidDate", headerName: "Invoice Paid Date", filter: "agSetColumnFilter", valueFormatter: (params) => formatDateMDY(params.value) },
        { field: "startDate", headerName: "Start Date", filter: "agSetColumnFilter", valueFormatter: (params) => formatDateMDY(params.value) },
        { field: "endDate", headerName: "End Date", filter: "agSetColumnFilter", valueFormatter: (params) => formatDateMDY(params.value) },
        { field: "status", headerName: "Status", filter: "agSetColumnFilter" },
      ],
      defaultColDef: { minWidth: 100, resizable: true, sortable: true },
      pagination: false,
    },
    getDetailRowData: (params) => {
      params.successCallback(params.data.invoices || []);
    },
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
          <input
            type="text"
            placeholder="Search..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
          <Button
            type="default"
            icon={<FileExcelOutlined />}
            onClick={onBtnExportDataAsExcel}
            style={{ marginLeft: "10px" }}
          >
            Export to Excel
          </Button>
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
            onModelUpdated={onModelUpdated}
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
            detailCellRendererParams={detailCellRendererParams}
            detailRowAutoHeight={true}
            pinnedTopRowData={pinnedTopRowData}
            pinnedBottomRowData={pinnedBottomRowData}
            getRowStyle={(params) =>
              params.node.rowPinned ? { backgroundColor: "#d3f4ff", fontWeight: "bold" } : null
            }
            defaultColDef={{
              minWidth: 100,
              resizable: true,
              filter: "agSetColumnFilter",
            }}
            domLayout="normal"
            enableBrowserTooltips={true}
            popupParent={document.body}
            animateRows={true}
            pagination={true}
            paginationPageSize={50}
            paginationPageSizeSelector={[20, 50, 100]}
          />
        </div>
      </div>
    </div>
  );
}
