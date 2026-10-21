// Pure, framework-free Form I-9 rules engine — the TypeScript twin of the
// backend's I9Rules.java (same package the spec's own "one pure module"
// idea gets split into, since a Java backend and a JS/TS frontend in two
// separate repos can't literally share one module). Both implement the
// same rules (USCIS M-274 Handbook for Employers, as of October 2026,
// including the 30-Oct-2025 end of automatic EAD extensions for new
// renewal filings) and are kept in sync by porting the same 35 scenarios
// into both test suites — see I9RulesTest.java and i9Rules.test.ts. The
// Java copy is authoritative (the backend always re-validates); this one
// drives the live form (conditional fields, inline errors, computed
// read-only values).
//
// Dates are plain "YYYY-MM-DD" strings throughout, never `Date` objects
// passed in or out — `new Date('2026-10-19')` parses as UTC midnight,
// which renders as the *previous* day in any timezone behind UTC (see
// src/Utils/dateFormat.js's parseLocalDateSafe for the same pitfall
// elsewhere in this app). ISO "YYYY-MM-DD" strings also sort/compare
// lexicographically the same as chronologically, so most comparisons below
// are plain string comparisons — only addDays/business-day math needs an
// actual Date, and always via local Y/M/D components, never
// `new Date(isoString)`.
//
// `today` is always passed in explicitly, never read with `new Date()`
// inside this module, so every function stays deterministic and testable.

import { I9_CONFIG } from "./i9Config";

export type IsoDate = string;

export type SubType =
  | "NEW_HIRE"
  | "REVERIFY"
  | "REHIRE_SUPP_B"
  | "REHIRE_NEW"
  | "NAME_CHANGE"
  | "CORRECTION"
  | "DOC_UPDATE"
  | "MIGRATED"
  | "DESTROYED";

export type Attestation = "CITIZEN" | "NONCITIZEN_NATIONAL" | "LPR" | "NONCITIZEN_AUTHORIZED";
export type DocOption = "LIST_A" | "LIST_BC" | "LIST_C_ONLY";

export const A_US_PASSPORT = "A_US_PASSPORT";
export const A_GREEN_CARD = "A_GREEN_CARD";
export const A_TEMP_I551 = "A_TEMP_I551";
export const A_EAD = "A_EAD";
export const A_FPI = "A_FPI";
export const A_FSM_RMI = "A_FSM_RMI";
export const A_OTHER = "A_OTHER";

export const C_SSN = "C_SSN";
export const C_DHS_EAD = "C_DHS_EAD";

export type ExtensionType =
  | "EAD_AUTO_EXT"
  | "H1B_240_DAY"
  | "H1B_PORTABILITY_AC21"
  | "STEM_OPT_180_DAY"
  | "CAP_GAP"
  | "TPS_FEDERAL_REGISTER"
  | "GREEN_CARD_EXTENSION";

export type ReceiptType = "REPLACEMENT" | "I94_TEMP_I551" | "I94_REFUGEE";
export type Priority = "LOW" | "MEDIUM" | "HIGH";
export type TaskType =
  | "NEW_I9_NEEDED"
  | "I9_INCOMPLETE"
  | "I9_REVERIFICATION"
  | "I9_DETAILS_MISSING"
  | "EVERIFY_PENDING"
  | "RECEIPT_FOLLOWUP"
  | "PASSPORT_EXPIRY"
  | "I94_EXPIRY"
  | "EXIT_DETAILS_MISSING"
  | "I9_RETENTION_ENDED";

export interface ListADetails {
  code?: string | null;
  number?: string | null;
  expiry?: IsoDate | null;
  noExpiry?: boolean | null;
}
export interface I94Details {
  number?: string | null;
  admitUntil?: IsoDate | null;
  ds?: boolean | null;
  authEndDate?: IsoDate | null;
}
export interface ListBDetails {
  code?: string | null;
  number?: string | null;
  expiry?: IsoDate | null;
}
export interface ListCDetails {
  code?: string | null;
  number?: string | null;
  expiry?: IsoDate | null;
  restrictedSsn?: boolean | null;
}
export interface ReceiptDetails {
  type?: ReceiptType | null;
  validUntil?: IsoDate | null;
}
export interface EverifyDetails {
  caseNo?: string | null;
  created?: IsoDate | null;
  result?: string | null;
}

export interface I9RecordLike {
  id?: number | string | null;
  employeeId?: number | string | null;
  recordNo?: number | null;
  subtype?: SubType | null;
  validFrom?: IsoDate | null;
  section1Date?: IsoDate | null;
  attestation?: Attestation | null;
  section1AuthExpiry?: IsoDate | null;
  under3Days?: boolean | null;
  completedOn?: IsoDate | null;
  docOption?: DocOption | null;
  listA?: ListADetails | null;
  i94?: I94Details | null;
  listB?: ListBDetails | null;
  listC?: ListCDetails | null;
  receipt?: ReceiptDetails | null;
  extensionType?: ExtensionType | null;
  extensionDetails?: Record<string, string> | null;
  priorAuthExpired?: boolean | null;
  originalI9Date?: IsoDate | null;
  remoteExam?: boolean | null;
  preparerUsed?: boolean | null;
  everify?: EverifyDetails | null;
  correctsRecordId?: number | string | null;
  correctionReason?: string | null;
}

export interface EmployeeContext {
  employeeId: number | string;
  hireDate?: IsoDate | null;
  lastDay?: IsoDate | null;
  employmentStatus?: string | null;
  visaStatus?: string | null;
  passportNumber?: string | null;
  passportExpiry?: IsoDate | null;
}

// This app's working-status values (src/config.js workingStatusList) don't
// include the spec's literal "Terminated"/"Withdrawn" — the closest
// equivalents are Inactive and Archived.
export function hasExited(ctx: EmployeeContext): boolean {
  const status = (ctx.employmentStatus || "").toLowerCase();
  return status === "inactive" || status === "archived";
}

export interface Finding {
  code: string;
  message: string;
}
export interface ValidationResult {
  errors: Finding[];
  warnings: Finding[];
}
export interface ReverifyResult {
  date: IsoDate | null;
  source: string | null;
  notRequired: boolean;
}
export interface EmployeeStatusResult {
  status: string | null;
  dueDate: IsoDate | null;
}
export interface Task {
  employeeId: number | string;
  type: TaskType;
  label: string;
  priority: Priority;
  due: IsoDate | null;
  whereToFix: string;
}

// ───────────────────────────── date helpers ─────────────────────────────

function toLocalDate(iso: IsoDate): Date {
  const [y, m, d] = iso.split("T")[0].split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function toIso(date: Date): IsoDate {
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${mm}-${dd}`;
}

export function addDays(iso: IsoDate, days: number): IsoDate {
  const date = toLocalDate(iso);
  date.setDate(date.getDate() + days);
  return toIso(date);
}

export function addYears(iso: IsoDate, years: number): IsoDate {
  const date = toLocalDate(iso);
  date.setFullYear(date.getFullYear() + years);
  return toIso(date);
}

// Total whole days between two ISO dates (b - a), not Period-style
// "remainder" math.
export function daysBetween(a: IsoDate, b: IsoDate): number {
  const ms = toLocalDate(b).getTime() - toLocalDate(a).getTime();
  return Math.round(ms / 86_400_000);
}

const isBefore = (a: IsoDate, b: IsoDate) => a < b;
const isAfter = (a: IsoDate, b: IsoDate) => a > b;
const earlier = (a: IsoDate, b: IsoDate) => (a < b ? a : b);

function isBusinessDay(iso: IsoDate, holidays: string[]): boolean {
  const dow = toLocalDate(iso).getDay(); // 0=Sun..6=Sat
  if (dow === 0 || dow === 6) return false;
  return !holidays.includes(iso);
}

export function addBusinessDays(start: IsoDate, days: number, holidays: string[] = I9_CONFIG.holidays): IsoDate {
  let date = start;
  let remaining = days;
  while (remaining > 0) {
    date = addDays(date, 1);
    if (isBusinessDay(date, holidays)) remaining--;
  }
  return date;
}

// ───────────────────────────── 6. Which record is "latest" ──────────────

const EXCLUDED_FROM_LATEST: SubType[] = ["DOC_UPDATE", "NAME_CHANGE", "CORRECTION"];

export function latestRecord(records: I9RecordLike[]): I9RecordLike | null {
  const eligible = records.filter((r) => !EXCLUDED_FROM_LATEST.includes(r.subtype as SubType));
  if (eligible.length === 0) return null;
  return eligible.reduce((latest, r) => {
    const rDate = r.validFrom || "";
    const latestDate = latest.validFrom || "";
    if (rDate > latestDate) return r;
    if (rDate < latestDate) return latest;
    return (r.id ?? 0) > (latest.id ?? 0) ? r : latest; // tie-break, see note below
  });
}

function coalesce<T>(preferred: T | null | undefined, fallback: T | null | undefined): T | null | undefined {
  return preferred !== null && preferred !== undefined ? preferred : fallback;
}

// A CORRECTION applies its (non-null) field values onto the record it
// corrects, for display/rules purposes only — the original object is
// never mutated, so its history stays intact (section 9's audit-trail
// guardrail). Returns `original` unchanged if no correction targets it.
export function effectiveRecord(original: I9RecordLike | null, allRecordsForEmployee: I9RecordLike[]): I9RecordLike | null {
  if (!original) return null;
  const corrections = allRecordsForEmployee.filter(
    (r) => r.subtype === "CORRECTION" && original.id != null && r.correctsRecordId === original.id,
  );
  if (corrections.length === 0) return original;
  const correction = corrections[corrections.length - 1];

  return {
    ...original,
    docOption: coalesce(correction.docOption, original.docOption) as DocOption | null,
    listA: {
      code: coalesce(correction.listA?.code, original.listA?.code),
      number: coalesce(correction.listA?.number, original.listA?.number),
      expiry: coalesce(correction.listA?.expiry, original.listA?.expiry),
      noExpiry: coalesce(correction.listA?.noExpiry, original.listA?.noExpiry),
    },
    i94: {
      number: coalesce(correction.i94?.number, original.i94?.number),
      admitUntil: coalesce(correction.i94?.admitUntil, original.i94?.admitUntil),
      ds: coalesce(correction.i94?.ds, original.i94?.ds),
      authEndDate: coalesce(correction.i94?.authEndDate, original.i94?.authEndDate),
    },
    listB: {
      code: coalesce(correction.listB?.code, original.listB?.code),
      number: coalesce(correction.listB?.number, original.listB?.number),
      expiry: coalesce(correction.listB?.expiry, original.listB?.expiry),
    },
    listC: {
      code: coalesce(correction.listC?.code, original.listC?.code),
      number: coalesce(correction.listC?.number, original.listC?.number),
      expiry: coalesce(correction.listC?.expiry, original.listC?.expiry),
      restrictedSsn: coalesce(correction.listC?.restrictedSsn, original.listC?.restrictedSsn),
    },
    extensionType: coalesce(correction.extensionType, original.extensionType) as ExtensionType | null,
    extensionDetails: coalesce(correction.extensionDetails, original.extensionDetails),
  };
}

// Section 6: "I-9 count for an employee excludes DOC_UPDATE and NAME_CHANGE."
export function i9Count(records: I9RecordLike[]): number {
  return records.filter((r) => r.subtype !== "DOC_UPDATE" && r.subtype !== "NAME_CHANGE").length;
}

// Section 3.2's "I-9 Status (auto)" — per-RECORD status, distinct from
// employeeI9Status (section 7), which is the overall employee-level
// action-needed value.
export function recordStatus(record: I9RecordLike): string {
  if (record.subtype === "DESTROYED") return "Destroyed";
  return record.completedOn ? "Completed" : "In Process";
}

// ───────────────────────────── 5.1 Section 2 due date ─────────────────────

export function section2Due(record: I9RecordLike, ctx: EmployeeContext, priorRecordBeingReplaced?: I9RecordLike | null): IsoDate | null {
  switch (record.subtype) {
    case "NEW_HIRE":
    case "REHIRE_NEW":
      if (!ctx.hireDate) return null;
      return record.under3Days ? ctx.hireDate : addBusinessDays(ctx.hireDate, I9_CONFIG.section2BusinessDays);
    case "REHIRE_SUPP_B":
      return record.validFrom ?? null;
    case "REVERIFY":
      return priorRecordBeingReplaced ? reverifyBy(priorRecordBeingReplaced, []).date : null;
    default:
      return null;
  }
}

// ───────────────────────────── 5.2 E-Verify due date ───────────────────────

export function everifyDue(record: I9RecordLike, ctx: EmployeeContext): IsoDate | null {
  if ((record.subtype === "NEW_HIRE" || record.subtype === "REHIRE_NEW") && I9_CONFIG.everifyEnrolled && ctx.hireDate) {
    return addBusinessDays(ctx.hireDate, I9_CONFIG.everifyBusinessDays);
  }
  return null;
}

// ───────────────────────────── 5.3 Reverify by ───────────────────────────

function neverReverify(r: I9RecordLike): boolean {
  const listACode = r.listA?.code;
  if (listACode === A_US_PASSPORT || listACode === A_GREEN_CARD) return true;
  if (r.docOption === "LIST_BC") {
    const listCCode = r.listC?.code;
    return listCCode !== C_DHS_EAD;
  }
  return false;
}

export function reverifyBy(record: I9RecordLike | null, allRecordsForEmployee: I9RecordLike[]): ReverifyResult {
  if (!record) return { date: null, source: null, notRequired: true };
  if (neverReverify(record)) return { date: null, source: null, notRequired: true };

  let base: IsoDate | null = null;
  let source = "This record";
  const listACode = record.listA?.code;

  if (listACode === A_EAD) {
    base = record.listA?.expiry ?? null;
  } else if (listACode === A_FPI || listACode === A_FSM_RMI) {
    base = record.i94?.ds ? record.i94?.authEndDate ?? null : record.i94?.admitUntil ?? null;
  } else if (listACode === A_TEMP_I551 || listACode === A_OTHER) {
    base = record.listA?.expiry ?? null;
  } else if (record.listC?.code === C_DHS_EAD) {
    base = record.listC?.expiry ?? null;
  }

  if (record.attestation === "NONCITIZEN_AUTHORIZED" && record.section1AuthExpiry) {
    const authExpiry = record.section1AuthExpiry;
    const newBase = base === null ? authExpiry : earlier(authExpiry, base);
    if (newBase === authExpiry && newBase !== base) source = "Section 1 date";
    base = newBase;
  }

  // Fallback for migrated/old records missing their own date: use the
  // latest EAD/I-94 data found on any of the employee's other I9Records
  // (no separate visa-case table has this data — see module javadoc).
  if (base === null) {
    if (listACode === A_EAD) {
      const fallback = latestFieldAcrossRecords(allRecordsForEmployee, (r) => (r.listA?.code === A_EAD ? r.listA?.expiry ?? null : null));
      if (fallback) {
        base = fallback;
        source = "Latest EAD on file";
      }
    } else if ((listACode === A_FPI || listACode === A_FSM_RMI) && !record.i94?.admitUntil) {
      const fallback = latestFieldAcrossRecords(allRecordsForEmployee, (r) => r.i94?.admitUntil ?? null);
      if (fallback) {
        base = fallback;
        source = "Latest I-94 on file";
      }
    }
  }

  if (record.extensionType) {
    const ext = applyExtension(record, base);
    if (ext) {
      base = ext;
      source = "Extension: " + record.extensionType;
    }
  }

  if (base === null) return { date: null, source: null, notRequired: false };
  return { date: base, source, notRequired: false };
}

function latestFieldAcrossRecords(records: I9RecordLike[], extract: (r: I9RecordLike) => IsoDate | null): IsoDate | null {
  const dates = records.map(extract).filter((d): d is IsoDate => !!d);
  if (dates.length === 0) return null;
  return dates.reduce((max, d) => (d > max ? d : max));
}

// ───────────────────────────── 5.4 Suggested notes ───────────────────────

export function suggestedNote(record: I9RecordLike): string | null {
  if (!record.extensionType) return null;
  return extensionSuggestedNote(record.extensionType, record);
}

// ───────────────────────────── 5.5 Receipts ──────────────────────────────

export function receiptValidUntil(type: ReceiptType, examDate: IsoDate, record: I9RecordLike): IsoDate {
  switch (type) {
    case "REPLACEMENT":
      return addDays(examDate, I9_CONFIG.receiptReplacementDays);
    case "I94_TEMP_I551":
      return record.i94?.admitUntil ? record.i94.admitUntil : addDays(examDate, I9_CONFIG.tempI551NoExpiryDays);
    case "I94_REFUGEE":
      return addDays(examDate, I9_CONFIG.refugeeReceiptDays);
    default:
      return examDate;
  }
}

// ───────────────────────────── 5.6 Retention date ────────────────────────

export function retainUntil(hireDate?: IsoDate | null, lastDay?: IsoDate | null): IsoDate | null {
  if (!hireDate || !lastDay) return null;
  const afterHire = addYears(hireDate, I9_CONFIG.retentionYearsAfterHire);
  const afterExit = addYears(lastDay, I9_CONFIG.retentionYearsAfterExit);
  return isAfter(afterHire, afterExit) ? afterHire : afterExit;
}

// ───────────────────────────── 7. Employee I-9 status ────────────────────

const COMPLETE_STATUSES = new Set(["Completed", "Reverified", "N/A"]);

export function employeeI9Status(ctx: EmployeeContext, records: I9RecordLike[], today: IsoDate): EmployeeStatusResult {
  // 1. Exited employees: retention only, no action status.
  if (hasExited(ctx)) return { status: null, dueDate: null };

  const latest = latestRecord(records);

  // 2/3. No records, or a rehire (hire date after the latest record).
  const isRehire = !!(latest && ctx.hireDate && latest.validFrom && isAfter(ctx.hireDate, latest.validFrom));
  if (!latest || isRehire) {
    if (!ctx.hireDate) return { status: "No I-9 on file", dueDate: null };
    const due = addBusinessDays(ctx.hireDate, I9_CONFIG.section2BusinessDays);
    const overdue = isAfter(today, due);
    const label = isRehire
      ? overdue
        ? "Rehire I-9 OVERDUE"
        : "Rehire I-9 needed"
      : overdue
        ? "New I-9 OVERDUE"
        : "New I-9 needed";
    return { status: label, dueDate: due };
  }

  const effective = effectiveRecord(latest, records)!;

  // 4. Latest record not complete.
  if (!effective.completedOn && !COMPLETE_STATUSES.has(recordStatus(effective))) {
    const due = section2Due(effective, ctx, null);
    const rv = reverifyBy(effective, records);
    const workAuthExpired = !rv.notRequired && !!rv.date && isBefore(rv.date, today);
    if ((due && isAfter(today, due)) || workAuthExpired) {
      return { status: "I-9 OVERDUE", dueDate: due };
    }
    return { status: "I-9 in progress", dueDate: due };
  }

  // 5. Reverification.
  const rv = reverifyBy(effective, records);
  if (!rv.notRequired) {
    if (!rv.date) return { status: "Expiry date missing", dueDate: null };
    if (isBefore(rv.date, today)) return { status: "Reverification OVERDUE", dueDate: rv.date };
    const daysLeft = daysBetween(today, rv.date);
    if (daysLeft <= I9_CONFIG.i9ReverifyAlertDays) return { status: "Reverification due", dueDate: rv.date };
    return { status: "Compliant", dueDate: rv.date };
  }

  // 6. Reverify result blank (not required) and visa isn't Citizen/GC.
  const citizenOrGc = (ctx.visaStatus || "").toLowerCase() === "citizen" || (ctx.visaStatus || "").toLowerCase() === "gc";
  if (!citizenOrGc && isDocumentDetailsMissing(effective)) {
    return { status: "Document details missing", dueDate: null };
  }

  // 7. Otherwise.
  return { status: "Compliant", dueDate: null };
}

function isDocumentDetailsMissing(record: I9RecordLike): boolean {
  const hasListA = !!record.listA?.code;
  const hasListBC = !!record.listB?.code && !!record.listC?.code;
  return !hasListA && !hasListBC;
}

// ───────────────────────────── 4. Validation ─────────────────────────────

function validFromLabel(sub: SubType): string {
  switch (sub) {
    case "NEW_HIRE":
    case "REHIRE_NEW":
    case "REHIRE_SUPP_B":
      return "First day of work (for pay) / Rehire date";
    case "REVERIFY":
      return "Reverification date";
    case "NAME_CHANGE":
      return "Name change date";
    case "DOC_UPDATE":
      return "Date received";
    case "CORRECTION":
      return "Correction date";
    case "DESTROYED":
      return "Destruction date";
    default:
      return "Valid From date";
  }
}

export function validate(record: I9RecordLike, ctx: EmployeeContext, allRecords: I9RecordLike[]): ValidationResult {
  const errors: Finding[] = [];
  const warnings: Finding[] = [];
  const sub = record.subtype;

  if (!sub) {
    errors.push({ code: "E1", message: "Choose the I-9 sub type" });
    return { errors, warnings };
  }
  if (!record.validFrom) {
    errors.push({ code: "E2", message: "Enter the " + validFromLabel(sub) });
  }

  const receiptPresented = !!record.receipt?.type;
  const option = record.docOption;
  const hasListA = !!record.listA?.code;
  const hasListB = !!record.listB?.code;
  const hasListC = !!record.listC?.code;

  if (!receiptPresented) {
    const needsOption =
      sub === "NEW_HIRE" || sub === "REHIRE_NEW" || sub === "REVERIFY" || (sub === "REHIRE_SUPP_B" && !!record.priorAuthExpired);
    if (needsOption && !option) {
      errors.push({ code: "E3", message: "Choose the Document Option" });
    }

    if (option === "LIST_A") {
      if (!hasListA) errors.push({ code: "E4", message: "Pick the List A document" });
      if (hasListB || hasListC) errors.push({ code: "E5", message: "Clear List B / C – not used with List A" });
    } else if (option === "LIST_BC") {
      if (!hasListB || !hasListC) errors.push({ code: "E6", message: "Need one List B AND one List C document" });
      if (hasListA) errors.push({ code: "E7", message: "Clear List A – not used with List B + C" });
    } else if (option === "LIST_C_ONLY") {
      if (sub === "NEW_HIRE" || sub === "REHIRE_NEW") {
        errors.push({ code: "E8", message: "A new hire needs List A or List B + List C" });
      }
      if (hasListA || hasListB) {
        errors.push({ code: "E10", message: "Clear List A / B – reverification with List C uses only List C" });
      }
      if (!hasListC) errors.push({ code: "E6", message: "Need one List B AND one List C document" });
    }

    if ((sub === "REVERIFY" || sub === "REHIRE_SUPP_B") && hasListB) {
      errors.push({ code: "E9", message: "List B documents cannot be used for reverification – use List A or List C" });
    }
  }

  const listACode = hasListA ? record.listA?.code : null;
  const passportBased = !!listACode && [A_US_PASSPORT, A_FPI, A_FSM_RMI, A_TEMP_I551].includes(listACode);
  if (passportBased) {
    const missingPassport = !ctx.passportNumber || !ctx.passportExpiry;
    if (missingPassport) errors.push({ code: "E11", message: "Enter the Passport Number / Passport Expiry Date" });
  }

  if (listACode === A_FPI || listACode === A_FSM_RMI) {
    const i94 = record.i94;
    const hasAdmitOrDs = !!i94 && (!!i94.admitUntil || !!i94.ds);
    if (!i94 || !i94.number || !hasAdmitOrDs) {
      errors.push({ code: "E12", message: "Enter the I-94 number and admit-until date (or D/S)" });
    } else if (i94.ds && !i94.authEndDate) {
      errors.push({ code: "E13", message: "Enter the authorization end date from the I-20 / EAD" });
    }
  }

  if (listACode === A_EAD && !record.listA?.expiry) {
    errors.push({ code: "E14", message: "Enter the List A expiration date" });
  }
  if (listACode === A_TEMP_I551 && !record.listA?.expiry && !record.listA?.noExpiry) {
    errors.push({ code: "E14", message: "Enter the List A expiration date" });
  }
  if (hasListC && record.listC?.code === C_DHS_EAD && !record.listC?.expiry) {
    errors.push({ code: "E15", message: "Enter the List C expiration date" });
  }
  if (hasListC && record.listC?.code === C_SSN && record.listC?.restrictedSsn) {
    errors.push({ code: "E17", message: "A restricted Social Security card is not an acceptable List C document" });
  }

  if (record.completedOn && record.section1Date && isBefore(record.completedOn, record.section1Date)) {
    errors.push({ code: "E18", message: "Section 2 cannot be completed before Section 1" });
  }

  if (sub === "REHIRE_SUPP_B" && record.originalI9Date && record.validFrom) {
    const threeYearsLater = addYears(record.originalI9Date, I9_CONFIG.rehireSuppBYears);
    if (isAfter(record.validFrom, threeYearsLater)) {
      errors.push({ code: "E19", message: "More than 3 years since the original I-9 – complete a New I-9 – Rehire instead" });
    }
  }

  // E16: presented document expired on or before the examination date,
  // with no valid extension or receipt covering it.
  const examDate = record.completedOn || record.validFrom;
  if (examDate && !record.extensionType && !record.receipt?.type) {
    const docExpiry = hasListA ? record.listA?.expiry : hasListC ? record.listC?.expiry : null;
    if (docExpiry && isBefore(docExpiry, examDate)) {
      errors.push({ code: "E16", message: "Documents must be unexpired on the day they are examined" });
    }
  }

  if (record.extensionType) {
    const extError = extensionConditionError(record);
    if (extError) errors.push({ code: "E20", message: extError });
  }

  if (record.remoteExam && !I9_CONFIG.everifyEnrolled) {
    errors.push({ code: "E21", message: "Remote examination is only allowed for employers enrolled in E-Verify" });
  }
  // E22 (document copies) / E23 (Supplement A file) / E27 (at least one
  // file) need this record's attachments, which only exist once it has an
  // id — checked by the caller against uploaded files, not here.

  if (sub === "DESTROYED") {
    const retain = retainUntil(ctx.hireDate, ctx.lastDay);
    if (retain && record.validFrom && isBefore(record.validFrom, retain)) {
      errors.push({ code: "E24", message: "Retention has not ended – keep this I-9 until " + retain });
    }
  }

  if (sub === "CORRECTION" && (!record.correctsRecordId || !record.correctionReason)) {
    errors.push({ code: "E25", message: "Pick the record being corrected and give a reason" });
  }

  if (sub === "DOC_UPDATE") {
    const anyPassport = !!ctx.passportNumber || !!ctx.passportExpiry;
    const anyI94 = !!record.i94?.number || !!record.i94?.admitUntil;
    if (!anyPassport && !anyI94) {
      errors.push({ code: "E26", message: "Enter the new passport and / or I-94 details" });
    }
  }

  // Warnings.
  if (listACode === A_US_PASSPORT && (ctx.visaStatus || "").toLowerCase() !== "citizen") {
    warnings.push({ code: "W1", message: `U.S. passport recorded but Visa Status is ${ctx.visaStatus} – please check` });
  }
  if (listACode === A_GREEN_CARD && (ctx.visaStatus || "").toLowerCase() !== "gc") {
    warnings.push({ code: "W2", message: `Green Card recorded but Visa Status is ${ctx.visaStatus} – please check` });
  }
  if (record.section1Date && ctx.hireDate && isAfter(record.section1Date, ctx.hireDate)) {
    warnings.push({ code: "W3", message: "Section 1 was due by the first day of work" });
  }
  const due = section2Due(record, ctx, null);
  if (due && record.completedOn && isAfter(record.completedOn, due)) {
    warnings.push({ code: "W4", message: `Completed late (due ${due}) – add the reason in Additional information` });
  }
  if ((ctx.visaStatus || "").toLowerCase() === "h4") {
    warnings.push({ code: "W5", message: "H-4 without an EAD is not authorized to work – please check" });
  }

  return { errors, warnings };
}

// ───────────────────────────── 8. Tasks ──────────────────────────────────

export function openTasks(ctx: EmployeeContext, records: I9RecordLike[], today: IsoDate): Task[] {
  const tasks: Task[] = [];
  const status = employeeI9Status(ctx, records, today);

  if (hasExited(ctx)) {
    if (!ctx.lastDay || !ctx.hireDate) {
      tasks.push({ employeeId: ctx.employeeId, type: "EXIT_DETAILS_MISSING", label: "Exit details missing", priority: "LOW", due: null, whereToFix: "Employee record" });
    } else {
      const retain = retainUntil(ctx.hireDate, ctx.lastDay);
      const latest = latestRecord(records);
      const destroyed = latest?.subtype === "DESTROYED";
      if (retain && isAfter(today, retain) && !destroyed) {
        tasks.push({ employeeId: ctx.employeeId, type: "I9_RETENTION_ENDED", label: "I-9 retention ended", priority: "LOW", due: retain, whereToFix: "Destroy securely, then add DESTROYED" });
      }
    }
    return tasks;
  }

  if (status.status) {
    switch (status.status) {
      case "New I-9 needed":
      case "New I-9 OVERDUE":
      case "Rehire I-9 needed":
      case "Rehire I-9 OVERDUE":
      case "No I-9 on file":
        tasks.push({ employeeId: ctx.employeeId, type: "NEW_I9_NEEDED", label: status.status, priority: "HIGH", due: status.dueDate, whereToFix: "Add a NEW_HIRE / rehire record" });
        break;
      case "I-9 in progress":
      case "I-9 OVERDUE":
        tasks.push({ employeeId: ctx.employeeId, type: "I9_INCOMPLETE", label: status.status, priority: "HIGH", due: status.dueDate, whereToFix: "Fill the Section 2 / Supplement B date" });
        break;
      case "Reverification due":
      case "Reverification OVERDUE": {
        const highPriority = status.status === "Reverification OVERDUE" || (!!status.dueDate && daysBetween(today, status.dueDate) <= I9_CONFIG.highPriorityDays);
        tasks.push({ employeeId: ctx.employeeId, type: "I9_REVERIFICATION", label: status.status, priority: highPriority ? "HIGH" : "MEDIUM", due: status.dueDate, whereToFix: "Add a REVERIFY record" });
        break;
      }
      case "Expiry date missing":
      case "Document details missing":
        tasks.push({ employeeId: ctx.employeeId, type: "I9_DETAILS_MISSING", label: status.status, priority: "MEDIUM", due: null, whereToFix: "Edit the latest record" });
        break;
      default:
        break; // Compliant: nothing to surface.
    }
  }

  const latest = latestRecord(records);
  if (latest) {
    const effective = effectiveRecord(latest, records)!;
    const result = effective.everify?.result;
    const isReverifyTab = effective.subtype === "REVERIFY";
    if (!isReverifyTab && I9_CONFIG.everifyEnrolled && result && !["AUTHORIZED", "CLOSED", "NA"].includes(result)) {
      const mismatch = result === "TNC_MISMATCH";
      tasks.push({ employeeId: ctx.employeeId, type: "EVERIFY_PENDING", label: "E-Verify pending", priority: mismatch ? "HIGH" : "MEDIUM", due: null, whereToFix: "Latest record → E-Verify" });
    }
    if (effective.receipt?.type && effective.receipt?.validUntil) {
      tasks.push({ employeeId: ctx.employeeId, type: "RECEIPT_FOLLOWUP", label: "Receipt follow-up", priority: "HIGH", due: effective.receipt.validUntil, whereToFix: "Record the real document" });
    }
  }

  if (ctx.passportExpiry) {
    const daysLeft = daysBetween(today, ctx.passportExpiry);
    if (daysLeft <= I9_CONFIG.passportAlertDays) {
      const expired = isBefore(ctx.passportExpiry, today);
      tasks.push({ employeeId: ctx.employeeId, type: "PASSPORT_EXPIRY", label: "Passport expiry", priority: expired ? "HIGH" : "MEDIUM", due: ctx.passportExpiry, whereToFix: "DOC_UPDATE with the new passport" });
    }
  }

  if (latest) {
    const effective = effectiveRecord(latest, records)!;
    const admitUntil = effective.i94?.admitUntil;
    if (admitUntil) {
      const daysLeft = daysBetween(today, admitUntil);
      if (daysLeft <= I9_CONFIG.i94AlertDays) {
        const expired = isBefore(admitUntil, today);
        tasks.push({ employeeId: ctx.employeeId, type: "I94_EXPIRY", label: "I-94 expiry", priority: expired ? "HIGH" : "MEDIUM", due: admitUntil, whereToFix: "DOC_UPDATE / REVERIFY" });
      }
    }
  }

  return tasks;
}

// ───────────────────────────── extension calculators (5.3) ───────────────
// Mirrors I9ExtensionCalculator.java exactly — each type has a matching
// `xError` function that both `applyExtension` and
// `extensionConditionError` consult, so the two never drift apart.

function d(record: I9RecordLike, key: string): string | undefined {
  return record.extensionDetails?.[key];
}
function dBool(record: I9RecordLike, key: string): boolean {
  return record.extensionDetails?.[key] === "true";
}

function applyExtension(record: I9RecordLike, baseBeforeExtension: IsoDate | null): IsoDate | null {
  const type = record.extensionType;
  if (!type) return null;
  switch (type) {
    case "EAD_AUTO_EXT":
      return eadAutoExtensionError(record) ? null : eadAutoExtension(record);
    case "H1B_240_DAY":
      return h1b240DayError(record) ? null : h1b240Day(record);
    case "H1B_PORTABILITY_AC21":
      return h1bPortabilityAc21Error(record) ? null : h1bPortabilityAc21(record);
    case "STEM_OPT_180_DAY":
      return stemOpt180DayError(record) ? null : stemOpt180Day(record);
    case "CAP_GAP":
      return capGapError(record) ? null : capGap(record);
    case "TPS_FEDERAL_REGISTER":
      return tpsFederalRegister(record);
    case "GREEN_CARD_EXTENSION":
      return null; // Always "Not required" — see neverReverify.
    default:
      return null;
  }
}

function extensionConditionError(record: I9RecordLike): string | null {
  const type = record.extensionType;
  if (!type) return null;
  switch (type) {
    case "EAD_AUTO_EXT":
      return eadAutoExtensionError(record);
    case "H1B_240_DAY":
      return h1b240DayError(record);
    case "H1B_PORTABILITY_AC21":
      return h1bPortabilityAc21Error(record);
    case "STEM_OPT_180_DAY":
      return stemOpt180DayError(record);
    case "CAP_GAP":
      return capGapError(record);
    case "TPS_FEDERAL_REGISTER":
      return d(record, "noticeCitation") ? null : "Enter the TPS Federal Register notice citation";
    case "GREEN_CARD_EXTENSION":
      return null;
    default:
      return null;
  }
}

function eadAutoExtension(record: I9RecordLike): IsoDate {
  const cardExpiry = record.listA!.expiry!;
  let extended = addDays(cardExpiry, I9_CONFIG.eadAutoExtDays);
  const categoryOnReceipt = d(record, "categoryOnReceipt");
  if (categoryOnReceipt && I9_CONFIG.spouseEadCategories.includes(categoryOnReceipt)) {
    const i94End = record.i94?.admitUntil;
    if (i94End && isBefore(i94End, extended)) extended = i94End;
  }
  return extended;
}

function eadAutoExtensionError(record: I9RecordLike): string | null {
  const cardExpiry = record.listA?.expiry;
  const received = d(record, "receivedDate");
  if (!cardExpiry || !received) return "Enter the EAD auto-extension receipt details";
  if (!isBefore(received, I9_CONFIG.eadAutoExtCutoff)) {
    return "Renewals filed on or after 30-Oct-2025 get no automatic extension – reverify by the card expiry date";
  }
  if (!isBefore(received, cardExpiry)) {
    return "The extension receipt must be received before the card expired";
  }
  const onCard = d(record, "categoryOnCard");
  const onReceipt = d(record, "categoryOnReceipt");
  const bothTps = (onCard === "A12" || onCard === "C19") && (onReceipt === "A12" || onReceipt === "C19");
  if (onCard && onReceipt && onCard !== onReceipt && !bothTps) {
    return "EAD auto-extension requires the receipt category to match the card (or both be TPS A12/C19)";
  }
  return null;
}

function h1b240Day(record: I9RecordLike): IsoDate {
  const i94Expiry = record.i94!.admitUntil!;
  let extended = addDays(i94Expiry, I9_CONFIG.h1b240Days);
  const decision = d(record, "decisionDate");
  if (decision && isBefore(decision, extended)) extended = decision;
  return extended;
}

function h1b240DayError(record: I9RecordLike): string | null {
  const i94Expiry = record.i94?.admitUntil;
  if (!i94Expiry) return "Enter the I-94 expiry this extension applies to";
  const filed = d(record, "filingDate");
  return filed && isAfter(filed, i94Expiry)
    ? "The 240-day extension requires the petition to have been filed on or before the I-94 expiry date"
    : null;
}

function h1bPortabilityAc21(record: I9RecordLike): IsoDate {
  const priorI94Expiry = record.i94!.admitUntil!;
  const status = d(record, "petitionStatus");
  const filed = d(record, "filingDate");
  if (status === "PENDING" && filed && !isAfter(filed, priorI94Expiry)) {
    return addDays(priorI94Expiry, I9_CONFIG.h1b240Days);
  }
  return priorI94Expiry;
}

function h1bPortabilityAc21Error(record: I9RecordLike): string | null {
  if (!record.i94?.admitUntil) return "Enter the prior I-94 expiry this extension applies to";
  if (record.subtype !== "NEW_HIRE") return "H-1B portability (AC21) can only be used on a New Hire I-9";
  const filed = d(record, "filingDate");
  return filed && record.validFrom && isAfter(filed, record.validFrom)
    ? "H-1B portability (AC21) requires the I-129 to have been filed on or before the first day of work"
    : null;
}

function stemOpt180Day(record: I9RecordLike): IsoDate {
  const eadExpiry = record.listA!.expiry!;
  let extended = addDays(eadExpiry, I9_CONFIG.stemOptExtDays);
  const decision = d(record, "decisionDate");
  if (decision && isBefore(decision, extended)) extended = decision;
  return extended;
}

function stemOpt180DayError(record: I9RecordLike): string | null {
  const eadExpiry = record.listA?.expiry;
  if (!eadExpiry) return "Enter the OPT EAD expiry this extension applies to";
  const received = d(record, "receiptDate");
  if (received && isAfter(received, eadExpiry)) {
    return "The STEM OPT 180-day extension requires the I-765 receipt to be dated on or before the EAD expiry";
  }
  return dBool(record, "i20Endorsed") ? null : "The STEM OPT 180-day extension requires the I-20 to be endorsed for STEM";
}

function capGap(record: I9RecordLike): IsoDate | null {
  const status = d(record, "petitionStatus");
  if (status === "DENIED" || status === "WITHDRAWN") {
    const decision = d(record, "decisionDate");
    return decision ?? null;
  }
  const approvedStart = d(record, "approvedStartDate");
  if (status === "APPROVED" && approvedStart) return approvedStart;
  const fyStr = d(record, "requestedStartFY");
  if (!fyStr) return null;
  const fy = Number(fyStr);
  return `${fy + 1}-04-01`;
}

function capGapError(record: I9RecordLike): string | null {
  const eadExpiry = record.listA?.expiry;
  const received = d(record, "cosReceiptDate");
  return eadExpiry && received && isAfter(received, eadExpiry)
    ? "Cap-gap requires the H-1B change-of-status petition to have been filed before the OPT EAD expired"
    : null;
}

function tpsFederalRegister(record: I9RecordLike): IsoDate | null {
  return d(record, "extendedThroughDate") ?? null;
}

function extensionSuggestedNote(type: ExtensionType, record: I9RecordLike): string | null {
  switch (type) {
    case "H1B_240_DAY":
      return "240-Day Ext. " + formatMdy(d(record, "filingDate"));
    case "H1B_PORTABILITY_AC21":
      return "AC-21 " + formatMdy(d(record, "filingDate"));
    case "EAD_AUTO_EXT":
      return "EAD EXT";
    case "CAP_GAP":
      return "CAP-GAP";
    case "STEM_OPT_180_DAY":
      return "STEM OPT EXT";
    default:
      return null;
  }
}

function formatMdy(iso?: string): string {
  if (!iso) return "";
  const [y, m, dd] = iso.split("-");
  return `${m}/${dd}/${y}`;
}
