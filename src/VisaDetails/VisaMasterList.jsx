import React, { useState, useEffect, useRef, useCallback } from "react";
import { AgGridReact } from "@ag-grid-community/react";
import { Button, Card, Form, Modal, message } from "antd";
import { PlusOutlined, FileExcelOutlined, ReloadOutlined, SaveOutlined, CloseOutlined } from "@ant-design/icons";
import { useLocation } from "react-router-dom";
import dayjs from "dayjs";
import "ag-grid-enterprise";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import axios from "axios";
import API_ENDPOINTS, { visaStatusList } from "../config";
import VisaFormModal from "./VisaFormModal";
import {
  DETAIL_FIELD_LABELS,
  VISA_CATEGORY_OPTIONS,
  VISA_SUB_CATEGORY_VALUES,
  FILING_TYPE_VALUES,
  FILING_TYPE_LABEL_MAP,
} from "./visaConstants";
import { formatCurrency } from "../Utils/CurrencyFormatter";
import { formatDateMDY } from "../Utils/dateFormat";
import { sizeColumnsForHeader } from "../Utils/agGridColumnSizing";
import NotesActionButton from "../Notes/NotesActionButton";
import NotesModal from "../Notes/NotesModal";
import { buildRowActions } from "../Notes/rowActions";
import GridToolbar from "../Utils/GridToolbar";

// Mirrors the exact predicates ImmigrationDashboard.jsx uses to compute its
// feed card counts, so "Review all" always lands on a grid whose row count
// matches the number shown on the card it was clicked from.
const DAY_MS = 24 * 60 * 60 * 1000;
const DASHBOARD_FILTER_LABELS = { approved: "Approved", pending: "Pending / RFE", expiring: "Expiring in 90 Days" };
const matchesDashboardFilter = (visa, dashboardFilter) => {
  if (!dashboardFilter) return true;
  if (dashboardFilter === "approved") return visa.status === "Approved";
  if (dashboardFilter === "pending") return ["Submitted", "RFE", "In Progress"].includes(visa.status);
  if (dashboardFilter === "expiring") {
    if (!visa.endDate) return false;
    const [y, m, d] = visa.endDate.split("-").map(Number);
    if (!y || !m) return false;
    const end = new Date(y, m - 1, d || 1);
    const today = new Date();
    const in90Days = new Date(today.getTime() + 90 * DAY_MS);
    return end >= today && end <= in90Days;
  }
  return true;
};

const VisaMasterList = () => {
  const gridRef = useRef(null);
  const location = useLocation();
  const [searchText, setSearchText] = useState("");
  const [dashboardFilter, setDashboardFilter] = useState(location.state?.dashboardFilter || null);
  const [rowData, setRowData] = useState([]);

  // Re-syncs if the user navigates here again with a different card's
  // filter while the component is already mounted (e.g. via back/forward).
  useEffect(() => {
    if (location.state?.dashboardFilter) setDashboardFilter(location.state.dashboardFilter);
  }, [location.state]);
  const [visaModalData, setVisaModalData] = useState(null);
  const [isNewVisa, setIsNewVisa] = useState(false);
  const [visaForm] = Form.useForm();
  const [visaSaving, setVisaSaving] = useState(false);
  const [employeeOptions, setEmployeeOptions] = useState([]);
  const [lcaOptions, setLcaOptions] = useState([]);
  const [modifiedRows, setModifiedRows] = useState({});

  useEffect(() => {
    fetch(API_ENDPOINTS.getEmployees)
      .then((res) => res.json())
      .then((data) => {
        const opts = Array.isArray(data) ? data.map((emp) => ({
          value: emp.employeeId,
          label: emp.name || `${emp.firstName || ""} ${emp.lastName || ""}`.trim(),
        })) : [];
        setEmployeeOptions(opts);
      })
      .catch(() => setEmployeeOptions([]));
  }, []);

  // currentLcaId: the LCA already assigned to the Visa being edited (if
  // any) — kept selectable even though it's "used" so editing an existing
  // Visa doesn't lose its own LCA out of the dropdown.
  const fetchLcaOptions = (currentLcaId = null) => {
    axios.get(API_ENDPOINTS.getAllLCAs)
      .then((res) => {
        const raw = Array.isArray(res.data) ? res.data
          : Array.isArray(res.data?.data) ? res.data.data
          : [];
        // An LCA already attached to a Visa isn't available to pick again.
        const available = raw.filter((l) => !l.visa || l.lcaId === currentLcaId);
        setLcaOptions(available.map((l) => {
          const emp = l.employee || l.visa?.employee;
          const employeeName = emp ? `${emp.firstName || ""} ${emp.lastName || ""}`.trim() : "";
          return {
            value: l.lcaId,
            label: `${employeeName || l.lcaId} — ${l.lcaNumber || ""}`,
            lcaNumber: l.lcaNumber || "",
            lca: l,
          };
        }));
      })
      .catch(() => setLcaOptions([]));
  };

  const getEmployeeName = (visa) => {
    const emp = visa.employee;
    if (!emp) return "";
    return `${emp.firstName || ""} ${emp.lastName || ""}`.trim();
  };

  const fetchData = () => {
    axios
      .get(API_ENDPOINTS.getAllVisas)
      .then((response) => {
        const raw = Array.isArray(response.data) ? response.data
          : Array.isArray(response.data?.data) ? response.data.data
          : [];
        setRowData(raw.map((visa) => ({ ...visa, employeeName: getEmployeeName(visa) })));
      })
      .catch((error) => {
        console.error("Error fetching Visa data:", error);
        setRowData([]);
      });
  };

  useEffect(() => {
    fetchData();
  }, []);

  const [noteModalRow, setNoteModalRow] = useState(null);

  const handleArchiveVisa = (row) => {
    axios
      .put(API_ENDPOINTS.updateVisa(row.visaId), { ...row, status: "Archived" })
      .then(() => {
        message.success("Visa archived");
        fetchData();
      })
      .catch(() => message.error("Failed to archive visa. Please try again."));
  };

  const handleDeleteVisa = (row) => {
    Modal.confirm({
      title: `Delete visa "${row.lcaNumber || row.visaId}"?`,
      content: "This permanently removes this visa record. This can't be undone.",
      okText: "Delete",
      okType: "danger",
      cancelText: "Cancel",
      onOk: () =>
        axios
          .delete(API_ENDPOINTS.deleteVisa(row.visaId))
          .then(() => {
            message.success("Visa deleted");
            fetchData();
          })
          .catch(() => message.error("Failed to delete visa. Please try again.")),
    });
  };

  const handleSearchInputChange = (event) => {
    setSearchText(event.target.value);
  };

  const filterData = () => {
    const dashboardFiltered = dashboardFilter
      ? rowData.filter((row) => matchesDashboardFilter(row, dashboardFilter))
      : rowData;
    if (!searchText) return dashboardFiltered;
    return dashboardFiltered.filter((row) =>
      Object.values(row).some((value) =>
        typeof value !== "object" && String(value).toLowerCase().includes(searchText.toLowerCase())
      )
    );
  };

  const onBtnExportDataAsExcel = useCallback(() => {
    if (gridRef.current) {
      gridRef.current.exportDataAsExcel();
    }
  }, []);

  const openNewVisaModal = () => {
    fetchLcaOptions();
    setIsNewVisa(true);
    visaForm.resetFields();
    setVisaModalData({});
  };

  // Left-nav "Create > Immigration > Visa" links here with ?new=1 to land
  // straight on the add-visa modal instead of just the grid.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("new") === "1") {
      openNewVisaModal();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openEditVisaModal = (visa) => {
    fetchLcaOptions(visa?.lca?.lcaId ?? null);
    setIsNewVisa(false);
    setVisaModalData(visa);
    visaForm.setFieldsValue({
      ...visa,
      employeeId: visa?.employee?.employeeId ?? null,
      filingYear: visa.filingYear != null ? String(visa.filingYear) : null,
      // Fall back to the linked LCA's own values whenever the visa record
      // itself was never stamped with them (e.g. lcaWage often lags behind
      // since it isn't part of the form the LCA-picker auto-fills at
      // creation time) — otherwise these show blank despite the LCA
      // clearly having the data.
      jobTitle:     visa?.jobTitle     ?? visa?.lca?.jobTitle     ?? null,
      lcaNumber:    visa?.lcaNumber    ?? visa?.lca?.lcaNumber    ?? null,
      socCode:      visa?.socCode      ?? visa?.lca?.socCode      ?? null,
      client:       visa?.client       ?? visa?.lca?.client       ?? null,
      customer:     visa?.customer     ?? visa?.lca?.customer     ?? null,
      jobLocation:  visa?.jobLocation  ?? visa?.lca?.jobLocation  ?? null,
      jobLocation2: visa?.jobLocation2 ?? visa?.lca?.jobLocation2 ?? null,
      lcaWage:      visa?.lcaWage      ?? visa?.lca?.lcaWage      ?? null,
      startDate:    visa?.startDate    ? dayjs(visa.startDate)    : null,
      endDate:      visa?.endDate      ? dayjs(visa.endDate)      : null,
      approvedDate: visa?.approvedDate ? dayjs(visa.approvedDate) : null,
      lcaId:     visa?.lca?.lcaId ?? null,
    });
  };

  const handleVisaSave = (values) => {
    const visaId = visaModalData?.visaId;
    const payload = {
      ...(isNewVisa ? {} : { visaId }),
      employeeId:      values.employeeId ?? visaModalData?.employee?.employeeId ?? null,
      visaCategory:    values.visaCategory    ?? null,
      visaSubCategory: values.visaSubCategory ?? null,
      filingType:      values.filingType      ?? null,
      filingYear:      values.filingYear      ?? null,
      receiptNumber:   values.receiptNumber   ?? visaModalData?.receiptNumber ?? null,
      startDate:       values.startDate?.format("YYYY-MM-DD") || null,
      endDate:         values.endDate?.format("YYYY-MM-DD")   || null,
      approvedDate:    values.approvedDate?.format("YYYY-MM-DD") || null,
      // Falls back to the linked LCA's own value whenever neither the form
      // nor the existing visa record has it — so saving backfills the gap
      // onto the visa record itself instead of leaving it null forever.
      jobTitle:        values.jobTitle      ?? visaModalData?.lca?.jobTitle      ?? null,
      lcaNumber:       values.lcaNumber     ?? visaModalData?.lca?.lcaNumber     ?? null,
      socCode:         values.socCode       ?? visaModalData?.lca?.socCode       ?? null,
      client:          values.client        ?? visaModalData?.lca?.client        ?? null,
      customer:          values.customer        ?? visaModalData?.lca?.customer        ?? null,
      jobLocation:     values.jobLocation   ?? visaModalData?.lca?.jobLocation   ?? null,
      jobLocation2:    values.jobLocation2  ?? visaModalData?.lca?.jobLocation2  ?? null,
      lcaWage:         values.lcaWage       ?? visaModalData?.lca?.lcaWage       ?? null,
      status:          values.status        ?? null,
      lca:             values.lcaId != null ? values.lcaId : (visaModalData?.lca?.lcaId ?? null),
      lastUpdated:     new Date().toISOString().split("T")[0],
    };

    setVisaSaving(true);
    const request = isNewVisa
      ? axios.post(API_ENDPOINTS.createVisa, payload)
      : axios.put(API_ENDPOINTS.updateVisa(visaId), payload);

    request
      .then(() => {
        message.success(isNewVisa ? "Visa created successfully" : "Visa updated successfully");
        setVisaModalData(null);
        visaForm.resetFields();
        fetchData();
      })
      .catch(() => message.error("Failed to save Visa. Please try again."))
      .finally(() => setVisaSaving(false));
  };

  // Inline cell editing — same modifiedRows/Save-Cancel pattern as
  // ProjectsList.jsx/CustomerDetails.jsx/LCADetails.jsx. rowData already
  // carries the full Visa object per row, so PUTting the edited row back
  // as-is is safe (VisaService#updateVisa is a partial/null-safe update).
  const onCellValueChanged = (params) => {
    const visaId = params.data?.visaId;
    if (visaId === undefined || visaId === null) return;
    setModifiedRows((prev) => ({ ...prev, [visaId]: params.data }));
  };

  const handleSaveChanges = () => {
    const rows = Object.values(modifiedRows);
    if (rows.length === 0) return;
    Promise.all(rows.map((row) => axios.put(API_ENDPOINTS.updateVisa(row.visaId), row)))
      .then(() => {
        setModifiedRows({});
        fetchData();
      })
      .catch(() => message.error("Failed to save changes. Please try again."));
  };

  const handleCancelChanges = () => {
    setModifiedRows({});
    fetchData();
  };

  const cellClassRules = {
    darkGreyBackground: (params) => params.node?.rowIndex !== undefined && params.node.rowIndex % 2 === 1,
  };

  const columnDefs = [
    {
      colId: "rowNum",
      headerName: "#",
      valueGetter: (params) => params.node.rowIndex + 1,
      width: 120, minWidth: 120, maxWidth: 120,
      pinned: "left", sortable: false, filter: false, editable: false,
      suppressSizeToFit: true,
      cellStyle: { textAlign: "center", fontWeight: 500 },
      headerClass: "ag-center-cols",
      cellClassRules,
    },
    {
      colId: "receiptNumber",
      field: "receiptNumber",
      headerName: DETAIL_FIELD_LABELS.receiptNumber,
      pinned: "left",
      filter: "agSetColumnFilter",
      cellClassRules: { ...cellClassRules, blueUnderline: () => true },
      cellRenderer: (params) => {
        if (!params.value) return "";
        return (
          <span style={{ cursor: "pointer" }} onClick={() => openEditVisaModal(params.data)}>
            {params.value}
          </span>
        );
      },
    },
    { colId: "employeeName", field: "employeeName", headerName: "Employee Name", filter: "agSetColumnFilter", cellClassRules, editable: false },
    { colId: "visaCategory", field: "visaCategory", headerName: DETAIL_FIELD_LABELS.visaCategory, filter: "agSetColumnFilter", cellClassRules,
      cellEditor: "agSelectCellEditor",
      cellEditorParams: { values: VISA_CATEGORY_OPTIONS.map((o) => o.value) },
    },
    { colId: "visaSubCategory", field: "visaSubCategory", headerName: DETAIL_FIELD_LABELS.visaSubCategory, filter: "agSetColumnFilter", cellClassRules,
      cellEditor: "agSelectCellEditor",
      cellEditorParams: { values: VISA_SUB_CATEGORY_VALUES },
    },
    { colId: "filingType", field: "filingType", headerName: DETAIL_FIELD_LABELS.filingType, filter: "agSetColumnFilter", cellClassRules,
      valueFormatter: (p) => FILING_TYPE_LABEL_MAP[p.value] ?? p.value ?? "",
      cellEditor: "agSelectCellEditor",
      cellEditorParams: { values: FILING_TYPE_VALUES },
    },
    { colId: "filingYear", field: "filingYear", headerName: DETAIL_FIELD_LABELS.filingYear, filter: "agSetColumnFilter", cellClassRules },
    { colId: "status", field: "status", headerName: DETAIL_FIELD_LABELS.status, filter: "agSetColumnFilter", cellClassRules,
      cellEditor: "agSelectCellEditor",
      cellEditorParams: { values: visaStatusList.map((o) => o.value) },
    },
    { colId: "jobTitle", field: "jobTitle", headerName: DETAIL_FIELD_LABELS.jobTitle, filter: "agSetColumnFilter", cellClassRules },
    { colId: "lcaNumber", field: "lcaNumber", headerName: DETAIL_FIELD_LABELS.lcaNumber, filter: "agSetColumnFilter", cellClassRules },
    { colId: "socCode", field: "socCode", headerName: DETAIL_FIELD_LABELS.socCode, filter: "agSetColumnFilter", cellClassRules },
    {
      colId: "lcaWage", field: "lcaWage", headerName: DETAIL_FIELD_LABELS.lcaWage, filter: "agSetColumnFilter", cellClassRules,
      valueFormatter: (params) => params.value != null ? formatCurrency(params.value) : "",
    },
    { colId: "client", field: "client", headerName: DETAIL_FIELD_LABELS.client, filter: "agSetColumnFilter", cellClassRules },
    { colId: "customer", field: "customer", headerName: DETAIL_FIELD_LABELS.customer, filter: "agSetColumnFilter", cellClassRules },
    { colId: "jobLocation", field: "jobLocation", headerName: DETAIL_FIELD_LABELS.jobLocation, filter: "agSetColumnFilter", cellClassRules },
    { colId: "jobLocation2", field: "jobLocation2", headerName: DETAIL_FIELD_LABELS.jobLocation2, filter: "agSetColumnFilter", cellClassRules, hide: true },
    { colId: "startDate", field: "startDate", headerName: DETAIL_FIELD_LABELS.startDate, filter: "agSetColumnFilter", cellClassRules, valueFormatter: (params) => formatDateMDY(params.value) },
    { colId: "endDate", field: "endDate", headerName: DETAIL_FIELD_LABELS.endDate, filter: "agSetColumnFilter", cellClassRules, valueFormatter: (params) => formatDateMDY(params.value) },
    { colId: "approvedDate", field: "approvedDate", headerName: DETAIL_FIELD_LABELS.approvedDate, filter: "agSetColumnFilter", cellClassRules, valueFormatter: (params) => formatDateMDY(params.value) },
    { colId: "lastUpdated", field: "lastUpdated", headerName: DETAIL_FIELD_LABELS.lastUpdated, filter: "agSetColumnFilter", cellClassRules, editable: false, valueFormatter: (params) => formatDateMDY(params.value) },
    {
      colId: "action",
      headerName: "Action",
      pinned: "right",
      sortable: false,
      filter: false,
      editable: false,
      cellClassRules,
      cellRenderer: (params) => {
        if (!params.data) return null;
        const row = params.data;
        return (
          <NotesActionButton
            onOpenNotes={() => setNoteModalRow(row)}
            extraActions={buildRowActions({
              onArchive: () => handleArchiveVisa(row),
              onDelete: () => handleDeleteVisa(row),
              entityType: "Visa",
              entityId: row.visaId,
              entityLabel: row.lcaNumber,
            })}
          />
        );
      },
    },
  ];

  const columnDefsSized = sizeColumnsForHeader(columnDefs);

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div className="ag-theme-alpine workforce-container">
        <Card className="employeeTableCard" style={{ height: "100%", display: "flex", flexDirection: "column" }}>
          <GridToolbar className="workforce-search-container">
            <Button
              type="default"
              icon={<ReloadOutlined />}
              onClick={fetchData}
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
            {dashboardFilter && (
              <span
                style={{
                  marginLeft: 10,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  background: "#e6f4ff",
                  color: "#1677ff",
                  padding: "4px 10px",
                  borderRadius: 16,
                  fontSize: 13,
                }}
              >
                Filter: {DASHBOARD_FILTER_LABELS[dashboardFilter]}
                <CloseOutlined style={{ cursor: "pointer", fontSize: 11 }} onClick={() => setDashboardFilter(null)} />
              </span>
            )}
            <Button
              type="primary"
              onClick={openNewVisaModal}
              style={{ marginLeft: "10px" }}
            >
              <PlusOutlined /> Add New Visa
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
          </GridToolbar>
          <div className="workforce-grid-wrapper" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
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
                try { params.api.autoSizeAllColumns(); } catch (e) {}
              }}
              autoSizeStrategy={{ type: "fitCellContents" }}
              rowHeight={48}
              rowData={filterData()}
              columnDefs={columnDefsSized}
              getRowId={(params) => String(params.data.visaId)}
              onCellValueChanged={onCellValueChanged}
              stopEditingWhenCellsLoseFocus={true}
              defaultColDef={{
                resizable: true,
                filter: "agSetColumnFilter",
                minWidth: 100,
                maxWidth: 220,
                editable: true,
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
                      suppressRowGroups: true,
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
              pagination={true}
              paginationPageSize={100}
              paginationPageSizeSelector={[20, 50, 100]}
              domLayout="normal"
              enableBrowserTooltips={true}
              popupParent={document.body}
            />
          </div>
        </Card>
      </div>

      <VisaFormModal
        open={!!visaModalData}
        isNew={isNewVisa}
        visaData={visaModalData}
        lcaOptions={lcaOptions}
        form={visaForm}
        saving={visaSaving}
        showEmployeeSelect={true}
        employeeOptions={employeeOptions}
        onCancel={() => { setVisaModalData(null); visaForm.resetFields(); }}
        onSave={handleVisaSave}
        onLcaChange={(selectedLcaId) => {
          const found = lcaOptions.find((o) => o.value === selectedLcaId);
          const lca = found?.lca;
          // Selecting an LCA auto-fills every field the visa shares with
          // it — previously only lcaNumber was set, leaving job
          // location/SOC code/wage/client/customer blank even though the
          // LCA record already has them.
          visaForm.setFieldsValue({
            lcaNumber: lca?.lcaNumber ?? null,
            jobLocation: lca?.jobLocation ?? null,
            jobLocation2: lca?.jobLocation2 ?? null,
            socCode: lca?.socCode ?? null,
            lcaWage: lca?.lcaWage ?? null,
            client: lca?.client ?? null,
            customer: lca?.customer ?? null,
            jobTitle: lca?.jobTitle ?? null,
          });
        }}
      />
      <NotesModal
        open={!!noteModalRow}
        entityType="Visa"
        entityId={noteModalRow?.visaId}
        title={noteModalRow?.lcaNumber}
        onClose={() => setNoteModalRow(null)}
      />
    </div>
  );
};

export default VisaMasterList;
