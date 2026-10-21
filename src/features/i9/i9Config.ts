// Legal numbers used by i9Rules.ts, kept in one place because USCIS rules
// change. Mirrors the backend's I9Config.java 1:1 — see docs/i9-rules.md
// for the rules these back. No HR-editable settings screen exists yet, so
// this is a static source of truth rather than a per-tenant DB-backed
// config.
export const I9_CONFIG = {
  section2BusinessDays: 3,
  everifyBusinessDays: 3,
  // Empty = Mon-Fri only, matching the spreadsheet's WORKDAY() function.
  holidays: [] as string[], // 'YYYY-MM-DD'
  rehireSuppBYears: 3,
  retentionYearsAfterHire: 3,
  retentionYearsAfterExit: 1,
  eadAutoExtDays: 540,
  // Renewals received on/after this date get no automatic extension.
  eadAutoExtCutoff: "2025-10-30",
  spouseEadCategories: ["A17", "A18", "C26"] as string[],
  stemOptExtDays: 180,
  h1b240Days: 240,
  receiptReplacementDays: 90,
  refugeeReceiptDays: 90,
  tempI551NoExpiryDays: 365,
  i9ReverifyAlertDays: 90,
  passportAlertDays: 180,
  i94AlertDays: 60,
  highPriorityDays: 30,
  everifyEnrolled: true,
  copyDocumentsForAll: true,
  allowedEditions: [
    { edition: "01/20/25", expires: "2027-05-31" },
    { edition: "08/01/23", expires: "2027-05-31" },
  ],
};
