import { useEffect, useMemo, useState } from "react";
import { Modal, Form, Select, Input, DatePicker, Checkbox, Radio, Upload, Button, Alert, message } from "antd";
import { InboxOutlined } from "@ant-design/icons";
import axios from "axios";
import API_ENDPOINTS from "../config";
import {
  validate as i9Validate,
  suggestedNote,
  A_US_PASSPORT,
  A_GREEN_CARD,
  A_TEMP_I551,
  A_EAD,
  A_FPI,
  A_FSM_RMI,
  A_OTHER,
  C_SSN,
  C_DHS_EAD,
} from "../features/i9/i9Rules";

const { Dragger } = Upload;

// Section 2 of the spec: Sub type select-only (no free text — the rules
// depend on the exact value), one entry per I9Rules.SubType.
export const I9_SUBTYPE_OPTIONS = [
  { value: "NEW_HIRE", label: "New Hire I-9" },
  { value: "REVERIFY", label: "Supplement B – Reverification" },
  { value: "REHIRE_SUPP_B", label: "Supplement B – Rehire" },
  { value: "REHIRE_NEW", label: "New I-9 – Rehire" },
  { value: "NAME_CHANGE", label: "Supplement B – Name change" },
  { value: "CORRECTION", label: "Correction / Audit fix" },
  { value: "DOC_UPDATE", label: "Passport / I-94 update" },
  { value: "MIGRATED", label: "Existing I-9 (migrated)" },
  { value: "DESTROYED", label: "I-9 destroyed (retention ended)" },
];

const LIST_A_OPTIONS = [
  { value: A_US_PASSPORT, label: "U.S. Passport or Passport Card" },
  { value: A_GREEN_CARD, label: "Permanent Resident Card (Form I-551)" },
  { value: A_TEMP_I551, label: "Foreign passport with temporary I-551 stamp" },
  { value: A_EAD, label: "Employment Authorization Document (Form I-766)" },
  { value: A_FPI, label: "Foreign passport + Form I-94" },
  { value: A_FSM_RMI, label: "FSM / RMI passport + Form I-94" },
  { value: A_OTHER, label: "Other List A document" },
];

const LIST_B_OPTIONS = [
  { value: "B_DL", label: "Driver's license / state ID card" },
  { value: "B_FEDERAL_ID", label: "Federal/state/local government ID card" },
  { value: "B_SCHOOL_ID", label: "School ID card with photo" },
  { value: "B_VOTER", label: "Voter registration card" },
  { value: "B_MILITARY", label: "U.S. military card or draft record" },
  { value: "B_MILITARY_DEP", label: "Military dependent's ID card" },
  { value: "B_MERCHANT_MARINER", label: "U.S. Coast Guard Merchant Mariner Card" },
  { value: "B_TRIBAL", label: "Native American tribal document" },
  { value: "B_CANADIAN_DL", label: "Canadian driver's license" },
  { value: "B_MINOR_NO_ID", label: "Individual under age 18 (no ID)" },
  { value: "B_SPECIAL_PLACEMENT", label: "Special placement" },
];

const LIST_C_OPTIONS = [
  { value: C_SSN, label: "Social Security card" },
  { value: "C_BIRTH_CERT_STATE", label: "Certification of birth (FS-545/DS-1350/FS-240)" },
  { value: "C_BIRTH_CERT", label: "U.S. birth certificate" },
  { value: "C_TRIBAL", label: "Native American tribal document" },
  { value: "C_I197", label: "U.S. Citizen ID Card (Form I-197)" },
  { value: "C_I179", label: "ID Card for Use of Resident Citizen (Form I-179)" },
  { value: C_DHS_EAD, label: "DHS-issued EAD (List C #7)" },
];

const EXTENSION_OPTIONS = [
  { value: "EAD_AUTO_EXT", label: "EAD auto-extension (I-797C)" },
  { value: "H1B_240_DAY", label: "H-1B 240-day extension" },
  { value: "H1B_PORTABILITY_AC21", label: "H-1B portability (AC21)" },
  { value: "STEM_OPT_180_DAY", label: "STEM OPT 180-day extension" },
  { value: "CAP_GAP", label: "Cap-gap" },
  { value: "TPS_FEDERAL_REGISTER", label: "TPS Federal Register notice" },
  { value: "GREEN_CARD_EXTENSION", label: "Green Card extension (I-797)" },
];

const FILE_ROLES = [
  "Form I-9 (Sections 1–2)",
  "Supplement A",
  "Supplement B",
  "List A copy",
  "List B copy",
  "List C copy",
  "Form I-94",
  "I-797 / receipt notice",
  "Form I-20",
  "E-Verify case result",
  "Destruction log",
  "Other",
];

const EVERIFY_RESULT_OPTIONS = [
  "Employment Authorized",
  "Tentative Nonconfirmation (Mismatch)",
  "Case in Continuance",
  "Close Case and Resubmit",
  "Final Nonconfirmation",
  "Closed",
  "N/A (not enrolled)",
];

const EVERIFY_RESULT_TO_CODE = {
  "Employment Authorized": "AUTHORIZED",
  "Tentative Nonconfirmation (Mismatch)": "TNC_MISMATCH",
  "Case in Continuance": "CONTINUANCE",
  "Close Case and Resubmit": "CLOSE_RESUBMIT",
  "Final Nonconfirmation": "FINAL_NC",
  Closed: "CLOSED",
  "N/A (not enrolled)": "NA",
};
const VALID_FROM_LABEL = {
  NEW_HIRE: "First day of work (for pay)",
  REHIRE_NEW: "Rehire date",
  REHIRE_SUPP_B: "Rehire date",
  REVERIFY: "Reverification date",
  NAME_CHANGE: "Name change date",
  DOC_UPDATE: "Date received",
  CORRECTION: "Correction date",
  DESTROYED: "Destruction date",
  MIGRATED: "Date on original record",
};

const iso = (v) => (v ? v.format("YYYY-MM-DD") : null);

// Builds the plain i9Rules.I9RecordLike shape from the antd form's values —
// the same shape both the live client-side validate() call and the save
// payload use.
function toRecordLike(values, existingId) {
  return {
    id: existingId,
    subtype: values.subtype,
    validFrom: iso(values.validFrom),
    section1Date: iso(values.section1Date),
    attestation: values.attestation,
    section1AuthExpiry: iso(values.section1AuthExpiry),
    under3Days: !!values.under3Days,
    completedOn: iso(values.completedOn),
    docOption: values.receiptPresented ? null : values.docOption,
    listA: {
      code: values.listACode,
      number: values.listANumber,
      expiry: iso(values.listAExpiry),
      noExpiry: !!values.listANoExpiry,
    },
    i94: {
      number: values.i94Number,
      admitUntil: iso(values.i94AdmitUntil),
      ds: !!values.i94Ds,
      authEndDate: iso(values.i94AuthEndDate),
    },
    listB: { code: values.listBCode, number: values.listBNumber, expiry: iso(values.listBExpiry) },
    listC: {
      code: values.listCCode,
      number: values.listCNumber,
      expiry: iso(values.listCExpiry),
      restrictedSsn: !!values.listCRestrictedSsn,
    },
    receipt: values.receiptPresented ? { type: values.receiptType, validUntil: iso(values.receiptValidUntil) } : {},
    extensionType: values.extensionType || null,
    extensionDetails: buildExtensionDetails(values),
    priorAuthExpired: !!values.priorAuthExpired,
    originalI9Date: iso(values.originalI9Date),
    remoteExam: !!values.remoteExam,
    preparerUsed: !!values.preparerUsed,
    everify: { caseNo: values.everifyCaseNo, created: iso(values.everifyCreated), result: EVERIFY_RESULT_TO_CODE[values.everifyResult] },
    correctsRecordId: values.correctsRecordId,
    correctionReason: values.correctionReason,
  };
}

function buildExtensionDetails(values) {
  switch (values.extensionType) {
    case "EAD_AUTO_EXT":
      return { receivedDate: iso(values.extReceivedDate), categoryOnCard: values.extCategoryOnCard, categoryOnReceipt: values.extCategoryOnReceipt };
    case "H1B_240_DAY":
      return { filingDate: iso(values.extFilingDate), sameEmployer: String(!!values.extSameEmployer) };
    case "H1B_PORTABILITY_AC21":
      return { filingDate: iso(values.extFilingDate), petitionStatus: values.extPetitionStatus };
    case "STEM_OPT_180_DAY":
      return { receiptDate: iso(values.extReceiptDate), i20Endorsed: String(!!values.extI20Endorsed), decisionDate: iso(values.extDecisionDate) };
    case "CAP_GAP":
      return {
        cosReceiptDate: iso(values.extCosReceiptDate),
        petitionStatus: values.extPetitionStatus,
        requestedStartFY: values.extRequestedStartFY ? String(values.extRequestedStartFY) : undefined,
        approvedStartDate: iso(values.extApprovedStartDate),
        decisionDate: iso(values.extDecisionDate),
      };
    case "TPS_FEDERAL_REGISTER":
      return { noticeCitation: values.extNoticeCitation, extendedThroughDate: iso(values.extExtendedThroughDate) };
    default:
      return {};
  }
}

export default function FormI9Modal({ open, employeeId, employeeContext, correctableRecords, onClose, onSaved }) {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]); // [{file, role}]
  const [serverErrors, setServerErrors] = useState([]);

  const subtype = Form.useWatch("subtype", form);
  const docOption = Form.useWatch("docOption", form);
  const listACode = Form.useWatch("listACode", form);
  const listCCode = Form.useWatch("listCCode", form);
  const extensionType = Form.useWatch("extensionType", form);
  const receiptPresented = Form.useWatch("receiptPresented", form);
  const i94Ds = Form.useWatch("i94Ds", form);
  const priorAuthExpired = Form.useWatch("priorAuthExpired", form);

  useEffect(() => {
    if (open) {
      form.resetFields();
      setSelectedFiles([]);
      setServerErrors([]);
    }
  }, [open, form]);

  // The body reads every field via form.getFieldsValue() rather than these
  // variables directly, but they still have to be listed — they're what
  // actually changes on every keystroke/selection and must force a
  // recompute; `form` itself never changes identity.
  const recordLike = useMemo(() => {
    const values = form.getFieldsValue(true);
    return toRecordLike(values, undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, subtype, docOption, listACode, listCCode, extensionType, receiptPresented, i94Ds, priorAuthExpired]);

  const liveValidation = useMemo(() => {
    if (!subtype || !employeeContext) return { errors: [], warnings: [] };
    return i9Validate(recordLike, employeeContext, []);
  }, [recordLike, subtype, employeeContext]);

  const needsDocOption = ["NEW_HIRE", "REHIRE_NEW", "REVERIFY"].includes(subtype) || (subtype === "REHIRE_SUPP_B" && priorAuthExpired);
  const showSection1 = subtype === "NEW_HIRE" || subtype === "REHIRE_NEW";
  const showSection2Date = subtype && subtype !== "DOC_UPDATE" && subtype !== "DESTROYED";
  const showReceiptOption = ["NEW_HIRE", "REHIRE_NEW", "REVERIFY"].includes(subtype);
  const showListA = !receiptPresented && docOption === "LIST_A";
  const showListBC = !receiptPresented && docOption === "LIST_BC";
  const showListCOnly = !receiptPresented && docOption === "LIST_C_ONLY";
  const passportBased = [A_US_PASSPORT, A_FPI, A_FSM_RMI, A_TEMP_I551].includes(listACode);
  const showI94 = listACode === A_FPI || listACode === A_FSM_RMI || (showListCOnly && listCCode === C_DHS_EAD);
  const showExtension = (!!listACode && [A_EAD, A_FPI, A_FSM_RMI, A_GREEN_CARD].includes(listACode)) || listCCode === C_DHS_EAD;
  const showEverify = subtype === "NEW_HIRE" || subtype === "REHIRE_NEW" || subtype === "REHIRE_SUPP_B";
  const everifyRequired = subtype === "NEW_HIRE" || subtype === "REHIRE_NEW";

  const attestation = Form.useWatch("attestation", form);

  const addFiles = (role) => (file) => {
    setSelectedFiles((prev) => [...prev, { file, role, uid: file.uid }]);
    return false;
  };

  const removeFile = (uid) => setSelectedFiles((prev) => prev.filter((f) => f.uid !== uid));

  const uploadOneFile = async (i9RecordId, entry) => {
    const presign = await axios.post(API_ENDPOINTS.presignDocumentUpload, {
      entityType: "I9Record",
      entityId: i9RecordId,
      fileName: entry.file.name,
      contentType: entry.file.type || "application/octet-stream",
      documentType: "Form I9",
      subType: entry.role,
    });
    const { uploadUrl, s3Key } = presign.data;
    await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": entry.file.type || "application/octet-stream" }, body: entry.file });
    await axios.post(API_ENDPOINTS.createDocument, {
      entityType: "I9Record",
      entityId: i9RecordId,
      fileName: entry.file.name,
      s3Key,
      contentType: entry.file.type || "application/octet-stream",
      sizeBytes: entry.file.size,
      documentType: "Form I9",
      subType: entry.role,
    });
  };

  const handleSubmit = async () => {
    const values = await form.validateFields().catch(() => null);
    if (!values) return;
    if (selectedFiles.length === 0 && subtype !== "DESTROYED" && subtype !== "MIGRATED") {
      message.error("Add at least one file.");
      return;
    }

    setSubmitting(true);
    setServerErrors([]);
    try {
      const payload = toRecordLike(values, undefined);
      payload.employeeId = employeeId;
      const { data: created } = await axios.post(API_ENDPOINTS.createI9Record, payload).catch((err) => {
        if (err.response?.status === 422) {
          setServerErrors(err.response.data.errors || []);
          return { data: null };
        }
        throw err;
      });
      if (!created) {
        setSubmitting(false);
        return;
      }

      for (const entry of selectedFiles) {
        await uploadOneFile(created.id, entry);
      }

      message.success("Form I-9 record saved.");
      onSaved();
    } catch (error) {
      message.error("Save failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title="Add Form I-9 Record" open={open} onCancel={onClose} onOk={handleSubmit} confirmLoading={submitting} okText="Upload" width={760} destroyOnClose>
      {(liveValidation.errors.length > 0 || serverErrors.length > 0) && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message="Fix the following before you can save"
          description={
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {[...serverErrors, ...liveValidation.errors].map((f) => (
                <li key={f.code}>{f.message}</li>
              ))}
            </ul>
          }
        />
      )}
      {liveValidation.warnings.length > 0 && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message={liveValidation.warnings.map((f) => f.message).join(" ")}
        />
      )}

      <Form form={form} layout="vertical">
        <Form.Item label="Sub type" name="subtype" rules={[{ required: true, message: "Choose the I-9 sub type" }]}>
          <Select options={I9_SUBTYPE_OPTIONS} placeholder="Select the I-9 action" />
        </Form.Item>

        {subtype && (
          <Form.Item label={VALID_FROM_LABEL[subtype] || "Valid From"} name="validFrom" rules={[{ required: true, message: "Required" }]}>
            <DatePicker style={{ width: "100%" }} format="MM/DD/YYYY" />
          </Form.Item>
        )}

        {showSection1 && (
          <>
            <Form.Item label="Section 1 completed on" name="section1Date" rules={[{ required: true, message: "Required" }]}>
              <DatePicker style={{ width: "100%" }} format="MM/DD/YYYY" />
            </Form.Item>
            <Form.Item label="Section 1 attestation" name="attestation" rules={[{ required: true, message: "Required" }]}>
              <Select
                options={[
                  { value: "CITIZEN", label: "U.S. citizen" },
                  { value: "NONCITIZEN_NATIONAL", label: "Noncitizen national" },
                  { value: "LPR", label: "Lawful permanent resident" },
                  { value: "NONCITIZEN_AUTHORIZED", label: "Noncitizen authorized to work" },
                ]}
              />
            </Form.Item>
            {attestation === "NONCITIZEN_AUTHORIZED" && (
              <Form.Item label="Work authorization expires (from Section 1)" name="section1AuthExpiry">
                <DatePicker style={{ width: "100%" }} format="MM/DD/YYYY" placeholder="Leave blank for N/A" />
              </Form.Item>
            )}
            <Form.Item name="under3Days" valuePropName="checked">
              <Checkbox>Employment will last less than 3 business days</Checkbox>
            </Form.Item>
          </>
        )}

        {showSection2Date && (
          <Form.Item label="Section 2 / Supplement B completed on" name="completedOn">
            <DatePicker style={{ width: "100%" }} format="MM/DD/YYYY" placeholder="Blank = still in process" />
          </Form.Item>
        )}

        {subtype === "REHIRE_SUPP_B" && (
          <>
            <Form.Item label="Original I-9 completed on" name="originalI9Date" rules={[{ required: true, message: "Required" }]}>
              <DatePicker style={{ width: "100%" }} format="MM/DD/YYYY" />
            </Form.Item>
            <Form.Item name="priorAuthExpired" valuePropName="checked">
              <Checkbox>Prior work authorization expired?</Checkbox>
            </Form.Item>
          </>
        )}

        {showReceiptOption && (
          <Form.Item name="receiptPresented" valuePropName="checked">
            <Checkbox>Receipt presented instead of document</Checkbox>
          </Form.Item>
        )}
        {receiptPresented && (
          <>
            <Form.Item label="Receipt type" name="receiptType" rules={[{ required: true, message: "Required" }]}>
              <Select
                options={[
                  { value: "REPLACEMENT", label: "Replacement of a lost/stolen/damaged document" },
                  { value: "I94_TEMP_I551", label: "I-94 with temporary I-551 stamp" },
                  { value: "I94_REFUGEE", label: "I-94 with refugee admission stamp" },
                ]}
              />
            </Form.Item>
            <Form.Item label="Receipt valid until" name="receiptValidUntil" rules={[{ required: true, message: "Required" }]}>
              <DatePicker style={{ width: "100%" }} format="MM/DD/YYYY" />
            </Form.Item>
          </>
        )}

        {needsDocOption && !receiptPresented && (
          <Form.Item label="Document Option" name="docOption" rules={[{ required: true, message: "Choose the Document Option" }]}>
            <Radio.Group
              onChange={() => {
                form.setFieldsValue({ listACode: undefined, listBCode: undefined, listCCode: undefined });
              }}
            >
              <Radio.Button value="LIST_A">List A</Radio.Button>
              <Radio.Button value="LIST_BC">List B + List C</Radio.Button>
              {(subtype === "REVERIFY" || (subtype === "REHIRE_SUPP_B" && priorAuthExpired)) && (
                <Radio.Button value="LIST_C_ONLY">List C only</Radio.Button>
              )}
            </Radio.Group>
          </Form.Item>
        )}

        {showListA && (
          <>
            <Form.Item label="List A document" name="listACode" rules={[{ required: true, message: "Pick the List A document" }]}>
              <Select options={LIST_A_OPTIONS} />
            </Form.Item>
            <Form.Item label="List A document number" name="listANumber" rules={[{ required: true, message: "Required" }]}>
              <Input />
            </Form.Item>
            {listACode === A_GREEN_CARD && (
              <Form.Item name="listANoExpiry" valuePropName="checked">
                <Checkbox>No expiration date</Checkbox>
              </Form.Item>
            )}
            <Form.Item label="List A expiration date" name="listAExpiry">
              <DatePicker style={{ width: "100%" }} format="MM/DD/YYYY" />
            </Form.Item>
            {passportBased && (
              <>
                <Form.Item label="Passport number" name="passportNumber">
                  <Input placeholder="Uses the employee's record on the Passport tab if left blank" />
                </Form.Item>
              </>
            )}
          </>
        )}

        {showI94 && (
          <>
            <Form.Item label="I-94 number" name="i94Number" rules={[{ required: true, message: "Required" }]}>
              <Input />
            </Form.Item>
            <Form.Item name="i94Ds" valuePropName="checked">
              <Checkbox>D/S (Duration of Status, no fixed admit-until date)</Checkbox>
            </Form.Item>
            {!i94Ds && (
              <Form.Item label="I-94 admit-until date" name="i94AdmitUntil" rules={[{ required: true, message: "Required" }]}>
                <DatePicker style={{ width: "100%" }} format="MM/DD/YYYY" />
              </Form.Item>
            )}
            {i94Ds && (
              <Form.Item label="Authorization end date (from I-20 / EAD)" name="i94AuthEndDate" rules={[{ required: true, message: "Required" }]}>
                <DatePicker style={{ width: "100%" }} format="MM/DD/YYYY" />
              </Form.Item>
            )}
          </>
        )}

        {showListBC && (
          <>
            <Form.Item label="List B document" name="listBCode" rules={[{ required: true, message: "Required" }]}>
              <Select options={LIST_B_OPTIONS} />
            </Form.Item>
            <Form.Item label="List B document number" name="listBNumber">
              <Input />
            </Form.Item>
          </>
        )}

        {(showListBC || showListCOnly) && (
          <>
            <Form.Item label="List C document" name="listCCode" rules={[{ required: true, message: "Required" }]}>
              <Select options={LIST_C_OPTIONS} />
            </Form.Item>
            <Form.Item label="List C document number" name="listCNumber">
              <Input />
            </Form.Item>
            {listCCode === C_SSN && (
              <Form.Item name="listCRestrictedSsn" valuePropName="checked">
                <Checkbox>Card says "NOT VALID FOR EMPLOYMENT" / restricted</Checkbox>
              </Form.Item>
            )}
            {listCCode === C_DHS_EAD && (
              <Form.Item label="List C expiration date" name="listCExpiry" rules={[{ required: true, message: "Required" }]}>
                <DatePicker style={{ width: "100%" }} format="MM/DD/YYYY" />
              </Form.Item>
            )}
          </>
        )}

        {showExtension && (
          <>
            <Form.Item label="Work authorization extension" name="extensionType">
              <Select allowClear options={EXTENSION_OPTIONS} placeholder="None (default)" />
            </Form.Item>
            <ExtensionFields extensionType={extensionType} />
          </>
        )}

        <Form.Item name="remoteExam" valuePropName="checked">
          <Checkbox>Alternative procedure (remote examination) used</Checkbox>
        </Form.Item>

        {showSection1 && (
          <Form.Item name="preparerUsed" valuePropName="checked">
            <Checkbox>Preparer / translator used (Supplement A)</Checkbox>
          </Form.Item>
        )}

        {showEverify && (
          <>
            <Form.Item label="E-Verify case number" name="everifyCaseNo" rules={everifyRequired ? [{ required: true, message: "Required" }] : []}>
              <Input />
            </Form.Item>
            <Form.Item label="E-Verify date created" name="everifyCreated">
              <DatePicker style={{ width: "100%" }} format="MM/DD/YYYY" />
            </Form.Item>
            <Form.Item label="E-Verify result" name="everifyResult">
              <Select options={EVERIFY_RESULT_OPTIONS.map((v) => ({ value: v, label: v }))} />
            </Form.Item>
          </>
        )}

        {subtype === "CORRECTION" && (
          <>
            <Form.Item label="Corrects record" name="correctsRecordId" rules={[{ required: true, message: "Required" }]}>
              <Select
                options={(correctableRecords || []).map((r) => ({
                  value: r.id,
                  label: `${r.subtype} – ${r.validFrom || ""}`,
                }))}
              />
            </Form.Item>
            <Form.Item label="Reason for correction" name="correctionReason" rules={[{ required: true, message: "Required" }]}>
              <Input.TextArea rows={2} />
            </Form.Item>
          </>
        )}

        {subtype === "DESTROYED" && (
          <>
            <Form.Item label="Destruction method" name="destructionMethod" rules={[{ required: true, message: "Required" }]}>
              <Input placeholder="e.g. Shredded, securely deleted" />
            </Form.Item>
            <Form.Item label="Destroyed by" name="destroyedBy" rules={[{ required: true, message: "Required" }]}>
              <Input />
            </Form.Item>
          </>
        )}

        <Form.Item label="Additional information" name="notes">
          <Input.TextArea rows={2} placeholder={extensionType ? suggestedNote(recordLike) || "" : undefined} />
        </Form.Item>

        {subtype !== "DESTROYED" && subtype !== "MIGRATED" && (
          <Form.Item label="Files" required>
            <FileRolePicker selectedFiles={selectedFiles} onAdd={addFiles} onRemove={removeFile} />
          </Form.Item>
        )}
      </Form>
    </Modal>
  );
}

function ExtensionFields({ extensionType }) {
  switch (extensionType) {
    case "EAD_AUTO_EXT":
      return (
        <>
          <Form.Item label="I-797C received date" name="extReceivedDate" rules={[{ required: true, message: "Required" }]}>
            <DatePicker style={{ width: "100%" }} format="MM/DD/YYYY" />
          </Form.Item>
          <Form.Item label="Category on the card" name="extCategoryOnCard">
            <Input placeholder="e.g. C09, A17, C26" />
          </Form.Item>
          <Form.Item label="Category on the receipt" name="extCategoryOnReceipt">
            <Input placeholder="e.g. C09, A17, C26" />
          </Form.Item>
        </>
      );
    case "H1B_240_DAY":
      return (
        <>
          <Form.Item label="Extension petition filed on" name="extFilingDate" rules={[{ required: true, message: "Required" }]}>
            <DatePicker style={{ width: "100%" }} format="MM/DD/YYYY" />
          </Form.Item>
          <Form.Item name="extSameEmployer" valuePropName="checked">
            <Checkbox>Same employer</Checkbox>
          </Form.Item>
        </>
      );
    case "H1B_PORTABILITY_AC21":
      return (
        <>
          <Form.Item label="I-129 filed on" name="extFilingDate" rules={[{ required: true, message: "Required" }]}>
            <DatePicker style={{ width: "100%" }} format="MM/DD/YYYY" />
          </Form.Item>
          <Form.Item label="Petition status" name="extPetitionStatus">
            <Select allowClear options={[{ value: "PENDING", label: "Pending" }, { value: "APPROVED", label: "Approved" }]} />
          </Form.Item>
        </>
      );
    case "STEM_OPT_180_DAY":
      return (
        <>
          <Form.Item label="STEM I-765 receipt date" name="extReceiptDate" rules={[{ required: true, message: "Required" }]}>
            <DatePicker style={{ width: "100%" }} format="MM/DD/YYYY" />
          </Form.Item>
          <Form.Item name="extI20Endorsed" valuePropName="checked">
            <Checkbox>I-20 endorsed with STEM recommendation</Checkbox>
          </Form.Item>
          <Form.Item label="Decision date (optional)" name="extDecisionDate">
            <DatePicker style={{ width: "100%" }} format="MM/DD/YYYY" />
          </Form.Item>
        </>
      );
    case "CAP_GAP":
      return (
        <>
          <Form.Item label="H-1B cap change-of-status receipt date" name="extCosReceiptDate" rules={[{ required: true, message: "Required" }]}>
            <DatePicker style={{ width: "100%" }} format="MM/DD/YYYY" />
          </Form.Item>
          <Form.Item label="Petition status" name="extPetitionStatus">
            <Select
              allowClear
              options={[
                { value: "PENDING", label: "Pending" },
                { value: "APPROVED", label: "Approved" },
                { value: "DENIED", label: "Denied" },
                { value: "WITHDRAWN", label: "Withdrawn" },
              ]}
            />
          </Form.Item>
          <Form.Item label="Requested H-1B start fiscal year" name="extRequestedStartFY">
            <Input placeholder="e.g. 2026 (FY starting Oct 1, 2026)" />
          </Form.Item>
          <Form.Item label="Approved start date (if approved)" name="extApprovedStartDate">
            <DatePicker style={{ width: "100%" }} format="MM/DD/YYYY" />
          </Form.Item>
          <Form.Item label="Decision date (if denied/withdrawn)" name="extDecisionDate">
            <DatePicker style={{ width: "100%" }} format="MM/DD/YYYY" />
          </Form.Item>
        </>
      );
    case "TPS_FEDERAL_REGISTER":
      return (
        <>
          <Form.Item label="Federal Register notice citation" name="extNoticeCitation" rules={[{ required: true, message: "Required" }]}>
            <Input />
          </Form.Item>
          <Form.Item label="Extended through date" name="extExtendedThroughDate" rules={[{ required: true, message: "Required" }]}>
            <DatePicker style={{ width: "100%" }} format="MM/DD/YYYY" />
          </Form.Item>
        </>
      );
    default:
      return null;
  }
}

function FileRolePicker({ selectedFiles, onAdd, onRemove }) {
  const [role, setRole] = useState(FILE_ROLES[0]);
  return (
    <>
      <Select value={role} onChange={setRole} options={FILE_ROLES.map((r) => ({ value: r, label: r }))} style={{ width: "100%", marginBottom: 8 }} />
      <Dragger multiple beforeUpload={onAdd(role)} showUploadList={false}>
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p className="ant-upload-text">Click or drag files here to tag them as "{role}"</p>
      </Dragger>
      {selectedFiles.length > 0 && (
        <ul style={{ marginTop: 8 }}>
          {selectedFiles.map((f) => (
            <li key={f.uid}>
              {f.file.name} — {f.role}{" "}
              <Button type="link" danger size="small" onClick={() => onRemove(f.uid)}>
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
