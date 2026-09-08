import { useEffect, useRef, useState, useCallback } from "react";
import { AgGridReact } from "@ag-grid-community/react";
import { Button, Card, Form, message } from "antd";
import { FileExcelOutlined, ReloadOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import "ag-grid-enterprise";
import axios from "axios";
import API_ENDPOINTS, { visaStatusList } from "../config";
import VisaFormModal from "./VisaFormModal";
import LcaFormModal from "./LcaFormModal";
import PassportController from "../Passport/PassportController";
import { parseLocalDateSafe, formatDateMDY } from "../Utils/dateFormat";
import {
  MASTER_FIELD_LABELS,
  DETAIL_FIELD_LABELS,
  VISA_CATEGORY_OPTIONS,
  VISA_SUB_CATEGORY_VALUES,
  FILING_TYPE_VALUES,
  FILING_TYPE_LABEL_MAP,
  LCA_EDITABLE_FIELDS,
  VISA_EDITABLE_FIELDS,
} from "./visaConstants";
import "./VisaDetailsList.css";
import { sizeColumnsForHeader } from "../Utils/agGridColumnSizing";
import GridToolbar from "../Utils/GridToolbar";

export default function VisaDetailsList({ preloadedData }) {
  const [rowData, setRowData] = useState([]);
  const [searchText, setSearchText] = useState("");
  const gridRef = useRef(null);
  const [lcaModalData, setLcaModalData] = useState(null);
  const [lcaForm] = Form.useForm();
  const [lcaSaving, setLcaSaving] = useState(false);
  const [visaModalData, setVisaModalData] = useState(null);
  const [visaForm] = Form.useForm();
  const [visaSaving, setVisaSaving] = useState(false);
  const [lcaOptions, setLcaOptions] = useState([]);
  const [isNewVisa, setIsNewVisa] = useState(false);
  const [masterRowData, setMasterRowData] = useState(null);
  const isSavingCellRef = useRef(false);
  const pendingChangesRef = useRef({});   // { "visa_<visaId>": rowData, "lca_<lcaId>": rowData }
  const passportRef = useRef(null);
  const [hasPendingChanges, setHasPendingChanges] = useState(false);

  const openLcaModal = (lca) => {
    setLcaModalData(lca);
    lcaForm.setFieldsValue({
      ...lca,
      employmentStartDate: lca?.employmentStartDate ? dayjs(lca.employmentStartDate) : null,
      employmentEndDate:   lca?.employmentEndDate   ? dayjs(lca.employmentEndDate)   : null,
      lcaPostedFromDate:   lca?.lcaPostedFromDate   ? dayjs(lca.lcaPostedFromDate)   : null,
      lcaPostedToDate:     lca?.lcaPostedToDate     ? dayjs(lca.lcaPostedToDate)     : null,
      certifiedDate:       lca?.certifiedDate       ? dayjs(lca.certifiedDate)       : null,
    });
  };

  const handleLcaSave = (values) => {
    const payload = {
      ...values,
      lcaId: lcaModalData?.lcaId ?? 0,
      employmentStartDate: values.employmentStartDate?.format("YYYY-MM-DD") || null,
      employmentEndDate:   values.employmentEndDate?.format("YYYY-MM-DD")   || null,
      lcaPostedFromDate:   values.lcaPostedFromDate?.format("YYYY-MM-DD")   || null,
      lcaPostedToDate:     values.lcaPostedToDate?.format("YYYY-MM-DD")     || null,
      certifiedDate:       values.certifiedDate?.format("YYYY-MM-DD")       || null,
    };
    setLcaSaving(true);
    axios.post(API_ENDPOINTS.saveLCA, payload)
      .then(() => {
        message.success(payload.lcaId === 0 ? "LCA created successfully" : "LCA updated successfully");
        setLcaModalData(null);
        lcaForm.resetFields();
        fetchData();
      })
      .catch(() => message.error("Failed to save LCA. Please try again."))
      .finally(() => setLcaSaving(false));
  };

  const populateVisaForm = (v) => {
    const fields = {
      visaCategory:    v.visaCategory    ?? null,
      visaSubCategory: v.visaSubCategory ?? null,
      filingType:      v.filingType      ?? null,
      filingYear:      v.filingYear      != null ? String(v.filingYear) : null,
      receiptNumber:   v.receiptNumber   ?? null,
      jobTitle:        v.jobTitle        ?? v.lca?.jobTitle      ?? null,
      lcaNumber:       v.lcaNumber       ?? v.lca?.lcaNumber     ?? null,
      socCode:         v.socCode         ?? v.lca?.socCode       ?? null,
      client:          v.client          ?? v.lca?.client        ?? null,
      customer:          v.customer          ?? v.lca?.customer        ?? null,
      jobLocation:     v.jobLocation     ?? v.lca?.jobLocation   ?? null,
      jobLocation2:    v.jobLocation2    ?? v.lca?.jobLocation2  ?? null,
      lcaWage:         v.lcaWage         ?? v.lca?.lcaWage       ?? null,
      status:          v.status          ?? null,
      startDate:       v.startDate       ? dayjs(v.startDate)    : null,
      endDate:         v.endDate         ? dayjs(v.endDate)      : null,
      lastUpdated:     v.lastUpdated     ? dayjs(v.lastUpdated)  : null,
      lcaId:           v.lca?.lcaId      ?? null,
    };
    visaForm.setFieldsValue(fields);
  };

  const openVisaModal = (visa, newVisa = false, masterRow = null) => {
    setIsNewVisa(newVisa);
    setMasterRowData(masterRow);

    const lcasFetch = axios.get(API_ENDPOINTS.getAllLCAs)
      .then((res) => {
        const raw = Array.isArray(res.data) ? res.data
          : Array.isArray(res.data?.data) ? res.data.data
          : [];
        return raw.map((l) => {
          const emp = l.employee || l.visa?.employee;
          const employeeName = emp ? `${emp.firstName || ""} ${emp.lastName || ""}`.trim() : "";
          return {
            value: l.lcaId,
            label: `${employeeName || l.lcaId} — ${l.lcaNumber || ""}`,
            lcaNumber: l.lcaNumber || "",
            lca: l,
          };
        });
      })
      .catch((err) => {
        console.error("Failed to fetch LCAs:", err);
        return [];
      });

    const visaId = visa?.visaId;
    const visaFetch = visaId
      ? axios.get(API_ENDPOINTS.getVisaById(visaId))
          .then((res) => res.data)
          .catch(() => { message.error("Failed to load visa details."); return visa; })
      : Promise.resolve(visa || {});

    // Wait for BOTH calls so lcaOptions are loaded before populateVisaForm sets lcaId
    Promise.all([lcasFetch, visaFetch]).then(([options, visaData]) => {
      // An LCA already attached to a Visa isn't available to pick again —
      // except the one this Visa is currently using, so editing an
      // existing Visa still shows its own LCA as the selected option.
      const currentLcaId = visaData?.lca?.lcaId ?? null;
      const availableOptions = options.filter((opt) => !opt.lca.visa || opt.value === currentLcaId);
      setLcaOptions(availableOptions);
      setVisaModalData(visaData);
      populateVisaForm(visaData);
    });
  };

  const handleVisaSave = (values) => {
    const visaId = visaModalData?.visaId;

    const buildPayload = (id) => ({
      ...(id != null ? { visaId: id } : {}),
      employeeId:      visaModalData?.employeeId ?? null,
      visaCategory:    values.visaCategory    ?? null,
      visaSubCategory: values.visaSubCategory ?? null,
      filingType:      values.filingType      ?? null,
      filingYear:      values.filingYear      ?? null,
      receiptNumber:   values.receiptNumber   ?? visaModalData?.receiptNumber ?? null,
      startDate:     values.startDate?.format("YYYY-MM-DD") || null,
      endDate:       values.endDate?.format("YYYY-MM-DD")   || null,
      // Falls back to the linked LCA's own value whenever neither the form
      // nor the existing visa record has it — so saving backfills the gap
      // onto the visa record itself instead of leaving it null forever.
      jobTitle:      values.jobTitle      ?? visaModalData?.lca?.jobTitle      ?? null,
      lcaNumber:     values.lcaNumber     ?? visaModalData?.lca?.lcaNumber     ?? null,
      socCode:       values.socCode       ?? visaModalData?.lca?.socCode       ?? null,
      client:        values.client        ?? visaModalData?.lca?.client        ?? null,
      customer:        values.customer        ?? visaModalData?.lca?.customer        ?? null,
      jobLocation:   values.jobLocation   ?? visaModalData?.lca?.jobLocation   ?? null,
      jobLocation2:  values.jobLocation2  ?? visaModalData?.lca?.jobLocation2  ?? null,
      lcaWage:       values.lcaWage       ?? visaModalData?.lca?.lcaWage       ?? null,
      status:        values.status        ?? null,
      lca:           values.lcaId != null ? values.lcaId : (visaModalData?.lca?.lcaId ?? null),
      lastUpdated:   new Date().toISOString().split("T")[0],
    });

    setVisaSaving(true);

    if (isNewVisa) {
      const payload = buildPayload(null);
      axios.post(API_ENDPOINTS.createVisa, payload)
        .then(() => {
          message.success("New visa created successfully");
          setVisaModalData(null);
          setIsNewVisa(false);
          visaForm.resetFields();
          fetchData();
        })
        .catch(() => message.error("Failed to create Visa. Please try again."))
        .finally(() => setVisaSaving(false));
    } else {
      if (visaId == null) {
        message.error("No visa ID found. Cannot save.");
        setVisaSaving(false);
        return;
      }
      const payload = buildPayload(visaId);
      axios.put(API_ENDPOINTS.updateVisa(visaId), payload)
        .then(() => {
          message.success("Visa updated successfully");
          setVisaModalData(null);
          visaForm.resetFields();
          fetchData();
        })
        .catch(() => message.error("Failed to save Visa. Please try again."))
        .finally(() => setVisaSaving(false));
    }
  };

  // Shared processor — extracts latest-visa fields (by highest visaId) for every employee row
  const processEmployees = (raw) =>
    Array.isArray(raw) ? raw.map((emp) => {
      const sortedVisas = [...(emp.visas || [])].sort(
        (a, b) => (b.visaId ?? 0) - (a.visaId ?? 0)
      );
      const latestVisa = sortedVisas[0] ?? null;
      const latestLca  = latestVisa?.lca ?? null;

      // Passport fields — support both flat (emp.passportNumber) and
      // nested (emp.passport.passportNumber) shapes from the backend
      const pp = emp.passport ?? null;
      const passportId         = pp?.passportId         ?? emp.passportId         ?? null;
      const passportNumber     = pp?.passportNumber     ?? emp.passportNumber     ?? null;
      // backend field is "expiryDate" on the passport object, but exposed
      // on the immigration row as "passportExpiryDate"
      const passportExpiryDate = pp?.expiryDate         ?? pp?.passportExpiryDate
                               ?? emp.passportExpiryDate ?? null;

      return {
        ...emp,
        employeeName:        emp.employeeName || `${emp.firstName || ""} ${emp.lastName || ""}`.trim(),
        visaCategory:        latestVisa?.visaCategory    ?? emp.visaCategory    ?? null,
        visaSubCategory:     latestVisa?.visaSubCategory ?? null,
        filingType:          latestVisa?.filingType      ?? null,
        filingYear:          latestVisa?.filingYear      ?? null,
        startDate:           latestVisa?.startDate       ?? emp.startDate       ?? null,
        endDate:             latestVisa?.endDate         ?? emp.endDate         ?? null,
        receiptNumber:       latestVisa?.receiptNumber   ?? null,
        lcaNumber:           latestVisa?.lcaNumber       ?? latestLca?.lcaNumber ?? null,
        visaId:              latestVisa?.visaId           ?? null,
        applicationStatus:   latestVisa?.status          ?? emp.applicationStatus ?? null,
        // ── Employment dates (from employee table, fall back to LCA) ──
        employmentStartDate: emp.startDate           ?? null,
        employmentEndDate:   emp.endDate             ?? null,
        // ── Passport ──
        passportId,
        passportNumber,
        passportExpiryDate,
      };
    }) : [];

  useEffect(() => {
    if (Array.isArray(preloadedData)) {
      setRowData(processEmployees(preloadedData));
    } else {
      fetchData();
    }
  }, [preloadedData]);

  const handleSavePendingChanges = () => {
    const entries = Object.values(pendingChangesRef.current);
    if (entries.length === 0) return;

    const today = new Date().toISOString().split("T")[0];
    isSavingCellRef.current = true;

    const calls = entries.map(({ type, visaId, lcaId, row }) => {
      if (type === "lca") {
        const lcaPayload = { ...row.lca, lastUpdated: today };
        return axios.post(API_ENDPOINTS.saveLCA, lcaPayload);
      } else {
        const visaPayload = {
          visaId,
          visaCategory:    row.visaCategory    ?? null,
          visaSubCategory: row.visaSubCategory ?? null,
          filingType:      row.filingType      ?? null,
          filingYear:      row.filingYear      ?? null,
          receiptNumber:   row.receiptNumber   ?? null,
          startDate:       row.startDate       ?? null,
          endDate:         row.endDate         ?? null,
          jobTitle:        row.jobTitle        ?? null,
          lcaNumber:       row.lcaNumber       ?? null,
          socCode:         row.socCode         ?? null,
          client:          row.client          ?? null,
          customer:          row.customer          ?? null,
          jobLocation:     row.jobLocation     ?? null,
          jobLocation2:    row.jobLocation2    ?? null,
          lcaWage:         row.lcaWage         ?? null,
          status:          row.status          ?? null,
          lca:             row.lca?.lcaId      ?? null,
          lastUpdated:     today,
        };
        return axios.put(API_ENDPOINTS.updateVisa(visaId), visaPayload);
      }
    });

    Promise.all(calls)
      .then(() => {
        message.success(`${entries.length} record(s) saved successfully`);
        pendingChangesRef.current = {};
        setHasPendingChanges(false);
        fetchData();
      })
      .catch(() => message.error("One or more saves failed. Please try again."))
      .finally(() => { isSavingCellRef.current = false; });
  };

  // Master-row equivalent of the detail grid's onCellValueChanged (line
  // ~613 below) — edits the same underlying Visa record via the same
  // pendingChangesRef/handleSavePendingChanges save path, so the row
  // doesn't need to be expanded into its detail grid just to fix a typo.
  // Only fields the master row actually carries are editable here — a row
  // with no visaId yet (no visa exists) can't be edited this way, use
  // "Add H1-B" instead. "applicationStatus" is the master row's name for
  // what the visa/detail row calls "status" — translated on the way in.
  const MASTER_VISA_EDITABLE_FIELDS = [
    "visaCategory", "visaSubCategory", "filingType", "filingYear",
    "startDate", "endDate", "lcaNumber", "applicationStatus",
  ];
  const handleMasterCellValueChanged = (params) => {
    if (isSavingCellRef.current) return;
    const row = params.data;
    const visaId = row?.visaId;
    const field = params.colDef.field;
    if (!visaId || !MASTER_VISA_EDITABLE_FIELDS.includes(field)) return;

    const visaRow = {
      visaCategory: row.visaCategory,
      visaSubCategory: row.visaSubCategory,
      filingType: row.filingType,
      filingYear: row.filingYear,
      startDate: row.startDate,
      endDate: row.endDate,
      lcaNumber: row.lcaNumber,
      status: row.applicationStatus,
    };
    pendingChangesRef.current[`visa_${visaId}`] = { type: "visa", visaId, row: visaRow };
    setHasPendingChanges(Object.keys(pendingChangesRef.current).length > 0);
  };

  const fetchData = () => {
    axios
      .get(API_ENDPOINTS.getAllEmployeesImmigration)
      .then((response) => {
        setRowData(processEmployees(response.data));
      })
      .catch((error) => {
        console.error("API Fetch Error:", error);
        setRowData([]);
      });
  };

  const handleSearchInputChange = (event) => {
    setSearchText(event.target.value);
  };

  const filterData = () => {
    if (!searchText) return rowData;
    return rowData.filter((row) =>
      Object.values(row).some((value) =>
        String(value).toLowerCase().includes(searchText.toLowerCase())
      )
    );
  };

  const onBtnExportDataAsExcel = useCallback(() => {
    if (gridRef.current) {
      gridRef.current.exportDataAsExcel();
    }
  }, []);

  const excelStyles = [
    {
      id: "cell",
      alignment: { vertical: "Center" },
    },
    {
      id: "darkGreyBackground",
      interior: { color: "#E7E4EC", pattern: "Solid" },
      font: { fontName: "Calibri Light", color: "#000000" },
    },
    {
      id: "blueUnderline",
      font: { fontName: "Calibri Light", color: "#0000EE" },
    },
  ];

  const cellClassRules = {
    darkGreyBackground: (params) =>
      params.node?.rowIndex !== undefined && params.node.rowIndex % 2 === 1,
  };

  const GREEN_STATUSES  = new Set(["completed", "approved", "active", "certified", "valid", "success"]);
  const RED_STATUSES    = new Set(["expired", "revoked", "rejected", "denied", "inactive", "terminated"]);
  const ORANGE_STATUSES = new Set(["pending", "rfe", "in progress", "in process", "processing", "on hold", "bench"]);

  const statusCellStyle = (params) => {
    const val = String(params.value || "").toLowerCase().trim();
    if (GREEN_STATUSES.has(val))  return { color: "#389e0d", fontWeight: 600 };
    if (RED_STATUSES.has(val))    return { color: "#cf1322", fontWeight: 600 };
    if (ORANGE_STATUSES.has(val)) return { color: "#d46b08", fontWeight: 600 };
    return null;
  };

  const columnDefs = [
    {
      headerName: "#",
      valueGetter: (params) => params.node.rowIndex + 1,
      width: 120, minWidth: 120, maxWidth: 120,
      pinned: "left", sortable: false, filter: false, editable: false,
      suppressSizeToFit: true,
      cellStyle: { textAlign: "center", fontWeight: 500 },
      headerClass: "ag-center-cols",
      cellClassRules,
    },
    // ── Pinned: Full Name ──
    {
      field: "employeeName",
      headerName: MASTER_FIELD_LABELS.employeeName,
      pinned: "left",
      filter: "agSetColumnFilter",
      cellRenderer: "agGroupCellRenderer",
      cellClassRules: { ...cellClassRules, blueUnderline: () => false },
      onCellClicked: (params) => {
        params.node.setExpanded(!params.node.expanded);
      },
      cellStyle: { cursor: "pointer" },
    },
    { field: "companyName",         headerName: MASTER_FIELD_LABELS.companyName,        filter: "agSetColumnFilter",  cellClassRules },
    // ── Visible columns (per requested order) ──
    { field: "status",              headerName: MASTER_FIELD_LABELS.status,             filter: "agSetColumnFilter",  cellClassRules, cellStyle: statusCellStyle },
    { field: "visaCategory",        headerName: MASTER_FIELD_LABELS.visaCategory,       filter: "agSetColumnFilter",  cellClassRules,
      editable: (params) => !!params.data?.visaId,
      cellEditor: "agSelectCellEditor",
      cellEditorParams: { values: VISA_CATEGORY_OPTIONS.map((o) => o.value) },
    },
    { field: "receiptNumber",       headerName: MASTER_FIELD_LABELS.receiptNumber,      filter: "agSetColumnFilter",  cellClassRules,
      cellRenderer: (params) => {
        const receiptNum = params.value;
        if (!receiptNum) return "";
        return (
          <span
            style={{ color: "#1677ff", cursor: "pointer", textDecoration: "underline" }}
            onClick={() => openVisaModal(params.data, false, params.data)}
          >
            {receiptNum}
          </span>
        );
      },
    },
    { field: "employmentType",      headerName: MASTER_FIELD_LABELS.employmentType,     filter: "agSetColumnFilter",  cellClassRules, hide: true },
    { field: "employeeType",        headerName: MASTER_FIELD_LABELS.employeeType,       filter: "agSetColumnFilter",  cellClassRules, hide: true },
    { field: "applicationStatus",   headerName: MASTER_FIELD_LABELS.applicationStatus,  filter: "agSetColumnFilter",  cellClassRules, cellStyle: statusCellStyle,
      editable: (params) => !!params.data?.visaId,
      cellEditor: "agSelectCellEditor",
      cellEditorParams: { values: visaStatusList.map((o) => o.value) },
    },
    {
      field: "paf",
      headerName: MASTER_FIELD_LABELS.paf,
      filter: "agSetColumnFilter",
      cellClassRules,
      cellRenderer: (params) => {
        if (!params.value) return "";
        return (
          <a href={params.value} target="_blank" rel="noopener noreferrer"
            style={{ color: "#1677ff", textDecoration: "underline" }}>
            View PAF
          </a>
        );
      },
    },
    { field: "i9",                  headerName: MASTER_FIELD_LABELS.i9,                filter: "agSetColumnFilter",  cellClassRules, cellStyle: statusCellStyle },
    { field: "everifyStatus",       headerName: MASTER_FIELD_LABELS.everifyStatus,      filter: "agSetColumnFilter",  cellClassRules, cellStyle: statusCellStyle },
    { field: "startDate",           headerName: MASTER_FIELD_LABELS.startDate,          filter: "agSetColumnFilter", cellClassRules,
      editable: (params) => !!params.data?.visaId,
      valueFormatter: (params) => formatDateMDY(params.value),
    },
    { field: "endDate",             headerName: MASTER_FIELD_LABELS.endDate,            filter: "agSetColumnFilter", cellClassRules,
      editable: (params) => !!params.data?.visaId,
      valueFormatter: (params) => formatDateMDY(params.value),
    },
    { field: "employmentStartDate", headerName: MASTER_FIELD_LABELS.employmentStartDate, filter: "agSetColumnFilter", cellClassRules, valueFormatter: (params) => formatDateMDY(params.value) },
    { field: "employmentEndDate",   headerName: MASTER_FIELD_LABELS.employmentEndDate,   filter: "agSetColumnFilter", cellClassRules, valueFormatter: (params) => formatDateMDY(params.value) },
    { field: "filingType",          headerName: MASTER_FIELD_LABELS.filingType,         filter: "agSetColumnFilter",  cellClassRules,
      valueFormatter: (p) => FILING_TYPE_LABEL_MAP[p.value] ?? p.value ?? "",
      editable: (params) => !!params.data?.visaId,
      cellEditor: "agSelectCellEditor",
      cellEditorParams: { values: FILING_TYPE_VALUES },
    },
    { field: "visaSubCategory",     headerName: MASTER_FIELD_LABELS.visaSubCategory,    filter: "agSetColumnFilter",  cellClassRules,
      editable: (params) => !!params.data?.visaId,
      cellEditor: "agSelectCellEditor",
      cellEditorParams: { values: VISA_SUB_CATEGORY_VALUES },
    },
    { field: "filingYear",          headerName: MASTER_FIELD_LABELS.filingYear,         filter: "agSetColumnFilter",  cellClassRules,
      editable: (params) => !!params.data?.visaId,
    },
    { field: "emailId",             headerName: MASTER_FIELD_LABELS.emailId,            filter: "agSetColumnFilter",  cellClassRules: { ...cellClassRules, blueUnderline: () => true } },
    { field: "dob",                 headerName: MASTER_FIELD_LABELS.dob,               filter: "agSetColumnFilter", cellClassRules, valueFormatter: (params) => formatDateMDY(params.value) },
    { field: "passportNumber",      headerName: MASTER_FIELD_LABELS.passportNumber,     filter: "agSetColumnFilter",  cellClassRules,
      cellRenderer: (params) => {
        const passNum = params.value;
        if (!passNum) return "";
        const passportId  = params.data?.passportId;
        const employeeId  = params.data?.employeeId;
        return (
          <span
            style={{ color: "#1677ff", cursor: "pointer", textDecoration: "underline" }}
            onClick={() => {
              const fetch = passportId
                ? axios.get(API_ENDPOINTS.getPassportById(passportId)).then((res) => res.data)
                : axios.get(API_ENDPOINTS.getPassportsByEmployee(employeeId)).then((res) => {
                    const list = Array.isArray(res.data) ? res.data : [];
                    return list.find((p) => p.passportNumber === passNum) || list[0] || null;
                  });

              fetch
                .then((passport) => {
                  if (passport && passportRef.current) {
                    passportRef.current.openEdit(passport);
                  } else {
                    message.warning("Passport record not found");
                  }
                })
                .catch(() => message.error("Failed to load passport details"));
            }}
          >
            {passNum}
          </span>
        );
      },
    },
    { field: "passportExpiryDate",  headerName: MASTER_FIELD_LABELS.passportExpiryDate, filter: "agSetColumnFilter", cellClassRules,
      valueFormatter: (params) => {
        const d = parseLocalDateSafe(params.value);
        return d ? d.toLocaleDateString("en-US", { year: "numeric", month: "2-digit", day: "2-digit" }) : (params.value || "");
      },
      cellStyle: (params) => {
        const expiry = parseLocalDateSafe(params.value);
        if (!expiry) return null;
        const today = new Date();
        const daysLeft = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
        if (daysLeft < 0)   return { color: "#cf1322", fontWeight: 600 }; // expired — red
        if (daysLeft <= 90) return { color: "#d46b08", fontWeight: 600 }; // expiring within 90 days — orange
        return null;
      },
    },
    { field: "location",            headerName: MASTER_FIELD_LABELS.location,           filter: "agSetColumnFilter",  cellClassRules },
    { field: "approvedDate",        headerName: MASTER_FIELD_LABELS.approvedDate,       filter: "agSetColumnFilter", cellClassRules, valueFormatter: (params) => formatDateMDY(params.value) },
    { field: "arrivalDate",         headerName: MASTER_FIELD_LABELS.arrivalDate,        filter: "agSetColumnFilter", cellClassRules, valueFormatter: (params) => formatDateMDY(params.value) },
    { field: "visaStatus",          headerName: MASTER_FIELD_LABELS.visaStatus,         filter: "agSetColumnFilter",  cellClassRules, cellStyle: statusCellStyle },
    

    { field: "documentStatus",      headerName: MASTER_FIELD_LABELS.documentStatus,     filter: "agSetColumnFilter",  cellClassRules, cellStyle: statusCellStyle },
    { field: "lcaNumber",           headerName: MASTER_FIELD_LABELS.lcaNumber,          filter: "agSetColumnFilter",  cellClassRules,
      editable: (params) => !!params.data?.visaId,
    },
    { field: "phone",               headerName: MASTER_FIELD_LABELS.phone,              filter: "agSetColumnFilter",  cellClassRules },
    // ── Hidden extras (available via Columns panel) ──
    { field: "ssn",                 headerName: MASTER_FIELD_LABELS.ssn,               filter: "agSetColumnFilter",  cellClassRules, hide: true },
    { field: "designation",         headerName: MASTER_FIELD_LABELS.designation,        filter: "agSetColumnFilter",  cellClassRules, hide: true },
    { field: "gender",              headerName: MASTER_FIELD_LABELS.gender,             filter: "agSetColumnFilter",  cellClassRules, hide: true },
    { field: "referredBy",          headerName: MASTER_FIELD_LABELS.referredBy,         filter: "agSetColumnFilter",  cellClassRules, hide: true },
    { field: "country",             headerName: MASTER_FIELD_LABELS.country,            filter: "agSetColumnFilter",  cellClassRules, hide: true },
    { field: "addressLine",         headerName: MASTER_FIELD_LABELS.addressLine,        filter: "agSetColumnFilter",  cellClassRules, hide: true },
    { field: "city",                headerName: MASTER_FIELD_LABELS.city,               filter: "agSetColumnFilter",  cellClassRules, hide: true },
    { field: "state",               headerName: MASTER_FIELD_LABELS.state,              filter: "agSetColumnFilter",  cellClassRules, hide: true },
    { field: "zipCode",             headerName: MASTER_FIELD_LABELS.zipCode,            filter: "agSetColumnFilter",  cellClassRules, hide: true },
    {
      field: "immigrationTypes",
      headerName: MASTER_FIELD_LABELS.immigrationTypes,
      filter: "agSetColumnFilter",
      cellClassRules,
      hide: true,
      valueFormatter: (params) =>
        Array.isArray(params.value) && params.value.length > 0
          ? params.value.join(", ")
          : "",
    },
  ];

  const detailCellRendererParams = {
    template: `
      <div style="padding: 6px 12px 0 12px; background: #f8faff; border-top: 2px solid #1677ff; height: 100%; display: flex; flex-direction: column;">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom: 4px;">
          <span style="font-weight: 600; font-size: 13px; color: #1677ff; letter-spacing: 0.3px;">📋 Visa Table</span>
          <div ref="eToolbar"></div>
        </div>
        <div ref="eDetailGrid" style="flex: 1; min-height: 150px; overflow: hidden;"></div>
      </div>
    `,
    detailGridOptions: {
      columnDefs: [
        {
          headerName: "#",
          valueGetter: (params) => params.node.rowIndex + 1,
          width: 120, minWidth: 120, maxWidth: 120,
          pinned: "left", sortable: false, filter: false, editable: false,
          cellStyle: { textAlign: "center", fontWeight: 500 },
          cellClassRules,
        },
        { field: "visaCategory",    headerName: DETAIL_FIELD_LABELS.visaCategory,    filter: "agSetColumnFilter", editable: true,  cellClassRules,
          cellEditor: "agSelectCellEditor",
          cellEditorParams: { values: VISA_CATEGORY_OPTIONS.map((o) => o.value) },
        },
        { field: "visaSubCategory", headerName: DETAIL_FIELD_LABELS.visaSubCategory, filter: "agSetColumnFilter", editable: true,  cellClassRules,
          cellEditor: "agSelectCellEditor",
          cellEditorParams: { values: VISA_SUB_CATEGORY_VALUES },
        },
        { field: "filingType",      headerName: DETAIL_FIELD_LABELS.filingType,      filter: "agSetColumnFilter", editable: true,  cellClassRules,
          valueFormatter: (p) => FILING_TYPE_LABEL_MAP[p.value] ?? p.value ?? "",
          cellEditor: "agSelectCellEditor",
          cellEditorParams: { values: FILING_TYPE_VALUES },
        },
        { field: "filingYear",      headerName: DETAIL_FIELD_LABELS.filingYear,      filter: "agSetColumnFilter", editable: true,  cellClassRules },
        { field: "receiptNumber",   headerName: DETAIL_FIELD_LABELS.receiptNumber,   filter: "agSetColumnFilter", editable: false, cellClassRules,
          cellRenderer: (params) => {
            const receiptNum = params.value;
            if (!receiptNum) return "";
            return (
              <span
                style={{ color: "#1677ff", cursor: "pointer", textDecoration: "underline" }}
                onClick={() => openVisaModal(params.data, false, params.node?.parent?.data ?? {})}
              >
                {receiptNum}
              </span>
            );
          },
        },
        { field: "jobTitle",      headerName: DETAIL_FIELD_LABELS.jobTitle,      filter: "agSetColumnFilter", editable: true, cellClassRules },
        { field: "lcaNumber",     headerName: DETAIL_FIELD_LABELS.lcaNumber,     filter: "agSetColumnFilter", editable: true, cellClassRules,
          cellRenderer: (params) => {
            const lca = params.data?.lca;
            const lcaNum = params.value;
            if (!lcaNum) return "";
            return (
              <span
                style={{ color: "#1677ff", cursor: "pointer", textDecoration: "underline" }}
                onClick={() => openLcaModal(lca || { lcaNumber: lcaNum })}
              >
                {lcaNum}
              </span>
            );
          },
        },
        { field: "lcaCaseNumber", headerName: DETAIL_FIELD_LABELS.lcaCaseNumber, filter: "agSetColumnFilter", editable: true,  cellClassRules },
        { field: "socCode",       headerName: DETAIL_FIELD_LABELS.socCode,       filter: "agSetColumnFilter", editable: true,  cellClassRules },
        { field: "lcaWage",       headerName: DETAIL_FIELD_LABELS.lcaWage,       filter: "agSetColumnFilter", editable: true,  cellClassRules,
          valueFormatter: (params) => params.value != null && params.value !== "" ? `$${Number(params.value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "" },
        { field: "client",       headerName: DETAIL_FIELD_LABELS.client,       filter: "agSetColumnFilter", editable: true, cellClassRules },
        { field: "customer",       headerName: DETAIL_FIELD_LABELS.customer,       filter: "agSetColumnFilter", editable: true, cellClassRules },
        { field: "jobLocation",  headerName: DETAIL_FIELD_LABELS.jobLocation,  filter: "agSetColumnFilter", editable: true, cellClassRules },
        { field: "jobLocation2", headerName: DETAIL_FIELD_LABELS.jobLocation2, filter: "agSetColumnFilter", editable: true, cellClassRules },
        { field: "status",       headerName: DETAIL_FIELD_LABELS.status,       filter: "agSetColumnFilter", editable: true, cellClassRules, cellStyle: statusCellStyle,
          cellEditor: "agSelectCellEditor",
          cellEditorParams: { values: visaStatusList.map((o) => o.value) },
        },
        { field: "startDate",    headerName: DETAIL_FIELD_LABELS.startDate,    filter: "agSetColumnFilter", editable: true, cellClassRules, valueFormatter: (params) => formatDateMDY(params.value) },
        { field: "endDate",      headerName: DETAIL_FIELD_LABELS.endDate,      filter: "agSetColumnFilter", editable: true, cellClassRules, valueFormatter: (params) => formatDateMDY(params.value) },
        { field: "lastUpdated",  headerName: DETAIL_FIELD_LABELS.lastUpdated,  filter: "agSetColumnFilter", editable: false, cellClassRules,
          cellStyle: { backgroundColor: "#f5f5f5", color: "#999", fontStyle: "italic" },
          valueFormatter: (params) => formatDateMDY(params.value) },
      ],
      domLayout: "autoHeight",
      defaultColDef: { minWidth: 100, resizable: true },
      autoSizeStrategy: { type: "fitCellContents" },
      onFirstDataRendered: (params) => params.api.autoSizeAllColumns(),
      excelStyles,
      pagination: false,
      sideBar: {
        toolPanels: [
          {
            id: "columns",
            labelDefault: "Visa Columns",
            labelKey: "columns",
            iconKey: "columns",
            toolPanel: "agColumnsToolPanel",
            toolPanelParams: {
              suppressRowGroups: true,
              suppressValues: true,
              suppressPivots: true,
              suppressPivotMode: true,
            },
          },
        ],
        defaultToolPanel: "",
      },
      stopEditingWhenCellsLoseFocus: true,
      onCellValueChanged: (params) => {
        if (isSavingCellRef.current) return;
        if (params.colDef.field === "lastUpdated") return;

        const row = params.data;
        const visaId = row?.visaId;
        const lcaId  = row?.lca?.lcaId ?? null;

        const LCA_FIELDS  = LCA_EDITABLE_FIELDS;
        const VISA_FIELDS = VISA_EDITABLE_FIELDS;

        if (LCA_FIELDS.includes(params.colDef.field) && lcaId) {
          pendingChangesRef.current[`lca_${lcaId}`] = { type: "lca", lcaId, row };
        } else if (VISA_FIELDS.includes(params.colDef.field) && visaId != null) {
          pendingChangesRef.current[`visa_${visaId}`] = { type: "visa", visaId, row };
        }
        setHasPendingChanges(Object.keys(pendingChangesRef.current).length > 0);
      },
    },
    getDetailRowData: (params) => {
      // Sort by visaId descending so latest visa always appears first in the detail grid
      const visas = [...(params.data.visas || [])].sort((a, b) => (b.visaId ?? 0) - (a.visaId ?? 0)).map((v) => ({
        ...v,
        filingType:    v.filingType      ?? "",
        visaSubCategory: v.visaSubCategory ?? "",
        filingYear:    v.filingYear      ?? "",
        jobTitle:      v.jobTitle              ?? v.lca?.jobTitle      ?? "",
        lcaNumber:     v.lcaNumber             ?? v.lca?.lcaNumber     ?? "",
        lcaCaseNumber: v.lca?.lcaCaseNumber    ?? "",   // ← nested in lca sub-object
        socCode:       v.socCode               ?? v.lca?.socCode       ?? "",
        client:        v.client                ?? v.lca?.client        ?? "",
        customer:        v.customer                ?? v.lca?.customer        ?? "",
        jobLocation:   v.jobLocation           ?? v.lca?.jobLocation   ?? "",
        jobLocation2:  v.jobLocation2          ?? v.lca?.jobLocation2  ?? "",
        lcaWage:       v.lcaWage               ?? v.lca?.lcaWage       ?? "",
        status:        v.status                ?? "",
        lastUpdated:   v.lastUpdated           ?? "",
      }));
      params.successCallback(visas);
    },
  };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <Card className="employeeTableCard" style={{ height: "100%", display: "flex", flexDirection: "column" }}>
        <div className="ag-theme-alpine workforce-container">
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
            {hasPendingChanges && (
              <Button
                type="primary"
                onClick={handleSavePendingChanges}
                style={{ marginLeft: "10px", backgroundColor: "#52c41a", borderColor: "#52c41a" }}
              >
                💾 Save Changes
              </Button>
            )}
          </GridToolbar>
          <div className="ag-grid-wrapper">
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
              columnDefs={sizeColumnsForHeader(columnDefs)}
              stopEditingWhenCellsLoseFocus={true}
              onCellValueChanged={handleMasterCellValueChanged}
              domLayout="normal"
              pagination={true}
              paginationPageSize={100}
              paginationPageSizeSelector={[20, 50, 100]}
              defaultColDef={{
                minWidth: 100,
                maxWidth: 220,
                resizable: true,
                filter: "agSetColumnFilter",
                tooltipShowDelay: 0,
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
              masterDetail={true}
              detailCellRendererParams={detailCellRendererParams}
              getDetailRowHeight={(params) => {
                const rowCount = (params.data?.visas || []).length;
                const ROW_HEIGHT = 42;
                const HEADER_HEIGHT = 40;
                const PADDING = 16;
                const MAX_ROWS = 4;
                const visibleRows = Math.min(rowCount, MAX_ROWS);
                return HEADER_HEIGHT + (visibleRows * ROW_HEIGHT) + PADDING;
              }}
              animateRows={true}
              enableBrowserTooltips={true}
              popupParent={document.body}
              excelStyles={excelStyles}
            />
          </div>
        </div>
      </Card>

      <LcaFormModal
        open={!!lcaModalData}
        isNew={false}
        lcaData={lcaModalData}
        form={lcaForm}
        saving={lcaSaving}
        onCancel={() => { setLcaModalData(null); lcaForm.resetFields(); }}
        onSave={handleLcaSave}
      />
      <VisaFormModal
        open={!!visaModalData}
        isNew={isNewVisa}
        visaData={visaModalData}
        lcaOptions={lcaOptions}
        form={visaForm}
        saving={visaSaving}
        onCancel={() => {
          setVisaModalData(null);
          setIsNewVisa(false);
          setMasterRowData(null);
          visaForm.resetFields();
        }}
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
      <PassportController ref={passportRef} onSuccess={fetchData} />
    </div>
  );
}

