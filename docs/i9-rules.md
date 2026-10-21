# Form I-9 compliance rules

Plain-English explanation of how EmployeeHub tracks Form I-9 compliance, for
anyone adjusting the rules later without re-reading the full USCIS M-274
Handbook spec this was built from.

## Where things live

| What | Backend (authoritative) | Frontend (drives the live form) |
|---|---|---|
| Legal numbers (3 business days, 540/180/240 days, the 30-Oct-2025 cutoff, alert windows) | `I9Config.java` | `src/features/i9/i9Config.ts` |
| The rules engine itself | `I9Rules.java` + `I9ExtensionCalculator.java` | `src/features/i9/i9Rules.ts` |
| Data model | `I9Record.java` (+ `model/i9/*Details.java`) | n/a — talks to the API |
| API | `I9RecordController` (`/api/v1/i9records/*`) | `src/Documents/FormI9Panel.jsx`, `FormI9Modal.jsx` |
| Compliance digest email | `NotificationService#checkI9Compliance` | n/a |
| Every open task, across all employees | `GET /i9records/tasks` | `src/I9/I9TasksReport.jsx` |

Both rules engines implement the **same** 35 scenarios from the original
spec (see each `I9RulesTest.java` / `i9Rules.test.ts`) — if you change a
rule, change it in both places and both test files, or the two will drift.
The Java copy is authoritative: the backend always re-validates a record
before saving it, never trusting whatever the browser computed.

## The shape of one I-9 record

Every Form I-9 action — a new hire's I-9, a reverification, a rehire, a
correction, a destruction — is one `I9Record` row, not a generic uploaded
file. A record has a **sub type** (`NEW_HIRE`, `REVERIFY`, `REHIRE_SUPP_B`,
`REHIRE_NEW`, `NAME_CHANGE`, `CORRECTION`, `DOC_UPDATE`, `MIGRATED`,
`DESTROYED`) that drives everything else about it: which fields show, what
documents are allowed, whether it needs Section 1/2 dates, and so on.

Its attached files (the signed PDF, document copies, an I-797 receipt, an
E-Verify printout, ...) are **not** a new kind of file storage — they're
ordinary rows in the existing generic `Document` table, tagged
`entityType="I9Record"` and `entityId=<this record's id>`. One upload with
several files just means several `Document` rows sharing one `i9RecordId`.

## What gets computed, not stored

These are never persisted — they're computed fresh every time a record is
read, exactly like `EmployeeReconcileController` already does for
reconciliation records:

- **Section 2 due date** — when Section 2 / Supplement B had to be done by.
- **Reverify by** — when work authorization next needs reverifying (or
  "not required" for a citizen, an LPR with a Green Card, or a never-
  expiring List B+C combination).
- **Employee I-9 status** — the single "what does this employee need"
  answer (`New I-9 needed`, `I-9 OVERDUE`, `Reverification due`,
  `Compliant`, ...), via a 7-step priority order in `I9Rules.employeeI9Status`.
- **Retention date** — `max(hire + 3 years, last day + 1 year)`, once an
  employee has exited.
- **Open tasks** — the "what should HR do about this, and how urgently"
  list shown on the I-9 Compliance Tasks report and mailed daily.

## The seven work-authorization extensions

A reverification's due date can be pushed out by one of seven USCIS
extension types (EAD auto-extension, H-1B 240-day, H-1B portability/AC21,
STEM OPT 180-day, cap-gap, a TPS Federal Register notice, or a Green Card
extension). Each one has its own eligibility condition and its own
reverify-by formula — see `I9ExtensionCalculator.java` /
the bottom of `i9Rules.ts`. If an extension's condition fails (e.g. an EAD
renewal receipt filed on or after 30-Oct-2025, which gets no automatic
extension anymore), saving is blocked and the reverify-by date falls back
to the un-extended document expiry — it never silently ignores the failed
extension.

## Deliberate differences from the original spec

- **No TypeScript existed in this codebase before this feature** — the
  rules modules are the only `.ts`/`.tsx` files in the frontend.
- **One shared rules module (as the spec originally asked for) isn't
  possible** across a Java backend and a JS/TS frontend in separate repos
  — hence the two synchronized copies above.
- **Passport data is NOT duplicated into I9Record.** This app already has
  a dedicated `Passport` table (the one behind the "current passport" card
  on an employee's Overview). I-9 rules read passport number/expiry from
  there instead of a `passport{}` block on the record.
- **There's no structured I-94/EAD data outside I9Record itself.** The
  `Visa` (case/petition) model has no admit-until or EAD-expiry fields, so
  the "migrated record" fallback reads the employee's *other* I9Records
  instead of a visa-case table.
- **No HR-editable settings screen exists.** `I9_CONFIG` is a static
  source of truth in both repos, not a database-backed, admin-editable
  config — update the constants directly (in both places) when USCIS
  numbers change.
- **Access is HR + IMMIGRATION + ADMIN**, not HR-only as the original
  spec's own guardrail literally states — this matches the access already
  granted to the other Employee Documents tabs.
- **No generic in-app task/notification system exists.** Open tasks are
  surfaced two ways instead: the read-only I-9 Compliance Tasks report
  (every open task, every employee), and a daily email digest of
  High-priority tasks only (reusing the existing `NotificationService` /
  `EmailService` pipeline). The digest has no per-item "already alerted"
  suppression — it's a recurring summary of whatever's currently open, not
  a one-time alert per item, so the same still-open task can appear in two
  days' digests in a row.
- **E-Verify API integration and e-signatures are out of scope** (results
  are stored, never submitted) — the spec says so explicitly.
- A `CORRECTION` record's non-null fields are merged onto the record it
  corrects *for display/rules purposes only* (`I9Rules.effectiveRecord`) —
  the original row's own columns are never overwritten, preserving history.
- `E22` (remote-exam document copies), `E23` (Supplement A file), and
  `E27` (at least one file) can only be checked once a record has attached
  files, which only exist after it has an id — so these three are enforced
  by `I9RecordService`, not the framework-free rules module, and only on
  an *existing* record. On first creation, the client blocks an empty file
  list the same way the existing generic Documents panel already does.
- Editing an existing I-9 record (vs. adding a new one) isn't built yet —
  `FormI9Modal` only supports Add. The backend `PUT /i9records/{id}`
  endpoint exists and is tested, so this is a frontend-only gap.
