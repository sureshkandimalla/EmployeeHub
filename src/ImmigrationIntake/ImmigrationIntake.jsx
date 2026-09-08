import { useEffect, useMemo, useRef, useState } from "react";
import { AgGridReact } from "@ag-grid-community/react";
import { Button, Modal, Form, Input, DatePicker, Select, Row, Col, message } from "antd";
import { PlusOutlined, ReloadOutlined, FileExcelOutlined, SaveOutlined } from "@ant-design/icons";
import axios from "axios";
import "ag-grid-enterprise";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import API_ENDPOINTS, { workAuthorizationList } from "../config";
import { formatCurrency } from "../Utils/CurrencyFormatter";
import { formatDateMDY } from "../Utils/dateFormat";
import { sizeColumnsForHeader } from "../Utils/agGridColumnSizing";
import NotesActionButton from "../Notes/NotesActionButton";
import NotesModal from "../Notes/NotesModal";
import { buildRowActions } from "../Notes/rowActions";
import GridToolbar from "../Utils/GridToolbar";

const MODAL_HEADER_COLOR = "#1677ff";

// Dropdown option lists — reuses the app-wide visa/work-authorization list
// for Visa Status; the rest are dedicated to intake tracking (no existing
// list elsewhere in the app covers these).
const VISA_STATUS_VALUES = workAuthorizationList.map((o) => o.value);
const VISA_SUB_VALUES = ["Cap", "Consular", "COS", "Transfer"];
const FILING_TYPE_VALUES = ["Regular", "Premium", "Consular", "Transfer"];
const APPLICATION_STATUS_VALUES = [
  "Filed",
  "In USCIS Review",
  "RFE Issued",
  "RFE Responded",
  "Approved",
  "Denied",
  "Withdrawn",
  "Archived",
];
const CASE_ASSIGNED_TO_VALUES = ["Attorney", "Internal"];
const FILED_ON_VALUES = ["Online", "Mail", "In-Person"];
const PREMIUM_STATUS_VALUES = ["Not Filed", "Filed with Petition", "Upgraded to Premium", "Nil"];
// A handful of years around today — filing year is always recent, never
// needs the full calendar range a free-text field would allow.
const CURRENT_YEAR = new Date().getFullYear();
const FILING_YEAR_VALUES = Array.from({ length: 6 }, (_, i) => String(CURRENT_YEAR + 2 - i));

// Field labels shared between the grid columns and the create/edit form —
// one source of truth so the two stay in sync.
const FIELD_LABELS = {
  employeeName: "Employee Name",
  caseId: "Case ID",
  visaStatus: "Visa Status (this case)",
  visaSub: "Visa Sub",
  filingType: "Filing Type",
  filingYear: "Filing Year",
  applicationStatus: "Application Status",
  caseAssignedTo: "Case Assigned To",
  filedOn: "Filed On",
  premiumStatus: "Premium Status",
  receiptNumber: "Receipt Number",
  startDate: "Start Date",
  endDate: "End Date",
  lcaTitle: "LCA Title",
  lcaCaseNumber: "LCA Case Number",
  lcaWages: "LCA Wages",
  client: "Client",
  vendor: "Vendor",
  workLocation1: "Work Location 1",
  workLocation2: "Work Location 2",
  caseFiledDate: "Case Filed Date",
  caseRank: "Case Rank",
};

const DATE_FIELDS = ["startDate", "endDate", "caseFiledDate"];

export default function ImmigrationIntake() {
  const gridRef = useRef(null);
  const [rowData, setRowData] = useState([]);
  const [searchText, setSearchText] = useState("");
  const [modifiedRows, setModifiedRows] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const fetchData = () => {
    axios
      .get(API_ENDPOINTS.getAllImmiIntakes)
      .then((response) => setRowData(response.data || []))
      .catch((error) => {
        console.error("Error fetching immigration intake records:", error);
        message.error("Failed to load Immigration Intake records.");
      });
  };

  useEffect(() => {
    fetchData();
    axios
      .get(API_ENDPOINTS.getEmployees)
      .then((response) => setEmployees(response.data || []))
      .catch((error) => console.error("Error fetching employees:", error));
  }, []);

  // Left-nav "Create > Immigration > Immigration Intake" links here with
  // ?new=1 to land straight on the add form instead of just the grid.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("new") === "1") {
      setOpen(true);
    }
  }, []);

  const [noteModalRow, setNoteModalRow] = useState(null);

  const handleArchiveIntake = (row) => {
    axios
      .put(API_ENDPOINTS.updateImmiIntake(row.intakeId), { ...row, applicationStatus: "Archived" })
      .then(() => {
        message.success("Intake record archived");
        fetchData();
      })
      .catch(() => message.error("Failed to archive record. Please try again."));
  };

  const handleDeleteIntake = (row) => {
    Modal.confirm({
      title: `Delete intake record "${row.caseId || row.intakeId}"?`,
      content: "This permanently removes this record. This can't be undone.",
      okText: "Delete",
      okType: "danger",
      cancelText: "Cancel",
      onOk: () =>
        axios
          .delete(API_ENDPOINTS.deleteImmiIntake(row.intakeId))
          .then(() => {
            message.success("Intake record deleted");
            fetchData();
          })
          .catch(() => message.error("Failed to delete record. Please try again.")),
    });
  };

  const employeeOptions = useMemo(
    () => employees.map((e) => ({ value: e.employeeId, label: e.name })),
    [employees],
  );

  const filterData = () => {
    if (!searchText) return rowData;
    return rowData.filter((row) =>
      Object.values(row || {}).some((value) =>
        String(value).toLowerCase().includes(searchText.toLowerCase()),
      ),
    );
  };

  const onCellValueChanged = (params) => {
    const intakeId = params.data?.intakeId;
    if (intakeId === undefined || intakeId === null) return;
    setModifiedRows((prev) => ({ ...prev, [intakeId]: params.data }));
  };

  const saveChanges = () => {
    const rows = Object.values(modifiedRows);
    if (rows.length === 0) return;
    setIsSaving(true);
    Promise.all(rows.map((row) => axios.put(API_ENDPOINTS.updateImmiIntake(row.intakeId), row)))
      .then(() => {
        message.success(`${rows.length} record(s) saved successfully`);
        setModifiedRows({});
        fetchData();
      })
      .catch(() => message.error("One or more records failed to save. Please try again."))
      .finally(() => setIsSaving(false));
  };

  const onBtnExportDataAsExcel = () => {
    if (gridRef.current) gridRef.current.exportDataAsExcel({ fileName: "immigration_intake.xlsx" });
  };

  const openAddForm = () => setOpen(true);

  const closeForm = () => setOpen(false);

  const handleSave = (values) => {
    const employee = employees.find((e) => e.employeeId === values.employeeId);
    const payload = {
      ...values,
      employeeName: employee?.name || "",
      startDate: values.startDate?.format("YYYY-MM-DD") || null,
      endDate: values.endDate?.format("YYYY-MM-DD") || null,
      caseFiledDate: values.caseFiledDate?.format("YYYY-MM-DD") || null,
    };
    setSaving(true);
    axios
      .post(API_ENDPOINTS.createImmiIntake, payload)
      .then(() => {
        message.success("Immigration Intake record created successfully");
        closeForm();
        fetchData();
      })
      .catch(() => message.error("Failed to create record. Please try again."))
      .finally(() => setSaving(false));
  };

  const cellClassRules = {
    darkGreyBackground: (params) => params.node?.rowIndex !== undefined && params.node.rowIndex % 2 === 1,
  };

  const columnDefs = useMemo(
    () => [
      {
        colId: "rowNum",
        headerName: "#",
        valueGetter: (params) => params.node.rowIndex + 1,
        width: 90,
        minWidth: 90,
        maxWidth: 90,
        pinned: "left",
        lockPosition: true,
        suppressMovable: true,
        sortable: false,
        filter: false,
        editable: false,
        suppressSizeToFit: true,
        cellStyle: { textAlign: "center", fontWeight: 500 },
        headerClass: "ag-center-cols",
        cellClassRules,
      },
      {
        field: "employeeName",
        headerName: FIELD_LABELS.employeeName,
        pinned: "left",
        filter: "agSetColumnFilter",
        editable: false,
        cellClassRules,
      },
      { field: "caseId", headerName: FIELD_LABELS.caseId, filter: "agSetColumnFilter", editable: true, cellClassRules },
      {
        field: "visaStatus",
        headerName: FIELD_LABELS.visaStatus,
        filter: "agSetColumnFilter",
        editable: true,
        cellClassRules,
        cellEditor: "agSelectCellEditor",
        cellEditorParams: { values: VISA_STATUS_VALUES },
      },
      {
        field: "visaSub",
        headerName: FIELD_LABELS.visaSub,
        filter: "agSetColumnFilter",
        editable: true,
        cellClassRules,
        cellEditor: "agSelectCellEditor",
        cellEditorParams: { values: VISA_SUB_VALUES },
      },
      {
        field: "filingType",
        headerName: FIELD_LABELS.filingType,
        filter: "agSetColumnFilter",
        editable: true,
        cellClassRules,
        cellEditor: "agSelectCellEditor",
        cellEditorParams: { values: FILING_TYPE_VALUES },
      },
      {
        field: "filingYear",
        headerName: FIELD_LABELS.filingYear,
        filter: "agSetColumnFilter",
        editable: true,
        cellClassRules,
        cellEditor: "agSelectCellEditor",
        cellEditorParams: { values: FILING_YEAR_VALUES },
      },
      {
        field: "applicationStatus",
        headerName: FIELD_LABELS.applicationStatus,
        filter: "agSetColumnFilter",
        editable: true,
        cellClassRules,
        cellEditor: "agSelectCellEditor",
        cellEditorParams: { values: APPLICATION_STATUS_VALUES },
      },
      {
        field: "caseAssignedTo",
        headerName: FIELD_LABELS.caseAssignedTo,
        filter: "agSetColumnFilter",
        editable: true,
        cellClassRules,
        cellEditor: "agSelectCellEditor",
        cellEditorParams: { values: CASE_ASSIGNED_TO_VALUES },
      },
      {
        field: "filedOn",
        headerName: FIELD_LABELS.filedOn,
        filter: "agSetColumnFilter",
        editable: true,
        cellClassRules,
        cellEditor: "agSelectCellEditor",
        cellEditorParams: { values: FILED_ON_VALUES },
      },
      {
        field: "premiumStatus",
        headerName: FIELD_LABELS.premiumStatus,
        filter: "agSetColumnFilter",
        editable: true,
        cellClassRules,
        cellEditor: "agSelectCellEditor",
        cellEditorParams: { values: PREMIUM_STATUS_VALUES },
      },
      { field: "receiptNumber", headerName: FIELD_LABELS.receiptNumber, filter: "agSetColumnFilter", editable: true, cellClassRules },
      { field: "startDate", headerName: FIELD_LABELS.startDate, filter: "agSetColumnFilter", editable: true, cellClassRules, valueFormatter: (params) => formatDateMDY(params.value) },
      { field: "endDate", headerName: FIELD_LABELS.endDate, filter: "agSetColumnFilter", editable: true, cellClassRules, valueFormatter: (params) => formatDateMDY(params.value) },
      { field: "lcaTitle", headerName: FIELD_LABELS.lcaTitle, filter: "agSetColumnFilter", editable: true, cellClassRules },
      { field: "lcaCaseNumber", headerName: FIELD_LABELS.lcaCaseNumber, filter: "agSetColumnFilter", editable: true, cellClassRules },
      {
        field: "lcaWages",
        headerName: FIELD_LABELS.lcaWages,
        filter: "agNumberColumnFilter",
        editable: true,
        cellClassRules,
        valueFormatter: (params) => (params.value != null ? formatCurrency(params.value) : ""),
      },
      { field: "client", headerName: FIELD_LABELS.client, filter: "agSetColumnFilter", editable: true, cellClassRules },
      { field: "vendor", headerName: FIELD_LABELS.vendor, filter: "agSetColumnFilter", editable: true, cellClassRules },
      { field: "workLocation1", headerName: FIELD_LABELS.workLocation1, filter: "agSetColumnFilter", editable: true, cellClassRules },
      { field: "workLocation2", headerName: FIELD_LABELS.workLocation2, filter: "agSetColumnFilter", editable: true, cellClassRules },
      { field: "caseFiledDate", headerName: FIELD_LABELS.caseFiledDate, filter: "agSetColumnFilter", editable: true, cellClassRules, valueFormatter: (params) => formatDateMDY(params.value) },
      { field: "caseRank", headerName: FIELD_LABELS.caseRank, filter: "agNumberColumnFilter", editable: true, cellClassRules },
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
                onArchive: () => handleArchiveIntake(row),
                onDelete: () => handleDeleteIntake(row),
                entityType: "ImmigrationIntake",
                entityId: row.intakeId,
                entityLabel: row.caseId,
              })}
            />
          );
        },
      },
    ],
    [],
  );

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div className="ag-theme-alpine workforce-container">
        <GridToolbar className="workforce-search-container">
          <Button type="default" icon={<ReloadOutlined />} onClick={fetchData} style={{ marginRight: "10px" }}>
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
          {Object.keys(modifiedRows).length > 0 && (
            <Button
              type="primary"
              ghost
              icon={<SaveOutlined />}
              onClick={saveChanges}
              loading={isSaving}
              style={{ marginLeft: "10px" }}
            >
              Save Changes
            </Button>
          )}
          <Button type="primary" icon={<PlusOutlined />} onClick={openAddForm} style={{ marginLeft: "10px" }}>
            Add New Immigration Intake
          </Button>
        </GridToolbar>
        <div className="workforce-grid-wrapper ag-grid-expanded" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
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
            rowData={filterData()}
            getRowId={(params) => String(params.data.intakeId)}
            onCellValueChanged={onCellValueChanged}
            columnDefs={sizeColumnsForHeader(columnDefs)}
            defaultColDef={{
              resizable: true,
              filter: "agSetColumnFilter",
              minWidth: 100,
              maxWidth: 220,
              enableRowGroup: true,
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
            rowGroupPanelShow="always"
            sortable={true}
            pagination={true}
            paginationPageSize={100}
            paginationPageSizeSelector={[20, 50, 100]}
            domLayout="normal"
            enableBrowserTooltips={true}
            popupParent={document.body}
          />
        </div>
      </div>

      <Modal
        title={<span style={{ color: MODAL_HEADER_COLOR, fontWeight: 600 }}>New Immigration Intake</span>}
        open={open}
        onCancel={closeForm}
        width={760}
        destroyOnClose
        afterOpenChange={(isOpen) => {
          if (isOpen) {
            form.resetFields();
            form.setFieldsValue({ caseRank: 1 });
          }
        }}
        styles={{
          header: { borderBottom: `2px solid ${MODAL_HEADER_COLOR}`, paddingBottom: 12 },
          content: { borderTop: `4px solid ${MODAL_HEADER_COLOR}`, borderRadius: 8 },
        }}
        footer={[
          <Button key="cancel" onClick={closeForm}>
            Cancel
          </Button>,
          <Button key="save" type="primary" loading={saving} onClick={() => form.submit()}>
            Create
          </Button>,
        ]}
      >
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item name="employeeId" label="Employee" rules={[{ required: true, message: "Please select an employee" }]}>
                <Select
                  showSearch
                  placeholder="Search employee..."
                  optionFilterProp="label"
                  options={employeeOptions}
                  filterOption={(input, option) => option?.label?.toLowerCase().includes(input.toLowerCase())}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="caseId" label={FIELD_LABELS.caseId}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="visaStatus" label={FIELD_LABELS.visaStatus}>
                <Select allowClear placeholder="Select..." options={VISA_STATUS_VALUES.map((v) => ({ value: v }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="visaSub" label={FIELD_LABELS.visaSub}>
                <Select allowClear placeholder="Select..." options={VISA_SUB_VALUES.map((v) => ({ value: v }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="filingType" label={FIELD_LABELS.filingType}>
                <Select allowClear placeholder="Select..." options={FILING_TYPE_VALUES.map((v) => ({ value: v }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="filingYear" label={FIELD_LABELS.filingYear}>
                <Select allowClear placeholder="Select..." options={FILING_YEAR_VALUES.map((v) => ({ value: v }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="applicationStatus" label={FIELD_LABELS.applicationStatus}>
                <Select
                  allowClear
                  placeholder="Select..."
                  options={APPLICATION_STATUS_VALUES.map((v) => ({ value: v }))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="caseAssignedTo" label={FIELD_LABELS.caseAssignedTo}>
                <Select
                  allowClear
                  placeholder="Select..."
                  options={CASE_ASSIGNED_TO_VALUES.map((v) => ({ value: v }))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="filedOn" label={FIELD_LABELS.filedOn}>
                <Select allowClear placeholder="Select..." options={FILED_ON_VALUES.map((v) => ({ value: v }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="premiumStatus" label={FIELD_LABELS.premiumStatus}>
                <Select
                  allowClear
                  placeholder="Select..."
                  options={PREMIUM_STATUS_VALUES.map((v) => ({ value: v }))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="receiptNumber" label={FIELD_LABELS.receiptNumber}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="caseRank" label={FIELD_LABELS.caseRank}>
                <Input type="number" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="startDate" label={FIELD_LABELS.startDate}>
                <DatePicker style={{ width: "100%" }} format="MM/DD/YYYY" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="endDate" label={FIELD_LABELS.endDate}>
                <DatePicker style={{ width: "100%" }} format="MM/DD/YYYY" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="caseFiledDate" label={FIELD_LABELS.caseFiledDate}>
                <DatePicker style={{ width: "100%" }} format="MM/DD/YYYY" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="lcaTitle" label={FIELD_LABELS.lcaTitle}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="lcaCaseNumber" label={FIELD_LABELS.lcaCaseNumber}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="lcaWages" label={FIELD_LABELS.lcaWages}>
                <Input prefix="$" type="number" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="client" label={FIELD_LABELS.client}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="vendor" label={FIELD_LABELS.vendor}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="workLocation1" label={FIELD_LABELS.workLocation1}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="workLocation2" label={FIELD_LABELS.workLocation2}>
                <Input />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
      <NotesModal
        open={!!noteModalRow}
        entityType="ImmigrationIntake"
        entityId={noteModalRow?.intakeId}
        title={noteModalRow?.caseId}
        onClose={() => setNoteModalRow(null)}
      />
    </div>
  );
}
