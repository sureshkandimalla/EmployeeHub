/**
 * visaConstants.js
 *
 * Single source of truth for:
 *  - Field → display-name mappings  (VISA_FIELD_LABELS, LCA_FIELD_LABELS)
 *  - Dropdown option lists           (VISA_CATEGORY_OPTIONS, VISA_SUB_CATEGORY_OPTIONS, etc.)
 *  - Detail-grid column order/config (VISA_DETAIL_COLUMNS, LCA_MODAL_STATUS_OPTIONS)
 *
 * Import what you need and reference by key — no hard-coded strings scattered around.
 */

// ─────────────────────────────────────────────
// Field → Display Name maps
// ─────────────────────────────────────────────

export const VISA_FIELD_LABELS = {
  receiptNumber:   "Receipt Number",
  visaCategory:    "Visa Category",
  visaSubCategory: "Visa Sub Category",
  filingType:      "Filing Type",
  filingYear:      "Filing Year",
  jobTitle:        "Job Title",
  lcaId:           "LCA ID",
  lcaNumber:       "LCA Number",
  socCode:         "SOC Code",
  lcaWage:         "LCA Wage",
  client:          "Client",
  customer:          "Customer",
  jobLocation:     "Job Location",
  jobLocation2:    "Job Location 2",
  startDate:       "Start Date",
  endDate:         "End Date",
  approvedDate:    "Approved Date",
  status:          "Status",
  lastUpdated:     "Last Updated",
  employeeId:      "Employee ID",
  employeeName:    "Employee Name",
};

export const LCA_FIELD_LABELS = {
  lcaNumber:              "LCA Number",
  lcaCaseNumber:          "LCA Case Number",
  jobTitle:               "Job Title",
  socCode:                "SOC Code",
  lcaWage:                "LCA Wage",
  wageLevel:              "Wage Level",
  status:                 "Status",
  client:                 "Client",
  customer:                 "Customer",
  jobLocation:            "Job Location",
  jobLocation2:           "Job Location 2",
  noticePostedLocation:   "Notice Posted Location",
  noticePostedLocation2:  "Notice Posted Location 2",
  employmentStartDate:    "Employment Start Date",
  employmentEndDate:      "Employment End Date",
  lcaPostedFromDate:      "LCA Posted From",
  lcaPostedToDate:        "LCA Posted To",
  certifiedDate:          "Certified Date",
};

// Master grid column header names
export const MASTER_FIELD_LABELS = {
  employeeName:       "Full Name",
  status:             "Employee Status",
  visaCategory:       "Visa",
  employmentType:     "Employment Type",
  employeeType:       "Tax Term",
  filingType:         "Filing Type",
  visaSubCategory:    "Visa Sub Category",
  filingYear:         "Filing Year",
  applicationStatus:  "Visa Status",
  paf:                "PAF",
  i9:                 "I-9",
  everifyStatus:      "eVerify",
  emailId:            "Email",
  dob:                "Date of Birth",
  passportNumber:     "Passport Number",
  passportExpiryDate: "Passport Expiry Date",
  location:           "Current City",
  approvedDate:       "Approved Date",
  arrivalDate:        "Arrival Date",
  startDate:          "Visa Start Date",
  visaStatus:         "Visa Status",
  documentStatus:     "Document Status",
  lcaNumber:          "LCA",
  receiptNumber:      "Receipt Number",
  phone:              "Employee Phone",
  ssn:                "SSN",
  designation:        "Designation",
  gender:             "Gender",
  endDate:                "Visa End Date",
  employmentStartDate:    "Employment Start",
  employmentEndDate:      "Employment End",
  referredBy:             "Referred By",
  companyName:        "Company Name",
  country:            "Work Country",
  addressLine:        "Address",
  city:               "City",
  state:              "State",
  zipCode:            "Zip Code",
  immigrationTypes:   "Immigration Types",
};

// Detail (sub) grid column header names
export const DETAIL_FIELD_LABELS = {
  visaCategory:    "Visa Category",
  visaSubCategory: "Visa Sub Category",
  filingType:      "Filing Type",
  filingYear:      "Filing Year",
  receiptNumber:   "Receipt Number",
  jobTitle:        "Job Title",
  lcaNumber:       "LCA Number",
  lcaCaseNumber:   "LCA Case Number",
  socCode:         "SOC Code",
  lcaWage:         "LCA Wage",
  client:          "Client",
  customer:          "Customer",
  jobLocation:     "Job Location",
  jobLocation2:    "Job Location 2",
  status:          "Status",
  startDate:       "Visa Start Date",
  endDate:         "Visa End Date",
  approvedDate:    "Approved Date",
  lastUpdated:     "Last Updated",
};

// ─────────────────────────────────────────────
// Dropdown option lists
// ─────────────────────────────────────────────

export const VISA_CATEGORY_OPTIONS = [
  { value: "H1B" },
  { value: "H1-B1" },
  { value: "H4 EAD" },
  { value: "OPT" },
  { value: "CPT" },
  { value: "GC" },
  { value: "L1" },
  { value: "L2" },
  { value: "Citizen" },
  { value: "E3" },
];

export const VISA_SUB_CATEGORY_OPTIONS = [
  { value: "Transfer",       label: "Transfer" },
  { value: "CAP",            label: "CAP" },
  { value: "Transfer-India", label: "Transfer-India" },
];

/** Values used in the AG Grid agSelectCellEditor (strings only) */
export const VISA_SUB_CATEGORY_VALUES = VISA_SUB_CATEGORY_OPTIONS.map((o) => o.value);

export const FILING_TYPE_OPTIONS = [
  { value: "Transfer",        label: "Transfer" },
  { value: "Consular",        label: "Consular" },
  { value: "Change of Status", label: "COS" },
];

/** Values used in the AG Grid agSelectCellEditor (strings only) */
export const FILING_TYPE_VALUES = FILING_TYPE_OPTIONS.map((o) => o.value);

/** Maps backend value → display label (e.g. "Change of Status" → "COS") */
export const FILING_TYPE_LABEL_MAP = Object.fromEntries(
  FILING_TYPE_OPTIONS.map((o) => [o.value, o.label])
);

export const LCA_WAGE_LEVEL_OPTIONS = [
  { value: "I" },
  { value: "II" },
  { value: "III" },
  { value: "IV" },
];

/** Values used in the AG Grid agSelectCellEditor (strings only) */
export const LCA_WAGE_LEVEL_VALUES = LCA_WAGE_LEVEL_OPTIONS.map((o) => o.value);

export const LCA_STATUS_OPTIONS = [
  { value: "Active" },
  { value: "Certified" },
  { value: "In Process" },
  { value: "Withdrawn" },
  { value: "Expired" },
  { value: "Archived" },
];

// ─────────────────────────────────────────────
// LCA fields that belong to the LCA sub-object
// (used in onCellValueChanged to route saves)
// ─────────────────────────────────────────────

export const LCA_EDITABLE_FIELDS = [
  "lcaCaseNumber", "socCode", "lcaWage", "wageLevel", "client", "customer",
  "jobLocation", "jobLocation2", "jobTitle",
];

export const VISA_EDITABLE_FIELDS = [
  "visaCategory", "visaSubCategory", "filingType", "filingYear",
  "startDate", "endDate", "status", "lcaNumber",
];
