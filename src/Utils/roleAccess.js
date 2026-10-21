export const ROLES = {
  ADMIN: "ADMIN",
  IMMIGRATION: "IMMIGRATION",
  HR: "HR",
  ACCOUNTING: "ACCOUNTING",
};

// path -> roles allowed to see it, besides ADMIN (which can always access
// everything). Paths not listed here are treated as accessible to any
// authenticated (role-assigned) user — keeps shared/utility routes like
// /generateInvoice, reached from multiple entry points, from being
// accidentally locked out by an omission.
export const ROUTE_ROLES = {
  // Immigration's landing page is /immigrationDashboard (see
  // getLandingPage), not the shared Home/Dashboard overview pages built
  // around HR/Accounting data — so they're excluded here rather than left
  // open to "any role".
  "/home": [ROLES.HR, ROLES.ACCOUNTING],
  "/dashboard": [ROLES.HR, ROLES.ACCOUNTING],
  "/immigrationDashboard": [ROLES.IMMIGRATION],

  // Team/Employees is visible to all three non-Admin roles (Accounting bills
  // them, HR manages them, Immigration handles their visas) — only the
  // Add/Edit actions inside entity pages like this one are naturally scoped
  // by who can reach the page at all.
  "/workforce": [ROLES.HR, ROLES.ACCOUNTING, ROLES.IMMIGRATION],
  "/employeeonboard": [ROLES.HR],
  "/potentialEmployees": [ROLES.HR],
  "/employeeFullDetails": [ROLES.HR, ROLES.IMMIGRATION],
  "/employeeDetailDashboard": [ROLES.HR],
  "/healthinsurance": [ROLES.HR],
  "/ProjectOnBoardingForm": [ROLES.HR],

  "/visaEmployees": [ROLES.IMMIGRATION],
  "/lcaDetails": [ROLES.IMMIGRATION],
  "/visaDetails": [ROLES.IMMIGRATION],
  "/immigrationIntake": [ROLES.IMMIGRATION],

  "/customerdetails": [ROLES.ACCOUNTING],
  "/vendordetails": [ROLES.ACCOUNTING],
  "/customerDashboard": [ROLES.ACCOUNTING],
  "/vendorDashboard": [ROLES.ACCOUNTING],
  "/customerFullDetails": [ROLES.ACCOUNTING],
  "/vendorFullDetails": [ROLES.ACCOUNTING],
  "/invoicedetails": [ROLES.ACCOUNTING],
  "/expensedetails": [ROLES.ACCOUNTING],
  "/companyreport": [ROLES.ACCOUNTING],
  "/payrollsummary": [ROLES.ACCOUNTING],
  "/payrolleligibility": [ROLES.ACCOUNTING],
  "/timesheets": [ROLES.ACCOUNTING],
  "/monthlytimesheets": [ROLES.ACCOUNTING],
  "/hoursreport": [ROLES.ACCOUNTING],
  "/projectInvoiceSummary": [ROLES.ACCOUNTING],
  "/projects": [ROLES.ACCOUNTING],
  "/projectFullDetails": [ROLES.ACCOUNTING],
  "/generateInvoice": [ROLES.ACCOUNTING],
  "/adjustmentDetails": [ROLES.ACCOUNTING],
  "/allBills": [ROLES.ACCOUNTING],
  "/billingIntegrityReport": [ROLES.ACCOUNTING],
  "/i9TasksReport": [ROLES.HR, ROLES.IMMIGRATION],

  "/masterdataload": [], // Admin only
  "/userAccess": [], // Admin only
  "/pendingRequests": [], // Admin only
};

export function canAccess(userRole, path) {
  if (!userRole) return false; // no role assigned yet = no access
  if (userRole === ROLES.ADMIN) return true;
  const allowed = ROUTE_ROLES[path];
  return !allowed || allowed.includes(userRole);
}

// Finer-grained than ROUTE_ROLES: gates a single business entity's
// Add/List actions (List implicitly includes row-level Edit/Delete — no
// separate permission for those). Used for cross-cutting UI — quick-action
// buttons, tabs, and chart widgets — that live on pages reachable by more
// roles than the entity itself belongs to (e.g. Home/Dashboard are open to
// HR and Accounting, but their "Add New Customer" shortcut is still
// Accounting-only).
export const ENTITY_ROLES = {
  team: [ROLES.HR, ROLES.ACCOUNTING, ROLES.IMMIGRATION],
  vendor: [ROLES.ACCOUNTING],
  customer: [ROLES.ACCOUNTING],
  project: [ROLES.ACCOUNTING],
  invoice: [ROLES.ACCOUNTING],
  expense: [ROLES.ACCOUNTING],
  payroll: [ROLES.ACCOUNTING],
  time: [ROLES.ACCOUNTING],
  potentialEmployees: [ROLES.HR],
  healthInsurance: [ROLES.HR],
  visaEmployees: [ROLES.IMMIGRATION],
  lca: [ROLES.IMMIGRATION],
  visaDetails: [ROLES.IMMIGRATION],
};

export function canAccessEntity(userRole, entityKey) {
  if (!userRole) return false;
  if (userRole === ROLES.ADMIN) return true;
  const allowed = ENTITY_ROLES[entityKey];
  return !allowed || allowed.includes(userRole);
}

// Where a role lands after login (and falls back to on an unknown URL /
// "back to home" from Access Denied) — everyone else still gets the shared
// /home dashboard.
export function getLandingPage(userRole) {
  if (userRole === ROLES.IMMIGRATION) return "/immigrationDashboard";
  return "/home";
}
