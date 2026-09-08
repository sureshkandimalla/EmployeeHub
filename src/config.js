export const usCountryTelList = [
  { value: "USA", label: "USA" },
  { value: "IN", label: "IN" },
];

export const taxTermsList = [
  { value: "W2", label: "W2" },
  { value: "1099", label: "1099" },
  { value: "C2C", label: "C2C" },
  { value: "Other", label: "Other" },

];

export const employementTypeList = [
  { value: "Full-Time", label: "Full-Time" },
  { value: "C2C", label: "C2C" },
  { value: "Part-Time", label: "Part-Time" },
  { value: "Hourly", label: "Hourly" },
  
];

export const workingStatusList = [
  { value: "Active", label: "Active" },
  { value: "Inactive", label: "Inactive" },
  { value: "Bench", label: "Bench" },
  { value: "OnBoarding", label: "On-Boarding" },
  { value: "NewHires", label: "New Hires" },
  { value: "Archived", label: "Archived" },
];
export const workAuthorizationList = [
  { value: "H1B", label: "H1B" },
  { value: "OPT", label: "OPT" },
  { value: "OPT EAD", label: "OPT EAD" },
  { value: "STEM EAD", label: "STEM EAD" },
  { value: "H4 EAD", label: "H4 EAD" },
  { value: "Citizen", label: "Citizen" },
  { value: "GC", label: "GC" },
  { value: "L1", label: "L1" },
  { value: "E3", label: "E3" },

];

export const everifyStatusList = [
  { value: "Completed", label: "Completed" },
  { value: "In Process", label: "In Process" },
  { value: "Removed", label: "Removed" },
  { value: "Not Completed", label: "Not Completed" },
  { value: "Drafted", label: "Drafted" },
];
export const i9StatusList = [
  { value: "Completed", label: "Completed" },
  { value: "In Process", label: "In Process" },
  { value: "Rehire", label: "Rehire" },
  { value: "Reverified", label: "Reverified" },
];

export const invoiceStatusList = [
  { value: "Submitted", label: "Submitted" },
  { value: "Created", label: "Created" },
  { value: "Paid", label: "Paid" },
  { value: "Partially Paid", label: "Partially Paid" },
];

export const expenseStatusList = [
  { value: "Pending", label: "Pending" },
  { value: "Approved", label: "Approved" },
  { value: "Rejected", label: "Rejected" },
  { value: "Reimbursed", label: "Reimbursed" },
  { value: "Archived", label: "Archived" },
];

export const expenseTypeList = [
  { value: "Attorney Fee", label: "Attorney Fee" },
  { value: "USCIS Fee", label: "USCIS Fee" },
  { value: "Employee Reimbursement", label: "Employee Reimbursement" },
  { value: "Green Card Fee", label: "Green Card Fee" },
  { value: "Mail Service", label: "Mail Service" },
  { value: "Other", label: "Other" },
];

export const visaStatusList = [
  { value: "Submitted",   label: "Submitted" },
  { value: "RFE",         label: "RFE" },
  { value: "Approved",    label: "Approved" },
  { value: "In Progress", label: "In Progress" },
  { value: "Expired",     label: "Expired" },
  { value: "Revoked",     label: "Revoked" },
  { value: "Archived",    label: "Archived" },
];
// src/config.js
// Centralized config for API endpoints

export const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:8080/api/v1";

export const API_ENDPOINTS = {
  saveEmployees: `${API_BASE_URL}/employees/saveEmployees`,
  employeesCountByStatus: `${API_BASE_URL}/employees/employeesCountByStatus`,
  invoicesCountByStatus: `${API_BASE_URL}/invoice/invoicesCountByStatus`,
  getProjects: `${API_BASE_URL}/getProjects`,
  getProjectsByCustomer: (customerId) => `${API_BASE_URL}/getProjectsByCustomer/${customerId}`,
  wagesById: (wageId) => `${API_BASE_URL}/wages/${wageId}`,
  getEmployees: `${API_BASE_URL}/employees/getEmployees`,
  getAllEmployees: `${API_BASE_URL}/employees/getAllEmployees`,
  getAllCustomers: `${API_BASE_URL}/customers/getAllCustomers`,
  customersById: (customerId) => `${API_BASE_URL}/customers/customers/${customerId}`,
  deleteEmployee: (employeeId) => `${API_BASE_URL}/employees/${employeeId}`,
  deleteCustomer: (customerId) => `${API_BASE_URL}/customers/customers/${customerId}`,
  assignmentsForProject: (projectId) => `${API_BASE_URL}/assignmentsForProject?projectId=${projectId}`,
  assignmentsForEmployee: (employeeId) => `${API_BASE_URL}/assignmentsForEmployee?employeeId=${employeeId}`,
  getTimesheetByAssignmentAndMonth: (assignmentId, yearMonth) => `${API_BASE_URL}/timesheets/getByAssignmentAndMonth?assignmentId=${assignmentId}&yearMonth=${yearMonth}`,
  saveTimesheetBulk: `${API_BASE_URL}/timesheets/saveBulk`,
  submitTimesheetMonth: (assignmentId, yearMonth) => `${API_BASE_URL}/timesheets/submit?assignmentId=${assignmentId}&yearMonth=${yearMonth}`,
  approveTimesheetMonth: (assignmentId, yearMonth) => `${API_BASE_URL}/timesheets/approve?assignmentId=${assignmentId}&yearMonth=${yearMonth}`,
  reopenTimesheetMonth: (assignmentId, yearMonth) => `${API_BASE_URL}/timesheets/reopen?assignmentId=${assignmentId}&yearMonth=${yearMonth}`,
  deleteTimesheetEntry: (timesheetId) => `${API_BASE_URL}/timesheets/${timesheetId}`,
  getActiveAssignmentsWithDetails: `${API_BASE_URL}/activeAssignmentsWithDetails`,
  getTimesheetsByMonth: (yearMonth) => `${API_BASE_URL}/timesheets/getByMonth?yearMonth=${yearMonth}`,
  getTimesheetsByEmployeeAndRange: (employeeId, startDate, endDate) => `${API_BASE_URL}/timesheets/getByEmployeeAndRange?employeeId=${employeeId}&startDate=${startDate}&endDate=${endDate}`,
  submitTimesheetRange: (assignmentId, startDate, endDate) => `${API_BASE_URL}/timesheets/submitRange?assignmentId=${assignmentId}&startDate=${startDate}&endDate=${endDate}`,
  approveTimesheetRange: (assignmentId, startDate, endDate) => `${API_BASE_URL}/timesheets/approveRange?assignmentId=${assignmentId}&startDate=${startDate}&endDate=${endDate}`,
  rejectTimesheetRange: (assignmentId, startDate, endDate) => `${API_BASE_URL}/timesheets/rejectRange?assignmentId=${assignmentId}&startDate=${startDate}&endDate=${endDate}`,
  reopenTimesheetRange: (assignmentId, startDate, endDate) => `${API_BASE_URL}/timesheets/reopenRange?assignmentId=${assignmentId}&startDate=${startDate}&endDate=${endDate}`,
  getTimesheetsByRange: (startDate, endDate) => `${API_BASE_URL}/timesheets/getByRange?startDate=${startDate}&endDate=${endDate}`,
  getPayPeriods: `${API_BASE_URL}/payrollsummary/getPayPeriods`,
  getAssignmentsEligibleForPeriod: (startDate, endDate) => `${API_BASE_URL}/assignmentsEligibleForPeriod?startDate=${startDate}&endDate=${endDate}`,
  getPayrollSummaryByPayPeriod: (payPeriodId) => `${API_BASE_URL}/payrollsummary/getByPayPeriod?payPeriodId=${payPeriodId}`,
  getHoursReport: (payPeriodId, employeeId) =>
    `${API_BASE_URL}/hours-report/getReport?payPeriodId=${payPeriodId}${employeeId ? `&employeeId=${employeeId}` : ""}`,
  projectsById: (projectId) => `${API_BASE_URL}/projects/${projectId}`,
  projectDeletionImpact: (projectId) => `${API_BASE_URL}/projects/${projectId}/deletionImpact`,
  employeeById: (employeeId) => `${API_BASE_URL}/employees/employee/${employeeId}`,
  updateEmployee: (employeeId) => `${API_BASE_URL}/employees/${employeeId}`,
  projectsByEmployeeId: (employeeId) => `${API_BASE_URL}/projects?employeeId=${employeeId}`,
  projectsByCustomerId: (customerId) => `${API_BASE_URL}/projects?customerId=${customerId}`,
  getAllPotentialEmployees: `${API_BASE_URL}/visa/getAllPotentialEmployees`,
  savePotentialEmployees: `${API_BASE_URL}/visa/savePotentialEmployees`,
  deletePotentialEmployee: (peId) => `${API_BASE_URL}/visa/potentialEmployees/${peId}`,
  addInvoices: `${API_BASE_URL}/invoice/addInvoices`,
  getAllInvoices: `${API_BASE_URL}/invoice/getAllInvoices`,
  getAllBills: `${API_BASE_URL}/bills/getAllBills`,
  invoiceById: (invoiceId) => `${API_BASE_URL}/invoice/invoices/${invoiceId}`,
  reconcileRecords: `${API_BASE_URL}/reconcile/getReconcileRecords`,
  saveOnBoardDetails: `${API_BASE_URL}/employees/saveOnBoardDetails`,
  saveOnBoardDetailsCustomer: `${API_BASE_URL}/customers/saveOnBoardDetails`,
  authLogin: `${API_BASE_URL}/auth/login`,
  getAllVendors: `${API_BASE_URL}/vendors/getAllVendors`,
  vendorsById: (vendorId) => `${API_BASE_URL}/vendors/vendors/${vendorId}`,
  deleteVendor: (vendorId) => `${API_BASE_URL}/vendors/vendors/${vendorId}`,
  saveOnBoardDetailsVendor: `${API_BASE_URL}/vendors/saveOnBoardDetails`,
  getInvoicesForProject: (projectId) => `${API_BASE_URL}/invoice/getInvoicesForProject?projectId=${projectId}`,
  getInvoicesForCustomer: (customerId) => `${API_BASE_URL}/invoice/getInvoicesForCustomer?customerId=${customerId}`,
  getInvoicesForEmployee: `${API_BASE_URL}/invoice/getInvoicesForEmployee`,
  addExpense: `${API_BASE_URL}/expense/addExpense`,
  getAllExpenses: `${API_BASE_URL}/expense/getAllExpenses`,
  expenseById: (expenseId) => `${API_BASE_URL}/expense/expenses/${expenseId}`,
  deleteExpense: (expenseId) => `${API_BASE_URL}/expense/expenses/${expenseId}`,
  getExpensesForEmployee: (employeeId) => `${API_BASE_URL}/expense/getExpensesForEmployee?employeeId=${employeeId}`,
  expensesCountByStatus: `${API_BASE_URL}/expense/expensesCountByStatus`,
  getBillsForProject: (projectId) => `${API_BASE_URL}/bills/getBillsForProject?projectId=${projectId}`,
  getBillsForEmployee: (employeeId) => `${API_BASE_URL}/bills/getBillsForEmployee?employeeId=${employeeId}`,
  getBillsForCustomer: (customerId) => `${API_BASE_URL}/bills/getBillsForCustomer?customerId=${customerId}`,
  coiById: (id) => `${API_BASE_URL}/coi/${id}`,
  createCoi: `${API_BASE_URL}/coi`,
  getAllCoi: `${API_BASE_URL}/coi/getAllCoi`,
  getCoiForVendor: (vendorId) => `${API_BASE_URL}/coi/getCoiForVendor?vendorId=${vendorId}`,
  getCoiForCustomer: (customerId) => `${API_BASE_URL}/coi/getCoiForCustomer?customerId=${customerId}`,
  // Generic document attachments (Insurance, Customer MSAs, Project POs,
  // Employee docs, ...) — entityType/entityId scoped, see DocumentController.
  presignDocumentUpload: `${API_BASE_URL}/documents/presign`,
  createDocument: `${API_BASE_URL}/documents`,
  getDocumentsForEntity: (entityType, entityId) => `${API_BASE_URL}/documents?entityType=${entityType}&entityId=${entityId}`,
  getAllDocumentsForType: (entityType) => `${API_BASE_URL}/documents?entityType=${entityType}`,
  documentDownloadUrl: (id) => `${API_BASE_URL}/documents/${id}/downloadUrl`,
  documentById: (id) => `${API_BASE_URL}/documents/${id}`,
  // Generic notes (Employee, Visa, LCA, Invoice, ...) — type/entityId
  // scoped, see NoteController. entityId matches that type's own primary
  // key (e.g. Employee.employeeId for type="Employee").
  createNote: `${API_BASE_URL}/notes`,
  getNotesForEntity: (type, entityId) => `${API_BASE_URL}/notes?type=${type}&entityId=${entityId}`,
  noteById: (noteId) => `${API_BASE_URL}/notes/${noteId}`,
  // Non-admin "please Archive/Delete this" requests, for an admin to review
  // on the Pending Requests page — see ActionRequestController.
  createActionRequest: `${API_BASE_URL}/actionRequests`,
  getActionRequests: (status) => `${API_BASE_URL}/actionRequests${status ? `?status=${status}` : ""}`,
  resolveActionRequest: (requestId) => `${API_BASE_URL}/actionRequests/${requestId}/resolve`,
  assignments: `${API_BASE_URL}/assignments`,
  assignmentsById: (assignmentId) => `${API_BASE_URL}/assignments/${assignmentId}`,
  saveOnBoardProject: `${API_BASE_URL}/saveOnBoardProject`,
  getPayrollSummaryAll: `${API_BASE_URL}/payrollsummary/getAll`,
  getPayrollsForEmp: (employeeId) => `${API_BASE_URL}/payrollsummary/getByEmployeeId/${employeeId}`,
  getHealthInsuranceAll: `${API_BASE_URL}/healthinsurance/getAll`,
  getHealthInsuranceForEmp: (employeeId) => `${API_BASE_URL}/healthinsurance/getByEmployeeId/${employeeId}`,
  importHealthInsuranceCsv: `${API_BASE_URL}/healthinsurance/import`,
  deleteAllHealthInsurance: `${API_BASE_URL}/healthinsurance/deleteAll`,
  createLCA: `${API_BASE_URL}/lca/createLCA`,
  getAllLCAs: `${API_BASE_URL}/lca`,
  saveLCA: `${API_BASE_URL}/lca/save`,
  getLCAById: (lcaId) => `${API_BASE_URL}/lca/${lcaId}`,
  getLCAByEmployee: (employeeId) => `${API_BASE_URL}/lca/employee/${employeeId}`,
  deleteLCA: (lcaId) => `${API_BASE_URL}/lca/${lcaId}`,
  getAllVisas: `${API_BASE_URL}/visa/getAllVisas`,
  createVisa: `${API_BASE_URL}/visa/createVisa`,
  updateVisa: (visaId) => `${API_BASE_URL}/visa/${visaId}`,
  deleteVisa: (visaId) => `${API_BASE_URL}/visa/${visaId}`,
  getVisaById: (visaId) => `${API_BASE_URL}/visa/${visaId}`,
  getAllEmployeesImmigration: `${API_BASE_URL}/immigration/getAllEmployeesImmigration`,
  // Passport endpoints
  getAllPassports: `${API_BASE_URL}/passport/getAllPassports`,
  createPassport: `${API_BASE_URL}/passport/createPassport`,
  updatePassport: (id) => `${API_BASE_URL}/passport/${id}`,
  getPassportById: (id) => `${API_BASE_URL}/passport/${id}`,
  getPassportsByEmployee: (employeeId) => `${API_BASE_URL}/passport/employee/${employeeId}`,
  deletePassport: (id) => `${API_BASE_URL}/passport/${id}`,
  employeesListByStatus: `${API_BASE_URL}/employees/employeesListByStatus`,
  addAdjustment: `${API_BASE_URL}/adjustment/addAdjustment`,
  findAdjustmentsByEmployeeId: `${API_BASE_URL}/adjustment/findAdjustmentsByEmployeeId`,
  getAllAdjustments: `${API_BASE_URL}/adjustment/getAdjustments`,
  saveWage: `${API_BASE_URL}/wages/wage`,
  createPotentialEmployee: `${API_BASE_URL}/visa/potentialEmployees`,
  // Backend requires selectedDate (400s without it) — callers with no
  // month picked should pass endDate itself rather than omit it.
  activeProjects: (endDate, selectedDate) => `${API_BASE_URL}/activeProjects?endDate=${endDate}&selectedDate=${selectedDate}`,
  activeProjectsForInvoiceByEmployee: (employeeId) => `${API_BASE_URL}/activeProjectsForInvoiceByEmployee?employeeId=${employeeId}`,
  masterDataTemplate: (entityType) => `${API_BASE_URL}/masterdata/template/${entityType}`,
  masterDataImport: (entityType) => `${API_BASE_URL}/masterdata/import/${entityType}`,
  importPayrollSummaryCsv: `${API_BASE_URL}/payrollsummary/import`,
  getAllUserRoles: `${API_BASE_URL}/userRoles`,
  upsertUserRole: `${API_BASE_URL}/userRoles`,
  deleteUserRole: (email) => `${API_BASE_URL}/userRoles/${encodeURIComponent(email)}`,
  getAllImmiIntakes: `${API_BASE_URL}/immiIntake/getAll`,
  createImmiIntake: `${API_BASE_URL}/immiIntake/create`,
  updateImmiIntake: (intakeId) => `${API_BASE_URL}/immiIntake/${intakeId}`,
  deleteImmiIntake: (intakeId) => `${API_BASE_URL}/immiIntake/${intakeId}`,
};

export const employeeTypeOptions = [
  { value: "W2", label: "W2" },
  { value: "1099", label: "1099" },
  { value: "C2C", label: "C2C" },
];

export const companyList = [
  { value: "Intellan Technologies LLC", label: "Intellan Technologies LLC" },
  { value: "Code9 LLC", label: "Code9 LLC" },
  { value: "Referral", label: "Referral" },
];

export const departmentList = [
  { value: "Intellan Technologies LLC", label: "Intellan Technologies LLC" },
  { value: "Code9 LLC", label: "Code9 LLC" },
  { value: "Referral", label: "Referral" },
];

export const projectStatus = [
  { value: "Active", label: "Active" },
  { value: "Inactive", label: "Inactive" },
  { value: "Hold", label: "Hold" },
  { value: "OnBoarding", label: "On-Boarding" },
];

export const currencyList = [
  { value: "USD", label: "USD" },
  { value: "EUR", label: "EUR" },
  { value: "GBP", label: "GBP" },
  { value: "CAD", label: "CAD" },
  { value: "AUD", label: "AUD" },
  { value: "INR", label: "INR" },
];

export const msaStatusList = [
  { value: "Signed", label: "Signed" },
  { value: "Pending", label: "Pending" },
  { value: "Not Required", label: "Not Required" },
  { value: "Expired", label: "Expired" },
];

export const billingMethodList = [
  { value: "ACH", label: "ACH" },
  { value: "Wire Transfer", label: "Wire Transfer" },
  { value: "Check", label: "Check" },
  { value: "Credit Card", label: "Credit Card" },
];

export const paymentTermsList = [
  { value: "Due on Receipt", label: "Due on Receipt" },
  { value: "Net 15", label: "Net 15" },
  { value: "Net 30", label: "Net 30" },
  { value: "Net 45", label: "Net 45" },
  { value: "Net 60", label: "Net 60" },
];

export const vendorTypeList = [
  { value: "Individual", label: "Individual" },
  { value: "LLC", label: "LLC" },
  { value: "Staffing Firm", label: "Staffing Firm" },
  { value: "Subcontractor", label: "Subcontractor" },
];

export const vendorStatusList = [
  { value: "Pending", label: "Pending" },
  { value: "Active", label: "Active" },
  { value: "On Hold", label: "On Hold" },
  { value: "Inactive", label: "Inactive" },
  { value: "Archived", label: "Archived" },
];

// Backwards-compatible alias
export const projectEmployeeOnboardingStatus = projectStatus;

export default API_ENDPOINTS;
