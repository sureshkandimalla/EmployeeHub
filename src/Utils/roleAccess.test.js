import {
  ROLES,
  ROUTE_ROLES,
  ENTITY_ROLES,
  canAccess,
  canAccessEntity,
  getLandingPage,
} from "./roleAccess";

// Permissions are the highest-risk logic in the UI: a wrong answer here
// either locks a whole department out of its own screens or shows HR the
// payroll. Every rule is asserted explicitly, including the deny cases.

describe("canAccess — no role", () => {
  it("denies a user whose role has not been assigned yet", () => {
    expect(canAccess(null, "/home")).toBe(false);
  });

  it("denies an undefined role", () => {
    expect(canAccess(undefined, "/home")).toBe(false);
  });

  it("denies an empty-string role", () => {
    expect(canAccess("", "/home")).toBe(false);
  });

  it("denies a role with no row anywhere in the route table", () => {
    expect(canAccess(null, "/generateInvoice")).toBe(false);
  });
});

describe("canAccess — ADMIN", () => {
  it("allows ADMIN everywhere, including the admin-only routes", () => {
    expect(canAccess(ROLES.ADMIN, "/masterdataload")).toBe(true);
    expect(canAccess(ROLES.ADMIN, "/userAccess")).toBe(true);
    expect(canAccess(ROLES.ADMIN, "/pendingRequests")).toBe(true);
  });

  it("allows ADMIN onto every other role's routes", () => {
    expect(canAccess(ROLES.ADMIN, "/payrollsummary")).toBe(true);
    expect(canAccess(ROLES.ADMIN, "/visaDetails")).toBe(true);
    expect(canAccess(ROLES.ADMIN, "/employeeonboard")).toBe(true);
  });

  it("allows ADMIN onto an unlisted route", () => {
    expect(canAccess(ROLES.ADMIN, "/some/new/page")).toBe(true);
  });
});

describe("canAccess — admin-only routes", () => {
  it.each([ROLES.HR, ROLES.ACCOUNTING, ROLES.IMMIGRATION])(
    "denies %s the Master Data Load page",
    (role) => {
      expect(canAccess(role, "/masterdataload")).toBe(false);
    },
  );

  it.each([ROLES.HR, ROLES.ACCOUNTING, ROLES.IMMIGRATION])(
    "denies %s the User Access page",
    (role) => {
      expect(canAccess(role, "/userAccess")).toBe(false);
    },
  );

  it.each([ROLES.HR, ROLES.ACCOUNTING, ROLES.IMMIGRATION])(
    "denies %s the Pending Requests page",
    (role) => {
      expect(canAccess(role, "/pendingRequests")).toBe(false);
    },
  );
});

describe("canAccess — HR", () => {
  it("allows HR onto the shared dashboards", () => {
    expect(canAccess(ROLES.HR, "/home")).toBe(true);
    expect(canAccess(ROLES.HR, "/dashboard")).toBe(true);
  });

  it("allows HR onto the employee screens it owns", () => {
    expect(canAccess(ROLES.HR, "/workforce")).toBe(true);
    expect(canAccess(ROLES.HR, "/employeeonboard")).toBe(true);
    expect(canAccess(ROLES.HR, "/potentialEmployees")).toBe(true);
    expect(canAccess(ROLES.HR, "/healthinsurance")).toBe(true);
  });

  it("denies HR the accounting screens", () => {
    expect(canAccess(ROLES.HR, "/payrollsummary")).toBe(false);
    expect(canAccess(ROLES.HR, "/invoicedetails")).toBe(false);
    expect(canAccess(ROLES.HR, "/allBills")).toBe(false);
    expect(canAccess(ROLES.HR, "/adjustmentDetails")).toBe(false);
  });

  it("denies HR the immigration screens", () => {
    expect(canAccess(ROLES.HR, "/visaDetails")).toBe(false);
    expect(canAccess(ROLES.HR, "/lcaDetails")).toBe(false);
    expect(canAccess(ROLES.HR, "/immigrationIntake")).toBe(false);
    expect(canAccess(ROLES.HR, "/immigrationDashboard")).toBe(false);
  });
});

describe("canAccess — ACCOUNTING", () => {
  it("allows ACCOUNTING onto the shared dashboards", () => {
    expect(canAccess(ROLES.ACCOUNTING, "/home")).toBe(true);
    expect(canAccess(ROLES.ACCOUNTING, "/dashboard")).toBe(true);
  });

  it("allows ACCOUNTING onto the money screens it owns", () => {
    expect(canAccess(ROLES.ACCOUNTING, "/invoicedetails")).toBe(true);
    expect(canAccess(ROLES.ACCOUNTING, "/payrollsummary")).toBe(true);
    expect(canAccess(ROLES.ACCOUNTING, "/allBills")).toBe(true);
    expect(canAccess(ROLES.ACCOUNTING, "/projects")).toBe(true);
    expect(canAccess(ROLES.ACCOUNTING, "/adjustmentDetails")).toBe(true);
  });

  it("allows ACCOUNTING to view the team list it bills against", () => {
    expect(canAccess(ROLES.ACCOUNTING, "/workforce")).toBe(true);
  });

  it("denies ACCOUNTING the HR-only employee screens", () => {
    expect(canAccess(ROLES.ACCOUNTING, "/employeeonboard")).toBe(false);
    expect(canAccess(ROLES.ACCOUNTING, "/potentialEmployees")).toBe(false);
    expect(canAccess(ROLES.ACCOUNTING, "/healthinsurance")).toBe(false);
  });

  it("denies ACCOUNTING the immigration screens", () => {
    expect(canAccess(ROLES.ACCOUNTING, "/visaEmployees")).toBe(false);
    expect(canAccess(ROLES.ACCOUNTING, "/immigrationDashboard")).toBe(false);
  });
});

describe("canAccess — IMMIGRATION", () => {
  it("allows IMMIGRATION onto its own dashboard", () => {
    expect(canAccess(ROLES.IMMIGRATION, "/immigrationDashboard")).toBe(true);
  });

  it("allows IMMIGRATION onto the visa and LCA screens", () => {
    expect(canAccess(ROLES.IMMIGRATION, "/visaEmployees")).toBe(true);
    expect(canAccess(ROLES.IMMIGRATION, "/lcaDetails")).toBe(true);
    expect(canAccess(ROLES.IMMIGRATION, "/visaDetails")).toBe(true);
    expect(canAccess(ROLES.IMMIGRATION, "/immigrationIntake")).toBe(true);
  });

  it("allows IMMIGRATION to view the team list and an employee's full record", () => {
    expect(canAccess(ROLES.IMMIGRATION, "/workforce")).toBe(true);
    expect(canAccess(ROLES.IMMIGRATION, "/employeeFullDetails")).toBe(true);
  });

  it("denies IMMIGRATION the shared HR/Accounting dashboards, since it has its own", () => {
    expect(canAccess(ROLES.IMMIGRATION, "/home")).toBe(false);
    expect(canAccess(ROLES.IMMIGRATION, "/dashboard")).toBe(false);
  });

  it("denies IMMIGRATION the accounting screens", () => {
    expect(canAccess(ROLES.IMMIGRATION, "/invoicedetails")).toBe(false);
    expect(canAccess(ROLES.IMMIGRATION, "/payrollsummary")).toBe(false);
  });
});

describe("canAccess — unlisted routes", () => {
  it("treats a route absent from the table as open to any assigned role", () => {
    expect(canAccess(ROLES.HR, "/generateInvoice--not-listed")).toBe(true);
    expect(canAccess(ROLES.IMMIGRATION, "/some/shared/utility")).toBe(true);
  });

  it("still denies an unlisted route to a user with no role", () => {
    expect(canAccess(null, "/some/shared/utility")).toBe(false);
  });

  it("every explicitly admin-only route has an empty allow-list", () => {
    expect(ROUTE_ROLES["/masterdataload"]).toEqual([]);
    expect(ROUTE_ROLES["/userAccess"]).toEqual([]);
    expect(ROUTE_ROLES["/pendingRequests"]).toEqual([]);
  });
});

describe("canAccessEntity", () => {
  it("denies every entity to a user with no role", () => {
    expect(canAccessEntity(null, "invoice")).toBe(false);
    expect(canAccessEntity(undefined, "team")).toBe(false);
  });

  it("allows ADMIN every entity", () => {
    Object.keys(ENTITY_ROLES).forEach((entity) => {
      expect(canAccessEntity(ROLES.ADMIN, entity)).toBe(true);
    });
  });

  it("scopes the customer and vendor shortcuts to ACCOUNTING only", () => {
    expect(canAccessEntity(ROLES.ACCOUNTING, "customer")).toBe(true);
    expect(canAccessEntity(ROLES.ACCOUNTING, "vendor")).toBe(true);
    expect(canAccessEntity(ROLES.HR, "customer")).toBe(false);
    expect(canAccessEntity(ROLES.IMMIGRATION, "vendor")).toBe(false);
  });

  it("scopes the payroll and time entities to ACCOUNTING only", () => {
    expect(canAccessEntity(ROLES.ACCOUNTING, "payroll")).toBe(true);
    expect(canAccessEntity(ROLES.HR, "payroll")).toBe(false);
    expect(canAccessEntity(ROLES.IMMIGRATION, "time")).toBe(false);
  });

  it("scopes the potential-employee and health-insurance entities to HR only", () => {
    expect(canAccessEntity(ROLES.HR, "potentialEmployees")).toBe(true);
    expect(canAccessEntity(ROLES.HR, "healthInsurance")).toBe(true);
    expect(canAccessEntity(ROLES.ACCOUNTING, "potentialEmployees")).toBe(false);
  });

  it("scopes the visa and LCA entities to IMMIGRATION only", () => {
    expect(canAccessEntity(ROLES.IMMIGRATION, "visaEmployees")).toBe(true);
    expect(canAccessEntity(ROLES.IMMIGRATION, "lca")).toBe(true);
    expect(canAccessEntity(ROLES.HR, "lca")).toBe(false);
    expect(canAccessEntity(ROLES.ACCOUNTING, "visaDetails")).toBe(false);
  });

  it("shares the team entity across all three non-admin roles", () => {
    expect(canAccessEntity(ROLES.HR, "team")).toBe(true);
    expect(canAccessEntity(ROLES.ACCOUNTING, "team")).toBe(true);
    expect(canAccessEntity(ROLES.IMMIGRATION, "team")).toBe(true);
  });

  it("treats an unknown entity key as open to any assigned role", () => {
    expect(canAccessEntity(ROLES.HR, "somethingNew")).toBe(true);
  });
});

describe("getLandingPage", () => {
  it("sends IMMIGRATION to its own dashboard", () => {
    expect(getLandingPage(ROLES.IMMIGRATION)).toBe("/immigrationDashboard");
  });

  it("sends HR and ACCOUNTING to the shared home page", () => {
    expect(getLandingPage(ROLES.HR)).toBe("/home");
    expect(getLandingPage(ROLES.ACCOUNTING)).toBe("/home");
  });

  it("sends ADMIN to the shared home page", () => {
    expect(getLandingPage(ROLES.ADMIN)).toBe("/home");
  });

  it("falls back to the shared home page for an unknown or missing role", () => {
    expect(getLandingPage(null)).toBe("/home");
    expect(getLandingPage("SOMETHING_ELSE")).toBe("/home");
  });

  it("every role's landing page is one that role may actually access", () => {
    [ROLES.ADMIN, ROLES.HR, ROLES.ACCOUNTING, ROLES.IMMIGRATION].forEach((role) => {
      expect(canAccess(role, getLandingPage(role))).toBe(true);
    });
  });
});
