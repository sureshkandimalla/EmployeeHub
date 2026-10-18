import { TENANT_BRANDING, getCurrentTenantBranding } from "./tenantBranding";

// EmployeeHub serves several companies from one deployment; showing the wrong
// company's name/logo to a signed-in user is a visible tenancy leak.

afterEach(() => {
  localStorage.clear();
});

describe("TENANT_BRANDING", () => {
  it("knows the display name for each configured tenant", () => {
    expect(TENANT_BRANDING.bean.name).toBe("Bean Infosystems");
    expect(TENANT_BRANDING.intellan.name).toBe("Intellan Technologies LLC");
  });

  it("has a logo for each configured tenant", () => {
    expect(TENANT_BRANDING.bean.logo).toBeTruthy();
    expect(TENANT_BRANDING.intellan.logo).toBeTruthy();
  });

  it("gives the two tenants different logos", () => {
    expect(TENANT_BRANDING.bean.logo).not.toBe(TENANT_BRANDING.intellan.logo);
  });
});

describe("getCurrentTenantBranding", () => {
  it("returns the signed-in user's own tenant branding", () => {
    localStorage.setItem("user", JSON.stringify({ tenant: "bean", token: "abc" }));

    expect(getCurrentTenantBranding()).toBe(TENANT_BRANDING.bean);
  });

  it("returns the Intellan branding for an Intellan session", () => {
    localStorage.setItem("user", JSON.stringify({ tenant: "intellan", token: "abc" }));

    expect(getCurrentTenantBranding()).toBe(TENANT_BRANDING.intellan);
  });

  it("falls back to Intellan when no user is stored", () => {
    expect(getCurrentTenantBranding()).toBe(TENANT_BRANDING.intellan);
  });

  it("falls back to Intellan when the stored user has no tenant", () => {
    localStorage.setItem("user", JSON.stringify({ token: "abc" }));

    expect(getCurrentTenantBranding()).toBe(TENANT_BRANDING.intellan);
  });

  it("falls back to Intellan for a tenant that is not configured", () => {
    localStorage.setItem("user", JSON.stringify({ tenant: "unknown-co", token: "abc" }));

    expect(getCurrentTenantBranding()).toBe(TENANT_BRANDING.intellan);
  });

  it("falls back to Intellan rather than throwing when the stored entry is not valid JSON", () => {
    localStorage.setItem("user", "}{not json");

    expect(getCurrentTenantBranding()).toBe(TENANT_BRANDING.intellan);
  });
});
