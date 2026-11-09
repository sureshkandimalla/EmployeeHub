import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { AgGridReact } from "@ag-grid-community/react";
import { Button, message } from "antd";
import { ReloadOutlined, FileExcelOutlined } from "@ant-design/icons";
import axios from "axios";
import "ag-grid-enterprise";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import API_ENDPOINTS from "../config";
import { formatCurrency } from "../Utils/CurrencyFormatter";
import { formatMonthYear, formatDateMDY } from "../Utils/dateFormat";
import { sizeColumnsForHeader } from "../Utils/agGridColumnSizing";
import { useFilteredTotalsRow } from "../Utils/useFilteredTotalsRow";
import NotesActionButton from "../Notes/NotesActionButton";
import NotesModal from "../Notes/NotesModal";
import GridToolbar from "../Utils/GridToolbar";
import { getCellCopyContextMenuItems } from "../Utils/agGridCellCopy";
import AuthContext from "../Authentication/Context/AuthContext";
import { ROLES } from "../Utils/roleAccess";

const BILL_STATUS_OPTIONS = ["Unpaid", "Partial", "Paid"];

// Standalone "All Bills" list — every bill across every employee, grouped by
// Employee Name (AG Grid row grouping, which also gives free per-employee
// subtotals). There's no vendor on a Bill in the data model (Bills only
// carry employeeId/projectId/invoiceId/assignmentId), so the vendor shown
// per row is looked up via the bill's employee → employee.vendorId, and only
// shown for C2C employees since vendorId is only meaningful there.
export default function AllBills() {
  const gridRef = useRef(null);
  const { user } = useContext(AuthContext);
  const canEditBills = [ROLES.ADMIN, ROLES.HR, ROLES.ACCOUNTING].includes(user?.role);
  const [bills, setBills] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [searchText, setSearchText] = useState("");
  const [loading, setLoading] = useState(false);
  const [noteModalRow, setNoteModalRow] = useState(null);

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      axios.get(API_ENDPOINTS.getAllBills).then((res) => res.data || []),
      axios.get(API_ENDPOINTS.getAllEmployees).then((res) => res.data || []),
      axios.get(API_ENDPOINTS.getAllVendors).then((res) => res.data || []),
    ])
      .then(([billsData, employeesData, vendorsData]) => {
        setBills(billsData);
        setEmployees(employeesData);
        setVendors(vendorsData);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, []);

  const employeesById = useMemo(
    () => Object.fromEntries(employees.map((e) => [e.employeeId, e])),
    [employees],
  );

  const vendorNameById = useMemo(
    () => Object.fromEntries(vendors.map((v) => [v.vendorId, v.vendorCompanyName || v.vendorName])),
    [vendors],
  );

  const rowData = useMemo(
    () =>
      bills.map((bill) => {
        const employee = employeesById[bill.employeeId];
        const employeeName = employee ? `${employee.firstName || ""} ${employee.lastName || ""}`.trim() : "";
        const isC2C = employee?.employeeType?.toUpperCase() === "C2C";
        return {
          ...bill,
          employeeName: employeeName || "Unassigned",
          vendorName: isC2C ? vendorNameById[employee.vendorId] || "" : "",
          // What's still owed on this bill — plain field (not a column
          // valueGetter) so the Total/Filtered Total rows can sum it the
          // same way as every other numeric column.
          balance: (bill.total || 0) - (bill.billPaidAmount || 0) - (bill.discount || 0),
        };
      }),
    [bills, employeesById, vendorNameById],
  );

  const filteredRowData = useMemo(() => {
    if (!searchText) return rowData;
    const q = searchText.toLowerCase();
    return rowData.filter((row) =>
      Object.values(row).some((value) => value != null && String(value).toLowerCase().includes(q)),
    );
  }, [rowData, searchText]);

  const sumBillRows = (rows, label) => ({
    employeeName: label,
    billing: rows.reduce((sum, row) => sum + (row.billing || 0), 0),
    hours: rows.reduce((sum, row) => sum + (row.hours || 0), 0),
    total: rows.reduce((sum, row) => sum + (row.total || 0), 0),
    billPaidAmount: rows.reduce((sum, row) => sum + (row.billPaidAmount || 0), 0),
    discount: rows.reduce((sum, row) => sum + (row.discount || 0), 0),
    balance: rows.reduce((sum, row) => sum + (row.balance || 0), 0),
  });

  // Bottom row: grand total across every bill, regardless of the search box
  // or any AG Grid column filter.
  const pinnedBottomRowData = useMemo(
    () => (rowData.length > 0 ? [sumBillRows(rowData, "Total")] : []),
    [rowData],
  );

  // Top row: same totals, but only over rows currently passing both the
  // search box and every AG Grid column/group filter.
  const { pinnedTopRowData, onModelUpdated } = useFilteredTotalsRow((rows) =>
    sumBillRows(rows, "Filtered Total"),
  );

  const onBtnExportDataAsExcel = () => {
    if (gridRef.current) gridRef.current.exportDataAsExcel({ fileName: "all_bills.xlsx" });
  };

  // Status/Bill PaidAmount/Discount/Comments are the only editable
  // columns (gated by canEditBills below) — this fires only for those.
  // updateBill is a full-replace PUT (see BillsService#updateBill), so the
  // whole row goes back, not just the changed field; the server's own
  // response (not the locally-edited value) is what gets written back into
  // state, since e.g. setting Status to "Paid" server-side auto-fills
  // Bill PaidAmount to the bill's Total if it was still 0.
  const handleCellValueChanged = (params) => {
    const { data } = params;
    const payload = {
      billId: data.billId,
      invoiceId: data.invoiceId,
      projectId: data.projectId,
      assignmentId: data.assignmentId,
      invoiceMonth: data.invoiceMonth,
      billing: data.billing,
      employeeId: data.employeeId,
      hours: data.hours,
      total: data.total,
      billPaidAmount: data.billPaidAmount,
      billDate: data.billDate,
      startDate: data.startDate,
      endDate: data.endDate,
      paymentDate: data.paymentDate,
      status: data.status,
      billType: data.billType,
      discount: data.discount,
      comments: data.comments,
    };
    axios
      .put(API_ENDPOINTS.updateBill(data.billId), payload)
      .then((response) => {
        const updated = response.data;
        setBills((prev) => prev.map((b) => (b.billId === updated.billId ? updated : b)));
        message.success("Bill updated.");
      })
      .catch((error) => {
        message.error("Update failed: " + (error.response?.data?.message || error.message));
        fetchData();
      });
  };

  const cellClassRules = {
    darkGreyBackground: (params) => params.node?.rowIndex !== undefined && params.node.rowIndex % 2 === 1,
  };

  const columnDefs = useMemo(
    () => [
      {
        field: "employeeName",
        headerName: "Employee Name",
        pinned: "left",
        enableRowGroup: true,
        filter: "agSetColumnFilter",
        cellClassRules,
        valueGetter: (params) => params.data?.employeeName,
      },
      { headerName: "Vendor Name", field: "vendorName", filter: "agSetColumnFilter", cellClassRules, valueGetter: (params) => params.data?.vendorName },
      { headerName: "Description", field: "billType", filter: "agSetColumnFilter", cellClassRules, valueGetter: (params) => params.data?.billType },
      {
        headerName: "Invoice Month",
        field: "invoiceMonth",
        filter: "agSetColumnFilter",
        valueFormatter: (params) => formatMonthYear(params.value),
        cellClassRules,
        valueGetter: (params) => params.data?.invoiceMonth,
        filterParams: { valueFormatter: (params) => formatMonthYear(params.value) },
      },
      {
        headerName: "Billing",
        field: "billing",
        filter: "agNumberColumnFilter",
        aggFunc: "sum",
        valueFormatter: (params) => formatCurrency(params.value),
        cellClassRules,
      },
      { headerName: "Hours", field: "hours", filter: "agNumberColumnFilter", aggFunc: "sum", cellClassRules },
      {
        headerName: "Total",
        field: "total",
        filter: "agNumberColumnFilter",
        aggFunc: "sum",
        valueFormatter: (params) => formatCurrency(params.value),
        cellClassRules,
      },
      {
        headerName: "Bill PaidAmount",
        field: "billPaidAmount",
        filter: "agNumberColumnFilter",
        aggFunc: "sum",
        valueFormatter: (params) => formatCurrency(params.value),
        cellClassRules,
        editable: canEditBills,
        cellEditor: "agNumberCellEditor",
      },
      {
        headerName: "Discount",
        field: "discount",
        filter: "agNumberColumnFilter",
        aggFunc: "sum",
        valueFormatter: (params) => formatCurrency(params.value),
        cellClassRules,
        editable: canEditBills,
        cellEditor: "agNumberCellEditor",
      },
      {
        // Not independently editable — it's total minus whatever's already
        // paid/discounted (computed into rowData, not just a column
        // valueGetter, so the Total/Filtered Total rows can sum it too).
        headerName: "Balance",
        field: "balance",
        filter: "agNumberColumnFilter",
        aggFunc: "sum",
        valueFormatter: (params) => formatCurrency(params.value),
        cellClassRules,
      },
      {
        headerName: "Bill Date",
        field: "billDate",
        filter: "agSetColumnFilter",
        cellClassRules,
        valueFormatter: (params) => formatDateMDY(params.value),
        valueGetter: (params) => params.data?.billDate,
        filterParams: { treeList: false, valueFormatter: (params) => formatDateMDY(params.value) },
      },
      {
        headerName: "Start Date",
        field: "startDate",
        filter: "agSetColumnFilter",
        cellClassRules,
        valueFormatter: (params) => formatDateMDY(params.value),
        valueGetter: (params) => params.data?.startDate,
        filterParams: { treeList: false, valueFormatter: (params) => formatDateMDY(params.value) },
      },
      {
        headerName: "End Date",
        field: "endDate",
        filter: "agSetColumnFilter",
        cellClassRules,
        valueFormatter: (params) => formatDateMDY(params.value),
        valueGetter: (params) => params.data?.endDate,
        filterParams: { treeList: false, valueFormatter: (params) => formatDateMDY(params.value) },
      },
      {
        headerName: "Payment Date",
        field: "paymentDate",
        filter: "agSetColumnFilter",
        cellClassRules,
        valueFormatter: (params) => formatDateMDY(params.value),
        valueGetter: (params) => params.data?.paymentDate,
        filterParams: { treeList: false, valueFormatter: (params) => formatDateMDY(params.value) },
      },
      {
        headerName: "Status",
        field: "status",
        filter: "agSetColumnFilter",
        cellClassRules,
        editable: canEditBills,
        cellEditor: "agSelectCellEditor",
        cellEditorParams: { values: BILL_STATUS_OPTIONS },
        valueGetter: (params) => params.data?.status,
        valueSetter: (params) => {
          params.data.status = params.newValue;
          return true;
        },
      },
      {
        headerName: "Comments",
        field: "comments",
        filter: "agTextColumnFilter",
        cellClassRules,
        editable: canEditBills,
      },
      { headerName: "Project Id", field: "projectId", filter: "agSetColumnFilter", cellClassRules, valueGetter: (params) => params.data?.projectId },
      {
        colId: "action",
        headerName: "Action",
        pinned: "right",
        sortable: false,
        filter: false,
        cellClassRules,
        cellRenderer: (params) => {
          if (!params.data) return null;
          // Notes only, deliberately no Archive/Delete here — bills are
          // auto-synced from their invoice (see InvoiceService's
          // syncBillsForInvoice/validateBillStatusForAllInvoices), so
          // editing a bill's own status or removing it independently of
          // its invoice risks reintroducing exactly the invoice/bill
          // desync this app already has a dedicated reconciliation system
          // for. That needs a product decision, not a default action.
          return <NotesActionButton onOpenNotes={() => setNoteModalRow(params.data)} extraActions={[]} />;
        },
      },
    ],
    [canEditBills],
  );

  // sizeColumnsForHeader returns a brand-new array/objects every call; memoize
  // it so AG Grid doesn't see a new columnDefs reference (and reset each
  // column's applied filter) on every re-render — including the one
  // setPinnedTopRowData triggers on every filter change via onModelUpdated.
  const sizedColumnDefs = useMemo(() => sizeColumnsForHeader(columnDefs), [columnDefs]);

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div className="ag-theme-alpine project-List-grid">
        <GridToolbar className="workforce-search-container">
          <Button type="default" icon={<ReloadOutlined />} onClick={fetchData} loading={loading} style={{ marginRight: "10px" }}>
            Refresh
          </Button>
          <input
            type="text"
            placeholder="Search..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
          <Button type="default" icon={<FileExcelOutlined />} onClick={onBtnExportDataAsExcel} style={{ marginLeft: "10px" }}>
            Export to Excel
          </Button>
        </GridToolbar>
        <div className="project-grid-wrapper">
          <AgGridReact
            getContextMenuItems={getCellCopyContextMenuItems}
            enableCellTextSelection={true}
            ensureDomOrder={true}
            ref={gridRef}
            onGridReady={(params) => {
              gridRef.current = params.api;
            }}
            onSortChanged={(params) => params.api.refreshCells({ force: true })}
            onFilterChanged={(params) => params.api.refreshCells({ force: true })}
            onCellValueChanged={handleCellValueChanged}
            onModelUpdated={onModelUpdated}
            onFirstDataRendered={(params) => {
              try {
                params.api.autoSizeAllColumns();
              } catch (e) {}
            }}
            autoSizeStrategy={{ type: "fitCellContents" }}
            rowHeight={48}
            rowData={filteredRowData}
            columnDefs={sizedColumnDefs}
            groupDefaultExpanded={0}
            suppressAggFuncInHeader={true}
            pinnedTopRowData={pinnedTopRowData}
            pinnedBottomRowData={pinnedBottomRowData}
            getRowStyle={(params) =>
              params.node.rowPinned ? { backgroundColor: "#d3f4ff", fontWeight: "bold" } : null
            }
            defaultColDef={{
              minWidth: 100,
              resizable: true,
              filter: "agSetColumnFilter",
              cellClassRules,
            }}
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
            domLayout="normal"
            enableBrowserTooltips={true}
            popupParent={document.body}
            animateRows={true}
            pagination={true}
            paginationPageSize={100}
            paginationPageSizeSelector={[20, 50, 100]}
          />
        </div>
      </div>
      <NotesModal
        open={!!noteModalRow}
        entityType="Bill"
        entityId={noteModalRow?.billId}
        title={noteModalRow?.employeeName}
        onClose={() => setNoteModalRow(null)}
      />
    </div>
  );
}
