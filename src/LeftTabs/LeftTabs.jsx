import React, { useContext, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  PlusOutlined,
  BookOutlined,
  HomeOutlined,
  TeamOutlined,
  UserOutlined,
  ShopOutlined,
  GlobalOutlined,
  LineChartOutlined,
  PieChartOutlined,
  DollarOutlined,
  SlidersOutlined,
} from "@ant-design/icons";
import { Link, useLocation } from "react-router-dom";
import AuthContext from "../Authentication/Context/AuthContext";
import { canAccess, getLandingPage, ROLES } from "../Utils/roleAccess";
import "./LeftTabs.css";

// The rail icons themselves are still PLACEHOLDER labels/icons, kept
// identical to the QuickBooks reference design on purpose — only "Home" is
// wired to a real route so far. The Create flyout below, though, is wired
// to real BeanEMS pages (see CREATE_MENU).
const RAIL_ITEMS_TOP = [
  { key: "create", label: "Create", icon: <PlusOutlined />, hasFlyout: true },
  { key: "bookmarks", label: "Bookmarks", icon: <BookOutlined /> },
  { key: "home", label: "Home", icon: <HomeOutlined />, to: "/home" },
  { key: "team", label: "Team", icon: <TeamOutlined />, hasFlyout: true },
  {
    key: "customers",
    label: "Customers",
    icon: <UserOutlined />,
    to: "/customerDashboard",
    hasFlyout: true,
    hideForRoles: [ROLES.IMMIGRATION],
  },
  {
    key: "vendors",
    label: "Vendors",
    icon: <ShopOutlined />,
    to: "/vendorDashboard",
    hasFlyout: true,
    hideForRoles: [ROLES.IMMIGRATION],
  },
  { key: "immigration", label: "Immigration", icon: <GlobalOutlined />, hasFlyout: true },
  { key: "reports", label: "Reports", icon: <LineChartOutlined />, hasFlyout: true },
];

// Accounting/Expenses are Accounting-department concerns — hidden for
// Immigration the same way ROUTE_ROLES already hides the pages they lead to.
const RAIL_ITEMS_PINNED = [
  { key: "accounting", label: "Accounting", icon: <PieChartOutlined />, hasFlyout: true, hideForRoles: [ROLES.IMMIGRATION] },
  { key: "expenses", label: "Expenses", icon: <DollarOutlined />, hideForRoles: [ROLES.IMMIGRATION] },
];

// Same 4-column layout as the QuickBooks reference, but each column now
// links to the BeanEMS page it actually maps to instead of QB's own demo
// items. Gated by the same ROUTE_ROLES canAccess() every other route uses,
// so a role only ever sees links it could already reach.
const CREATE_MENU = [
  {
    title: "Customers",
    items: [
      // Quick-add shortcuts — land straight on each page's add-new drawer
      // (via ?new=1) instead of just the grid.
      { label: "Customer", to: "/customerdetails?new=1" },
      { label: "Project", to: "/projects?new=1" },
      { label: "Invoice", to: "/invoicedetails?new=1" },
    ],
  },
  {
    title: "Vendors",
    items: [
      { label: "Vendor", to: "/vendordetails?new=1" },
      { label: "Expenses", to: "/expensedetails?new=1" },
    ],
  },
  {
    title: "Team",
    items: [
      { label: "Employee", to: "/workforce?new=1" },
      { label: "Timesheets", to: "/timesheets" },
    ],
  },
  {
    title: "Immigration",
    items: [
      { label: "LCA", to: "/lcaDetails?new=1" },
      { label: "Visa", to: "/visaDetails?new=1" },
      { label: "Immigration Intake", to: "/immigrationIntake?new=1" },
    ],
  },
  {
    title: "Other",
    items: [
      { label: "Dashboard", to: "/dashboard" },
      { label: "Master Data Load", to: "/masterdataload" },
      { label: "User Access", to: "/userAccess" },
      { label: "Pending Requests", to: "/pendingRequests" },
    ],
  },
];

// How the sections above stack into the flyout's actual columns —
// Customers+Vendors share one column, Team+Immigration share another,
// Other gets its own. Sections keep their own sub-heading within the
// shared column instead of merging into one list.
const CREATE_MENU_COLUMNS = [
  ["Customers", "Vendors"],
  ["Team", "Immigration"],
  ["Other"],
];

// "Accounting" rail icon's flyout — the same Customers/Vendors sections
// as the Create mega-menu, but stripped of "?new=1" (plain navigation to
// the list page, not a quick-add shortcut) — derived from CREATE_MENU
// rather than re-listed so the two stay in sync — plus an Adjustments
// section that has no Create-menu counterpart.
const ACCOUNTING_MENU = [
  ...CREATE_MENU
    .filter((section) => section.title === "Customers" || section.title === "Vendors")
    .map((section) => ({
      ...section,
      items: section.items.map((it) => ({ ...it, to: it.to.split("?")[0] })),
    })),
  {
    title: "Adjustments",
    items: [
      { label: "Adjustments", to: "/adjustmentDetails" },
      { label: "All Bills", to: "/allBills" },
    ],
  },
];

// Two columns — Customers alone in column 1, Vendors+Adjustments stacked
// in column 2 — same column-grouping pattern as CREATE_MENU_COLUMNS.
const ACCOUNTING_MENU_COLUMNS = [
  ["Customers"],
  ["Vendors", "Adjustments"],
];

// The rail's own "Customers"/"Vendors" icons reuse the exact same
// Customers/Vendors sections as the Accounting flyout (same items, same
// plain-navigation links) rather than re-deriving from CREATE_MENU again —
// plus each rail icon's own Dashboard link up front (the icon's own click
// target, per REPORTS_MENU's Accounting section), since hovering should
// surface that destination too, not just reveal it on click.
const CUSTOMERS_MENU = ACCOUNTING_MENU
  .filter((section) => section.title === "Customers")
  .map((section) => ({
    ...section,
    items: [{ label: "Customer Dashboard", to: "/customerDashboard" }, ...section.items],
  }));
const VENDORS_MENU = ACCOUNTING_MENU
  .filter((section) => section.title === "Vendors")
  .map((section) => ({
    ...section,
    items: [{ label: "Vendor Dashboard", to: "/vendorDashboard" }, ...section.items],
  }));

// "Immigration" rail icon's flyout — same Immigration section as the
// Create mega-menu (and same card look — white rounded panel with a
// titled section, per CREATE_MENU_COLUMNS), stripped of "?new=1" since
// this is plain navigation like the Team/Accounting icons — plus Visa
// Employees, which has no Create-menu counterpart (it's a roster view,
// not an add-new shortcut).
const IMMIGRATION_MENU = CREATE_MENU
  .filter((section) => section.title === "Immigration")
  .map((section) => ({
    ...section,
    items: [
      ...section.items.map((it) => ({ ...it, to: it.to.split("?")[0] })),
      { label: "Visa Employees", to: "/visaEmployees" },
    ],
  }));

// Simple flat submenu for the rail's "Team" icon — the three
// employee-roster views, gated the same way every other route is.
const TEAM_MENU = [
  { label: "Employees", to: "/workforce" },
  { label: "Visa Employees", to: "/visaEmployees" },
  { label: "Potential Employees", to: "/potentialEmployees" },
];

// Single-column "Reports" flyout — mirrors one column of the Create
// mega-menu (a sub-heading plus its items). Stacks multiple titled
// sections in the one column now that there's more than Payroll.
const REPORTS_MENU = [
  {
    title: "Payroll",
    items: [
      { label: "Payroll Summary", to: "/payrollsummary" },
      { label: "Payroll Eligibility", to: "/payrolleligibility" },
      { label: "Health Insurance", to: "/healthinsurance" },
      { label: "Monthly Timesheets", to: "/monthlytimesheets" },
      { label: "Hours Report", to: "/hoursreport" },
    ],
  },
  {
    title: "Immigration",
    items: [
      { label: "Immigration Dashboard", to: "/immigrationDashboard" },
    ],
  },
  {
    title: "Accounting",
    items: [
      { label: "Project Invoice Summary", to: "/projectInvoiceSummary" },
      { label: "Company Report", to: "/companyreport" },
      { label: "Customer Dashboard", to: "/customerDashboard" },
      { label: "Vendor Dashboard", to: "/vendorDashboard" },
    ],
  },
];

// All the rail's derived, role-filtered menu data — shared between the
// desktop hover-flyout rail (LeftTabs, below) and the touch-friendly
// accordion drawer (MobileNav.jsx) so the two never drift out of sync.
// Pure data computation, no rendering — safe to call from either.
export function useLeftNavData() {
  const { user } = useContext(AuthContext);

  // Home always points at each role's own landing page (e.g. Immigration's
  // is /immigrationDashboard, not the shared HR/Accounting /home) — same
  // mapping used for the post-login redirect and Access Denied's "back to
  // home" link, so all three stay in sync automatically.
  const visibleToRole = (item) => !item.hideForRoles || !item.hideForRoles.includes(user?.role);

  const railItemsTop = RAIL_ITEMS_TOP.filter(visibleToRole).map((item) =>
    item.key === "home" ? { ...item, to: getLandingPage(user?.role) } : item,
  );
  const railItemsPinned = RAIL_ITEMS_PINNED.filter(visibleToRole);

  const visibleSections = CREATE_MENU.map((section) => ({
    ...section,
    // canAccess/ROUTE_ROLES is keyed by plain paths — strip any "?new=1"
    // quick-add query string first so those shortcuts inherit the same
    // gating as the page they point at, instead of bypassing it.
    items: section.items.filter((it) => canAccess(user?.role, it.to.split("?")[0])),
  })).filter((section) => section.items.length > 0);

  const visibleCreateColumns = CREATE_MENU_COLUMNS.map((titles) =>
    titles.map((title) => visibleSections.find((s) => s.title === title)).filter(Boolean),
  ).filter((sections) => sections.length > 0);

  const visibleAccountingSections = ACCOUNTING_MENU.map((section) => ({
    ...section,
    items: section.items.filter((it) => canAccess(user?.role, it.to)),
  })).filter((section) => section.items.length > 0);

  const visibleAccountingColumns = ACCOUNTING_MENU_COLUMNS.map((titles) =>
    titles.map((title) => visibleAccountingSections.find((s) => s.title === title)).filter(Boolean),
  ).filter((sections) => sections.length > 0);

  const visibleImmigrationSections = IMMIGRATION_MENU.map((section) => ({
    ...section,
    items: section.items.filter((it) => canAccess(user?.role, it.to)),
  })).filter((section) => section.items.length > 0);

  const visibleTeamItems = TEAM_MENU.filter((it) => canAccess(user?.role, it.to));

  const visibleCustomersSections = CUSTOMERS_MENU.map((section) => ({
    ...section,
    items: section.items.filter((it) => canAccess(user?.role, it.to)),
  })).filter((section) => section.items.length > 0);

  const visibleVendorsSections = VENDORS_MENU.map((section) => ({
    ...section,
    items: section.items.filter((it) => canAccess(user?.role, it.to)),
  })).filter((section) => section.items.length > 0);

  const visibleReportsSections = REPORTS_MENU.map((section) => ({
    ...section,
    items: section.items.filter((it) => canAccess(user?.role, it.to)),
  })).filter((section) => section.items.length > 0);

  return {
    railItemsTop,
    railItemsPinned,
    visibleCreateColumns,
    visibleAccountingColumns,
    visibleImmigrationSections,
    visibleTeamItems,
    visibleCustomersSections,
    visibleVendorsSections,
    visibleReportsSections,
  };
}

const LeftTabs = () => {
  const location = useLocation();
  // Which rail item's flyout is open ("create" | "reports" | null) —
  // generalized so any rail item with hasFlyout:true can own a
  // portal-rendered panel, not just Create.
  const [activeFlyout, setActiveFlyout] = useState(null);
  const [flyoutPos, setFlyoutPos] = useState({ top: 0, left: 0 });
  const closeTimer = useRef(null);
  const itemRefs = useRef({});

  const {
    railItemsTop,
    railItemsPinned,
    visibleCreateColumns,
    visibleAccountingColumns,
    visibleImmigrationSections,
    visibleTeamItems,
    visibleCustomersSections,
    visibleVendorsSections,
    visibleReportsSections,
  } = useLeftNavData();

  // Anchored via the rail icon's actual screen position (not CSS
  // relative-to-rail) so the flyout can be portaled straight to <body> and
  // escape any ancestor overflow:hidden — done this way specifically so
  // MainLayout.js never needs to change (its overflow:hidden is what keeps
  // AG Grid's bounded-height containers sized correctly).
  const openFlyout = (key) => {
    clearTimeout(closeTimer.current);
    const el = itemRefs.current[key];
    if (el) {
      const rect = el.getBoundingClientRect();
      setFlyoutPos({ top: rect.top, left: rect.right + 4 });
    }
    setActiveFlyout(key);
  };
  // A short delay before closing lets the cursor travel from the rail icon
  // to the flyout panel without the menu disappearing mid-move.
  const closeFlyout = () => {
    closeTimer.current = setTimeout(() => setActiveFlyout(null), 150);
  };

  const renderItem = (item) => {
    const isActive = item.to && location.pathname === item.to;
    const body = (
      <div
        ref={item.hasFlyout ? (el) => { itemRefs.current[item.key] = el; } : undefined}
        className={`rail-item ${isActive ? "rail-item-active" : ""}`}
        onMouseEnter={item.hasFlyout ? () => openFlyout(item.key) : undefined}
        onMouseLeave={item.hasFlyout ? closeFlyout : undefined}
      >
        <span className="rail-item-icon">{item.icon}</span>
        <span className="rail-item-label">{item.label}</span>
      </div>
    );
    return item.to ? (
      <Link to={item.to} className="rail-item-link" key={item.key}>
        {body}
      </Link>
    ) : (
      <div key={item.key}>{body}</div>
    );
  };

  return (
    <div className="bean-left-rail">
      <div className="rail-section">{railItemsTop.map(renderItem)}</div>

      {railItemsPinned.length > 0 && (
        <div className="rail-section">{railItemsPinned.map(renderItem)}</div>
      )}

      <div className="rail-spacer" />

      <div className="rail-section rail-bottom">
        {renderItem({ key: "customize", label: "Customize", icon: <SlidersOutlined /> })}
      </div>

      {activeFlyout === "create" &&
        createPortal(
          <div
            className="create-flyout"
            style={{ top: flyoutPos.top, left: flyoutPos.left }}
            onMouseEnter={() => openFlyout("create")}
            onMouseLeave={closeFlyout}
          >
            <div className="create-flyout-columns">
              {visibleCreateColumns.map((sections, colIndex) => (
                <div className="create-flyout-column" key={colIndex}>
                  {sections.map((section) => (
                    <div className="create-flyout-section" key={section.title}>
                      <div className="create-flyout-column-title">{section.title}</div>
                      {section.items.map((it) => (
                        <Link
                          to={it.to}
                          className="create-flyout-item"
                          key={it.label}
                          onClick={() => setActiveFlyout(null)}
                        >
                          <span>{it.label}</span>
                        </Link>
                      ))}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>,
          document.body,
        )}

      {activeFlyout === "accounting" &&
        visibleAccountingColumns.length > 0 &&
        createPortal(
          <div
            className="accounting-flyout"
            style={{ top: flyoutPos.top, left: flyoutPos.left }}
            onMouseEnter={() => openFlyout("accounting")}
            onMouseLeave={closeFlyout}
          >
            <div className="accounting-flyout-columns">
              {visibleAccountingColumns.map((sections, colIndex) => (
                <div className="create-flyout-column" key={colIndex}>
                  {sections.map((section) => (
                    <div className="create-flyout-section" key={section.title}>
                      <div className="create-flyout-column-title">{section.title}</div>
                      {section.items.map((it) => (
                        <Link
                          to={it.to}
                          className="create-flyout-item"
                          key={it.label}
                          onClick={() => setActiveFlyout(null)}
                        >
                          <span>{it.label}</span>
                        </Link>
                      ))}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>,
          document.body,
        )}

      {activeFlyout === "immigration" &&
        visibleImmigrationSections.length > 0 &&
        createPortal(
          <div
            className="create-flyout immigration-flyout"
            style={{ top: flyoutPos.top, left: flyoutPos.left }}
            onMouseEnter={() => openFlyout("immigration")}
            onMouseLeave={closeFlyout}
          >
            {visibleImmigrationSections.map((section) => (
              <div className="create-flyout-section" key={section.title}>
                <div className="create-flyout-column-title">{section.title}</div>
                {section.items.map((it) => (
                  <Link
                    to={it.to}
                    className="create-flyout-item"
                    key={it.label}
                    onClick={() => setActiveFlyout(null)}
                  >
                    <span>{it.label}</span>
                  </Link>
                ))}
              </div>
            ))}
          </div>,
          document.body,
        )}

      {activeFlyout === "customers" &&
        visibleCustomersSections.length > 0 &&
        createPortal(
          <div
            className="create-flyout immigration-flyout"
            style={{ top: flyoutPos.top, left: flyoutPos.left }}
            onMouseEnter={() => openFlyout("customers")}
            onMouseLeave={closeFlyout}
          >
            {visibleCustomersSections.map((section) => (
              <div className="create-flyout-section" key={section.title}>
                <div className="create-flyout-column-title">{section.title}</div>
                {section.items.map((it) => (
                  <Link
                    to={it.to}
                    className="create-flyout-item"
                    key={it.label}
                    onClick={() => setActiveFlyout(null)}
                  >
                    <span>{it.label}</span>
                  </Link>
                ))}
              </div>
            ))}
          </div>,
          document.body,
        )}

      {activeFlyout === "vendors" &&
        visibleVendorsSections.length > 0 &&
        createPortal(
          <div
            className="create-flyout immigration-flyout"
            style={{ top: flyoutPos.top, left: flyoutPos.left }}
            onMouseEnter={() => openFlyout("vendors")}
            onMouseLeave={closeFlyout}
          >
            {visibleVendorsSections.map((section) => (
              <div className="create-flyout-section" key={section.title}>
                <div className="create-flyout-column-title">{section.title}</div>
                {section.items.map((it) => (
                  <Link
                    to={it.to}
                    className="create-flyout-item"
                    key={it.label}
                    onClick={() => setActiveFlyout(null)}
                  >
                    <span>{it.label}</span>
                  </Link>
                ))}
              </div>
            ))}
          </div>,
          document.body,
        )}

      {activeFlyout === "team" &&
        visibleTeamItems.length > 0 &&
        createPortal(
          <div
            className="team-flyout"
            style={{ top: flyoutPos.top, left: flyoutPos.left }}
            onMouseEnter={() => openFlyout("team")}
            onMouseLeave={closeFlyout}
          >
            {visibleTeamItems.map((it) => (
              <Link
                to={it.to}
                className="team-flyout-item"
                key={it.label}
                onClick={() => setActiveFlyout(null)}
              >
                {it.label}
              </Link>
            ))}
          </div>,
          document.body,
        )}

      {activeFlyout === "reports" &&
        visibleReportsSections.length > 0 &&
        createPortal(
          <div
            className="reports-flyout"
            style={{ top: flyoutPos.top, left: flyoutPos.left }}
            onMouseEnter={() => openFlyout("reports")}
            onMouseLeave={closeFlyout}
          >
            {visibleReportsSections.map((section) => (
              <div className="create-flyout-section" key={section.title}>
                <div className="create-flyout-column-title">{section.title}</div>
                {section.items.map((it) => (
                  <Link
                    to={it.to}
                    className="create-flyout-item"
                    key={it.label}
                    onClick={() => setActiveFlyout(null)}
                  >
                    <span>{it.label}</span>
                  </Link>
                ))}
              </div>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
};
export default LeftTabs;
