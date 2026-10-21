// Every scenario from the I-9 rules spec's section 12 test table, each as
// its own test (today = 2026-10-21, default config, unless the scenario
// says otherwise). This is the frontend half of the rules engine — see
// also I9RulesTest.java on the backend, which ports the same table and is
// the authoritative copy (the backend always re-validates).
import {
  I9RecordLike,
  EmployeeContext,
  A_US_PASSPORT,
  A_GREEN_CARD,
  A_EAD,
  A_FPI,
  C_SSN,
  C_DHS_EAD,
  section2Due,
  reverifyBy,
  employeeI9Status,
  openTasks,
  validate,
  retainUntil,
  i9Count,
  latestRecord,
  effectiveRecord,
  recordStatus,
  receiptValidUntil,
  suggestedNote,
} from "./i9Rules";
import { I9_CONFIG } from "./i9Config";

const TODAY = "2026-10-21";

function record(subtype: I9RecordLike["subtype"], validFrom: string, id: number | string = 1): I9RecordLike {
  return { id, employeeId: 100, recordNo: 1, subtype, validFrom };
}

function listA(r: I9RecordLike, code: string, number: string | null, expiry: string | null) {
  r.docOption = "LIST_A";
  r.listA = { code, number: number ?? undefined, expiry: expiry ?? undefined };
}

function listBC(r: I9RecordLike, listBCode: string, listCCode: string, listCExpiry: string | null, restrictedSsn = false) {
  r.docOption = "LIST_BC";
  r.listB = { code: listBCode, number: "B-1" };
  r.listC = { code: listCCode, number: "C-1", expiry: listCExpiry ?? undefined, restrictedSsn };
}

function i94(r: I9RecordLike, number: string, admitUntil: string | null) {
  r.i94 = { ...(r.i94 || {}), number, admitUntil: admitUntil ?? undefined };
}

function ctx(hireDate: string | null, lastDay: string | null, status: string, visa: string, passportNumber: string | null = null, passportExpiry: string | null = null): EmployeeContext {
  return {
    employeeId: 100,
    hireDate: hireDate ?? undefined,
    lastDay: lastDay ?? undefined,
    employmentStatus: status,
    visaStatus: visa,
    passportNumber: passportNumber ?? undefined,
    passportExpiry: passportExpiry ?? undefined,
  };
}

function setExtension(r: I9RecordLike, type: I9RecordLike["extensionType"], details: Record<string, string>) {
  r.extensionType = type;
  r.extensionDetails = details;
}

afterEach(() => {
  I9_CONFIG.everifyEnrolled = true;
});

test("scenario1: citizen new hire, US passport", () => {
  const r = record("NEW_HIRE", "2026-10-19");
  r.section1Date = "2026-10-19";
  r.completedOn = "2026-10-21";
  listA(r, A_US_PASSPORT, "P1", "2031-05-01");
  r.everify = { result: "AUTHORIZED" };
  const c = ctx("2026-10-19", null, "Active", "Citizen");

  expect(section2Due(r, c, null)).toBe("2026-10-22");
  expect(reverifyBy(r, [r]).notRequired).toBe(true);
  expect(employeeI9Status(c, [r], TODAY).status).toBe("Compliant");
  expect(openTasks(c, [r], TODAY)).toHaveLength(0);
});

test("scenario2: new hire needed then overdue", () => {
  const c = ctx("2026-10-16", null, "Active", "Citizen");
  const onTime = employeeI9Status(c, [], "2026-10-21");
  expect(onTime.status).toBe("New I-9 needed");
  expect(onTime.dueDate).toBe("2026-10-21");

  const late = employeeI9Status(c, [], "2026-10-22");
  expect(late.status).toBe("New I-9 OVERDUE");

  const tasks = openTasks(c, [], "2026-10-21");
  expect(tasks).toHaveLength(1);
  expect(tasks[0].priority).toBe("HIGH");
});

test("scenario3: citizen List B + unrestricted SSN card", () => {
  const r = record("NEW_HIRE", "2026-01-01");
  r.completedOn = "2026-01-01";
  listBC(r, "B_DL", C_SSN, null, false);
  const c = ctx("2026-01-01", null, "Active", "Citizen");

  expect(reverifyBy(r, [r]).notRequired).toBe(true);
  expect(employeeI9Status(c, [r], TODAY).status).toBe("Compliant");
});

test("scenario4: Green Card never reverifies even after expiry", () => {
  const r = record("NEW_HIRE", "2020-01-01");
  r.completedOn = "2020-01-01";
  listA(r, A_GREEN_CARD, "GC1", "2027-01-15");
  const c = ctx("2020-01-01", null, "Active", "GC");

  expect(reverifyBy(r, [r]).notRequired).toBe(true);
  const tasks = openTasks(c, [r], "2027-02-01");
  expect(tasks.find((t) => t.type === "I9_REVERIFICATION")).toBeUndefined();
});

test("scenario5: H1B FPI reverification due", () => {
  const r = record("NEW_HIRE", "2026-01-01");
  r.completedOn = "2026-01-01";
  listA(r, A_FPI, "FP1", null);
  i94(r, "I94-1", "2026-12-31");
  const c = ctx("2026-01-01", null, "Active", "H1B");

  const rv = reverifyBy(r, [r]);
  expect(rv.date).toBe("2026-12-31");
  expect(employeeI9Status(c, [r], TODAY).status).toBe("Reverification due");

  const tasks = openTasks(c, [r], TODAY);
  const reverifyTask = tasks.find((t) => t.type === "I9_REVERIFICATION")!;
  expect(reverifyTask.priority).toBe("MEDIUM");
  expect(tasks.find((t) => t.type === "I94_EXPIRY")).toBeUndefined();
});

test("scenario6: H1B FPI reverification overdue and I-94 expiry", () => {
  const r = record("NEW_HIRE", "2026-01-01");
  r.completedOn = "2026-01-01";
  listA(r, A_FPI, "FP1", null);
  i94(r, "I94-1", "2026-10-01");
  const c = ctx("2026-01-01", null, "Active", "H1B");

  expect(employeeI9Status(c, [r], TODAY).status).toBe("Reverification OVERDUE");
  const tasks = openTasks(c, [r], TODAY);
  expect(tasks.find((t) => t.type === "I9_REVERIFICATION" && t.priority === "HIGH")).toBeTruthy();
  expect(tasks.find((t) => t.type === "I94_EXPIRY" && t.priority === "HIGH")).toBeTruthy();
});

test("scenario7: FPI missing passport number blocks save", () => {
  const r = record("NEW_HIRE", "2026-01-01");
  listA(r, A_FPI, null, null);
  i94(r, "I94-1", "2026-12-31");
  const c = ctx("2026-01-01", null, "Active", "H1B");

  const result = validate(r, c, []);
  expect(result.errors.some((f) => f.code === "E11")).toBe(true);
});

test("scenario8: H1B far-future I-94 compliant, passport expiry task", () => {
  const r = record("NEW_HIRE", "2026-01-01");
  r.completedOn = "2026-01-01";
  listA(r, A_FPI, "FP1", null);
  i94(r, "I94-1", "2028-09-30");
  const c = ctx("2026-01-01", null, "Active", "H1B", "PP1", "2027-01-15");

  expect(reverifyBy(r, [r]).date).toBe("2028-09-30");
  expect(employeeI9Status(c, [r], TODAY).status).toBe("Compliant");

  const tasks = openTasks(c, [r], TODAY);
  const passportTask = tasks.find((t) => t.type === "PASSPORT_EXPIRY")!;
  expect(passportTask.priority).toBe("MEDIUM");
  expect(tasks.find((t) => t.type === "I9_REVERIFICATION")).toBeUndefined();
});

test("scenario9: initial OPT EAD reverification due", () => {
  const r = record("NEW_HIRE", "2026-01-01");
  r.completedOn = "2026-01-01";
  listA(r, A_EAD, "EAD1", "2026-11-30");
  const c = ctx("2026-01-01", null, "Active", "OPT");

  const rv = reverifyBy(r, [r]);
  expect(rv.date).toBe("2026-11-30");
  expect(rv.source).toBe("This record");
  const task = openTasks(c, [r], TODAY).find((t) => t.type === "I9_REVERIFICATION")!;
  expect(task.priority).toBe("MEDIUM");
});

test("scenario10: EAD no expiry blocked, then MIGRATED shows expiry missing", () => {
  const r = record("NEW_HIRE", "2026-01-01");
  listA(r, A_EAD, "EAD1", null);
  const c = ctx("2026-01-01", null, "Active", "OPT", "PP1", "2030-01-01");
  const result = validate(r, c, []);
  expect(result.errors.some((f) => f.code === "E14")).toBe(true);

  const migrated = record("MIGRATED", "2020-01-01");
  migrated.completedOn = "2020-01-01";
  listA(migrated, A_EAD, "EAD1", null);
  const migratedCtx = ctx("2020-01-01", null, "Active", "OPT", "PP1", "2030-01-01");

  expect(employeeI9Status(migratedCtx, [migrated], TODAY).status).toBe("Expiry date missing");
  const task = openTasks(migratedCtx, [migrated], TODAY).find((t) => t.type === "I9_DETAILS_MISSING")!;
  expect(task.priority).toBe("MEDIUM");
});

test("scenario11: EAD auto-extension, categories match", () => {
  const r = record("REVERIFY", "2026-10-01");
  r.completedOn = "2026-10-01";
  listA(r, A_EAD, "EAD1", "2026-03-01");
  setExtension(r, "EAD_AUTO_EXT", { receivedDate: "2025-09-15", categoryOnCard: "A11", categoryOnReceipt: "A11" });
  const c = ctx("2024-01-01", null, "Active", "OPT");

  const rv = reverifyBy(r, [r]);
  expect(rv.date).toBe("2027-08-23");
  expect(suggestedNote(r)).toBe("EAD EXT");
  expect(employeeI9Status(c, [r], TODAY).status).toBe("Compliant");
});

test("scenario11b: EAD auto-extension, spouse category uses earlier I-94", () => {
  const r = record("REVERIFY", "2026-10-01");
  r.completedOn = "2026-10-01";
  listA(r, A_EAD, "EAD1", "2026-03-01");
  i94(r, "I94-X", "2027-02-15");
  setExtension(r, "EAD_AUTO_EXT", { receivedDate: "2025-09-15", categoryOnCard: "C26", categoryOnReceipt: "C26" });

  expect(reverifyBy(r, [r]).date).toBe("2027-02-15");
});

test("scenario12: EAD auto-extension after cutoff blocked, overdue without it", () => {
  const r = record("REVERIFY", "2026-10-01");
  r.completedOn = "2026-10-01";
  listA(r, A_EAD, "EAD1", "2026-03-01");
  setExtension(r, "EAD_AUTO_EXT", { receivedDate: "2025-11-15", categoryOnCard: "A11", categoryOnReceipt: "A11" });
  const c = ctx("2024-01-01", null, "Active", "OPT");

  const result = validate(r, c, []);
  expect(result.errors.some((f) => f.code === "E20" && f.message.includes("Renewals filed on or after 30-Oct-2025"))).toBe(true);

  const rv = reverifyBy(r, [r]);
  expect(rv.date).toBe("2026-03-01");
  expect(employeeI9Status(c, [r], TODAY).status).toBe("Reverification OVERDUE");
});

test("scenario13: STEM OPT 180-day extension", () => {
  const r = record("REVERIFY", "2026-10-01");
  r.completedOn = "2026-10-01";
  listA(r, A_EAD, "EAD1", "2026-09-30");
  setExtension(r, "STEM_OPT_180_DAY", { receiptDate: "2026-08-01", i20Endorsed: "true" });
  const c = ctx("2024-01-01", null, "Active", "OPT");

  expect(reverifyBy(r, [r]).date).toBe("2027-03-29");
  expect(employeeI9Status(c, [r], TODAY).status).toBe("Compliant");
});

test("scenario13b: STEM OPT receipt after expiry blocked", () => {
  const r = record("REVERIFY", "2026-10-01");
  listA(r, A_EAD, "EAD1", "2026-09-30");
  setExtension(r, "STEM_OPT_180_DAY", { receiptDate: "2026-10-05", i20Endorsed: "true" });
  const c = ctx("2024-01-01", null, "Active", "OPT");

  const result = validate(r, c, []);
  expect(result.errors.some((f) => f.code === "E20")).toBe(true);
});

test("scenario14: Cap-gap pending then approved overdue", () => {
  const pending = record("REVERIFY", "2026-10-01");
  listA(pending, A_EAD, "EAD1", "2026-06-15");
  setExtension(pending, "CAP_GAP", { cosReceiptDate: "2026-04-01", petitionStatus: "PENDING", requestedStartFY: "2026" });
  expect(reverifyBy(pending, [pending]).date).toBe("2027-04-01");

  const approved = record("REVERIFY", "2026-10-01");
  approved.completedOn = "2026-10-01";
  listA(approved, A_EAD, "EAD1", "2026-06-15");
  setExtension(approved, "CAP_GAP", { cosReceiptDate: "2026-04-01", petitionStatus: "APPROVED", approvedStartDate: "2026-10-01" });
  const rv = reverifyBy(approved, [approved]);
  expect(rv.date).toBe("2026-10-01");

  const c = ctx("2024-01-01", null, "Active", "OPT");
  expect(employeeI9Status(c, [approved], TODAY).status).toBe("Reverification OVERDUE");
});

test("scenario15: H1B 240-day extension", () => {
  const r = record("REVERIFY", "2026-10-01");
  r.completedOn = "2026-10-01";
  listA(r, A_FPI, "FP1", null);
  i94(r, "I94-1", "2026-10-01");
  setExtension(r, "H1B_240_DAY", { filingDate: "2026-08-15", sameEmployer: "true" });
  const c = ctx("2024-01-01", null, "Active", "H1B");

  const rv = reverifyBy(r, [r]);
  expect(rv.date).toBe("2027-05-29");
  expect(employeeI9Status(c, [r], TODAY).status).toBe("Compliant");
  expect(suggestedNote(r)).toBe("240-Day Ext. 08/15/2026");
});

test("scenario16: H1B 240-day extension filed late blocked, overdue without it", () => {
  const r = record("REVERIFY", "2026-10-01");
  r.completedOn = "2026-10-01";
  listA(r, A_FPI, "FP1", null);
  i94(r, "I94-1", "2026-10-01");
  setExtension(r, "H1B_240_DAY", { filingDate: "2026-10-05", sameEmployer: "true" });
  const c = ctx("2024-01-01", null, "Active", "H1B", "PP1", "2030-01-01");

  const result = validate(r, c, []);
  expect(result.errors.some((f) => f.code === "E20")).toBe(true);
  expect(reverifyBy(r, [r]).date).toBe("2026-10-01");
  expect(employeeI9Status(c, [r], TODAY).status).toBe("Reverification OVERDUE");
});

test("scenario17: H1B portability (AC21) new hire", () => {
  const r = record("NEW_HIRE", "2026-10-19");
  r.completedOn = "2026-10-19";
  listA(r, A_FPI, "FP1", null);
  i94(r, "I94-1", "2027-03-01");
  setExtension(r, "H1B_PORTABILITY_AC21", { filingDate: "2026-10-10" });
  const c = ctx("2026-10-19", null, "Active", "H1B");

  expect(section2Due(r, c, null)).toBe("2026-10-22");
  expect(reverifyBy(r, [r]).date).toBe("2027-03-01");
  expect(suggestedNote(r)).toBe("AC-21 10/10/2026");

  setExtension(r, "H1B_PORTABILITY_AC21", { filingDate: "2026-10-10", petitionStatus: "PENDING" });
  expect(reverifyBy(r, [r]).date).toBe("2027-10-27");
});

test("scenario18: H4 EAD employee changes to H1B, reverify with new I-94", () => {
  const oldH4 = record("NEW_HIRE", "2024-01-01", 1);
  oldH4.completedOn = "2024-01-01";
  listA(oldH4, A_EAD, "H4EAD1", "2026-01-01");

  const reverify = record("REVERIFY", "2026-10-01", 2);
  reverify.completedOn = "2026-10-01";
  listA(reverify, A_FPI, "FP1", null);
  i94(reverify, "I94-1", "2029-09-30");

  const all = [oldH4, reverify];
  const latest = latestRecord(all)!;
  expect(latest.id).toBe(2);
  expect(reverifyBy(latest, all).date).toBe("2029-09-30");

  const c = ctx("2024-01-01", null, "Active", "H1B");
  expect(employeeI9Status(c, all, TODAY).status).toBe("Compliant");
});

test("scenario19: L-2S spouse, List C DHS EAD", () => {
  const r = record("NEW_HIRE", "2026-01-01");
  r.completedOn = "2026-01-01";
  listBC(r, "B_DL", C_DHS_EAD, "2027-06-30");
  const c = ctx("2026-01-01", null, "Active", "L1");

  expect(reverifyBy(r, [r]).date).toBe("2027-06-30");
  expect(employeeI9Status(c, [r], TODAY).status).toBe("Compliant");
});

test("scenario20: new hire List C only blocked", () => {
  const r = record("NEW_HIRE", "2026-01-01");
  r.docOption = "LIST_C_ONLY";
  r.listC = { code: C_SSN, number: "SSN1" };
  const c = ctx("2026-01-01", null, "Active", "Citizen");

  const result = validate(r, c, []);
  expect(result.errors.some((f) => f.code === "E8")).toBe(true);
});

test("scenario21: reverify with List B blocked", () => {
  const r = record("REVERIFY", "2026-01-01");
  listBC(r, "B_DL", C_SSN, null);
  const c = ctx("2024-01-01", null, "Active", "H1B");

  const result = validate(r, c, []);
  expect(result.errors.some((f) => f.code === "E9")).toBe(true);
});

test("scenario22: rehire Supplement B within 3 years", () => {
  const r = record("REHIRE_SUPP_B", "2026-11-02");
  r.originalI9Date = "2024-05-01";
  r.priorAuthExpired = false;
  const c = ctx("2026-11-02", null, "Active", "Citizen");

  const result = validate(r, c, []);
  expect(result.errors).toHaveLength(0);
  expect(section2Due(r, c, null)).toBe("2026-11-02");
});

test("scenario23: rehire Supplement B over 3 years blocked", () => {
  const r = record("REHIRE_SUPP_B", "2026-11-02");
  r.originalI9Date = "2022-03-01";
  r.priorAuthExpired = false;
  const c = ctx("2026-11-02", null, "Active", "Citizen");

  const result = validate(r, c, []);
  expect(result.errors.some((f) => f.code === "E19")).toBe(true);

  const asNewHire = record("REHIRE_NEW", "2026-11-02");
  expect(section2Due(asNewHire, c, null)).toBe("2026-11-05");
});

test("scenario24: exited retention ended, then DESTROYED clears it", () => {
  const c = ctx("2020-01-06", "2021-02-15", "Inactive", "Citizen");
  expect(retainUntil(c.hireDate, c.lastDay)).toBe("2023-01-06");

  const beforeDestroy = openTasks(c, [], TODAY);
  expect(beforeDestroy.find((t) => t.type === "I9_RETENTION_ENDED" && t.priority === "LOW")).toBeTruthy();

  const destroyed = record("DESTROYED", "2026-10-21");
  const result = validate(destroyed, c, []);
  expect(result.errors).toHaveLength(0);
  expect(recordStatus(destroyed)).toBe("Destroyed");

  const afterDestroy = openTasks(c, [destroyed], TODAY);
  expect(afterDestroy.find((t) => t.type === "I9_RETENTION_ENDED")).toBeUndefined();
});

test("scenario24b: exited retention not ended, destroy blocked", () => {
  const c = ctx("2018-03-01", "2026-06-30", "Inactive", "Citizen");
  expect(retainUntil(c.hireDate, c.lastDay)).toBe("2027-06-30");

  const destroyed = record("DESTROYED", TODAY);
  const result = validate(destroyed, c, []);
  expect(result.errors.some((f) => f.code === "E24")).toBe(true);
});

test("scenario25: DOC_UPDATE does not become latest or affect count", () => {
  const newHire = record("NEW_HIRE", "2026-01-01", 1);
  newHire.completedOn = "2026-01-01";
  listA(newHire, A_US_PASSPORT, "P1", "2030-01-01");

  const docUpdate = record("DOC_UPDATE", "2026-10-15", 2);

  const all = [newHire, docUpdate];
  expect(latestRecord(all)!.id).toBe(1);
  expect(i9Count(all)).toBe(1);

  // The DOC_UPDATE's new passport feeds the separate Passport table (not
  // I9Rules directly) — this asserts the resulting task-free state once
  // that table reflects it.
  const c = ctx("2026-01-01", null, "Active", "Citizen", "P1", "2036-05-01");
  expect(openTasks(c, all, TODAY).find((t) => t.type === "PASSPORT_EXPIRY")).toBeUndefined();
});

test("scenario26: expired US passport examined blocked", () => {
  const r = record("NEW_HIRE", "2026-10-19");
  r.completedOn = "2026-10-19";
  listA(r, A_US_PASSPORT, "P1", "2026-01-01");
  const c = ctx("2026-10-19", null, "Active", "Citizen", "P1", "2026-01-01");

  const result = validate(r, c, []);
  expect(result.errors.some((f) => f.code === "E16")).toBe(true);
});

test("scenario27: receipt for lost EAD creates follow-up task", () => {
  const examDate = "2026-10-19";
  expect(receiptValidUntil("REPLACEMENT", examDate, {})).toBe("2027-01-17");

  const r = record("NEW_HIRE", examDate);
  r.receipt = { type: "REPLACEMENT", validUntil: "2027-01-17" };
  const c = ctx(examDate, null, "Active", "OPT");

  const result = validate(r, c, []);
  expect(result.errors).toHaveLength(0);

  const task = openTasks(c, [r], TODAY).find((t) => t.type === "RECEIPT_FOLLOWUP")!;
  expect(task.priority).toBe("HIGH");
  expect(task.due).toBe("2027-01-17");
});

test("scenario28: US passport but H1B visa, warning only", () => {
  const r = record("NEW_HIRE", "2026-01-01");
  r.completedOn = "2026-01-01";
  listA(r, A_US_PASSPORT, "P1", "2030-01-01");
  const c = ctx("2026-01-01", null, "Active", "H1B", "P1", "2030-01-01");

  const result = validate(r, c, []);
  expect(result.errors).toHaveLength(0);
  expect(result.warnings.some((f) => f.code === "W1")).toBe(true);
});

test("scenario29: new hire under 3 business days, Section 2 due same day", () => {
  const r = record("NEW_HIRE", "2026-10-19");
  r.under3Days = true;
  const c = ctx("2026-10-19", null, "Active", "Citizen");

  expect(section2Due(r, c, null)).toBe("2026-10-19");
});

test("scenario30a: remote exam without E-Verify enrollment blocked", () => {
  I9_CONFIG.everifyEnrolled = false;
  const r = record("NEW_HIRE", "2026-01-01");
  r.remoteExam = true;
  const c = ctx("2026-01-01", null, "Active", "Citizen");

  const result = validate(r, c, []);
  expect(result.errors.some((f) => f.code === "E21")).toBe(true);
});

test("scenario31: NAME_CHANGE does not become latest", () => {
  const scenario5Record = record("NEW_HIRE", "2026-01-01", 1);
  listA(scenario5Record, A_FPI, "FP1", null);
  i94(scenario5Record, "I94-1", "2026-12-31");

  const nameChange = record("NAME_CHANGE", "2026-10-25", 2);

  const all = [scenario5Record, nameChange];
  expect(latestRecord(all)!.id).toBe(1);
});

test("scenario33: active, no hire date, no records", () => {
  const c = ctx(null, null, "Active", "H1B");
  const status = employeeI9Status(c, [], TODAY);
  expect(status.status).toBe("No I-9 on file");

  const task = openTasks(c, [], TODAY).find((t) => t.type === "NEW_I9_NEEDED")!;
  expect(task.priority).toBe("HIGH");
});

test("scenario34: correction applies onto the original, keeping history", () => {
  const original = record("NEW_HIRE", "2026-01-01", 9);
  original.completedOn = "2026-01-01";
  listA(original, A_EAD, "EAD1", "2026-11-30");

  const correction: I9RecordLike = {
    ...record("CORRECTION", "2026-10-21", 10),
    correctsRecordId: 9,
    correctionReason: "EAD expiry was mistyped",
    listA: { expiry: "2027-04-30" },
  };

  const all = [original, correction];
  const effective = effectiveRecord(original, all)!;
  expect(effective.listA?.expiry).toBe("2027-04-30");
  expect(effective.listA?.code).toBe(A_EAD);
  // History preserved — the original object itself is untouched.
  expect(original.listA?.expiry).toBe("2026-11-30");

  expect(reverifyBy(effective, all).date).toBe("2027-04-30");
  const c = ctx("2026-01-01", null, "Active", "OPT");
  expect(employeeI9Status(c, all, TODAY).status).toBe("Compliant");
});

test("scenario35: suggested documents never restrict the choice", () => {
  const r = record("NEW_HIRE", "2026-01-01");
  r.completedOn = "2026-01-01";
  listBC(r, "B_DL", C_SSN, null, false);
  const c = ctx("2026-01-01", null, "Active", "H1B");

  // H1B's suggested document is "Foreign Passport + I-94" (List A), but
  // the employee presented List B + List C instead — allowed, no warning
  // about the choice itself.
  const result = validate(r, c, []);
  expect(result.errors).toHaveLength(0);
  expect(result.warnings.some((f) => /list b|suggested/i.test(f.message))).toBe(false);
});
