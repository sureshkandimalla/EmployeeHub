import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import dayjs from "dayjs";
import { Card, Col, Descriptions, Form, message, Row, Select, Spin, Tag } from "antd";
import { GlobalOutlined, IdcardOutlined } from "@ant-design/icons";
import API_ENDPOINTS from "../config";
import { formatDateMDY } from "../Utils/dateFormat";
import VisaFormModal from "./VisaFormModal";
import PassportController from "../Passport/PassportController";
import "./VisaProfile.css";

const formatWage = (value) => (value != null ? Number(value).toLocaleString() : "");

// Mirrors EmployeePersonnelFilePage's statusColor so status tags look the
// same wherever an employee/case status is shown across the app.
const statusColor = (status) => {
  switch (status) {
    case "Active":
    case "Approved":
    case "Certified":
      return "green";
    case "Inactive":
    case "Archived":
      return "default";
    case "Bench":
      return "orange";
    default:
      return "blue";
  }
};

// Same blue-underline treatment /visaEmployees uses for its clickable grid
// cells (receiptNumber, passportNumber, PAF) — reused here so the two
// surfaces read as one consistent design language.
const LinkText = ({ onClick, children }) => (
  <span
    style={{ color: "#1677ff", cursor: "pointer", textDecoration: "underline" }}
    onClick={onClick}
  >
    {children}
  </span>
);

// `employee` is the already-loaded row from the parent (EmployeeFullDetails)
// — reused here just for `insurance`, which isn't part of the immigration
// profile DTO, rather than re-fetching the whole employee record.
const VisaProfile = ({ employeeId, employee }) => {
  const [profile, setProfile] = useState(null);
  const [passports, setPassports] = useState([]);
  const [activeProject, setActiveProject] = useState(null);
  const [loading, setLoading] = useState(true);

  // Visa edit modal — same pattern as VisaDetailsList.jsx's receiptNumber
  // cellRenderer, so clicking the Latest Case ID here opens the identical
  // edit form as clicking it on /visaEmployees.
  const [visaModalData, setVisaModalData] = useState(null);
  const [visaForm] = Form.useForm();
  const [visaSaving, setVisaSaving] = useState(false);
  const [lcaOptions, setLcaOptions] = useState([]);
  const passportRef = useRef(null);

  // Which visa case the "Latest Visa Case" card displays — null means "use
  // the most recent one" (the default); set when the user picks an older
  // case from the dropdown. Reset on every fetch so switching employees, or
  // saving an edit, doesn't carry a stale selection forward.
  const [selectedVisaId, setSelectedVisaId] = useState(null);

  const fetchProfile = () => {
    if (!employeeId) return;
    setLoading(true);
    Promise.all([
      axios.get(API_ENDPOINTS.getEmployeeImmigration(employeeId)),
      axios.get(API_ENDPOINTS.getPassportsByEmployee(employeeId)),
      axios.get(API_ENDPOINTS.projectsByEmployeeId(employeeId)),
    ])
      .then(([profileRes, passportRes, projectsRes]) => {
        setProfile(profileRes.data);
        setPassports(passportRes.data || []);
        const projects = projectsRes.data || [];
        setActiveProject(projects.find((p) => p.status === "Active") || projects[0] || null);
        setSelectedVisaId(null);
      })
      .catch((error) => console.error("Error fetching visa profile:", error))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId]);

  const populateVisaForm = (v) => {
    visaForm.setFieldsValue({
      visaCategory:    v.visaCategory    ?? null,
      visaSubCategory: v.visaSubCategory ?? null,
      filingType:      v.filingType      ?? null,
      filingYear:      v.filingYear      != null ? String(v.filingYear) : null,
      receiptNumber:   v.receiptNumber   ?? null,
      jobTitle:        v.jobTitle        ?? v.lca?.jobTitle      ?? null,
      lcaNumber:       v.lcaNumber       ?? v.lca?.lcaNumber     ?? null,
      socCode:         v.socCode         ?? v.lca?.socCode       ?? null,
      client:          v.client          ?? v.lca?.client        ?? null,
      customer:        v.customer        ?? v.lca?.customer      ?? null,
      jobLocation:     v.jobLocation     ?? v.lca?.jobLocation   ?? null,
      jobLocation2:    v.jobLocation2    ?? v.lca?.jobLocation2  ?? null,
      lcaWage:         v.lcaWage         ?? v.lca?.lcaWage       ?? null,
      status:          v.status          ?? null,
      startDate:       v.startDate       ? dayjs(v.startDate)    : null,
      endDate:         v.endDate         ? dayjs(v.endDate)      : null,
      lastUpdated:     v.lastUpdated     ? dayjs(v.lastUpdated)  : null,
      lcaId:           v.lca?.lcaId      ?? null,
    });
  };

  // Opens the same edit modal /visaEmployees uses for its Latest Case ID
  // (receiptNumber) column.
  const openVisaModal = (visa) => {
    const visaId = visa?.visaId;
    if (!visaId) return;

    const lcasFetch = axios.get(API_ENDPOINTS.getAllLCAs)
      .then((res) => {
        const raw = Array.isArray(res.data) ? res.data
          : Array.isArray(res.data?.data) ? res.data.data
          : [];
        return raw.map((l) => {
          const emp = l.employee || l.visa?.employee;
          const employeeName = emp ? `${emp.firstName || ""} ${emp.lastName || ""}`.trim() : "";
          return {
            value: l.lcaId,
            label: `${employeeName || l.lcaId} — ${l.lcaNumber || ""}`,
            lcaNumber: l.lcaNumber || "",
            lca: l,
          };
        });
      })
      .catch(() => []);

    const visaFetch = axios.get(API_ENDPOINTS.getVisaById(visaId))
      .then((res) => res.data)
      .catch(() => { message.error("Failed to load visa details."); return visa; });

    Promise.all([lcasFetch, visaFetch]).then(([options, visaData]) => {
      const currentLcaId = visaData?.lca?.lcaId ?? null;
      const availableOptions = options.filter((opt) => !opt.lca.visa || opt.value === currentLcaId);
      setLcaOptions(availableOptions);
      setVisaModalData(visaData);
      populateVisaForm(visaData);
    });
  };

  const handleVisaSave = (values) => {
    const visaId = visaModalData?.visaId;
    if (visaId == null) return;

    const payload = {
      visaId,
      employeeId:      visaModalData?.employeeId ?? null,
      visaCategory:    values.visaCategory    ?? null,
      visaSubCategory: values.visaSubCategory ?? null,
      filingType:      values.filingType      ?? null,
      filingYear:      values.filingYear      ?? null,
      receiptNumber:   values.receiptNumber   ?? visaModalData?.receiptNumber ?? null,
      startDate:       values.startDate?.format("YYYY-MM-DD") || null,
      endDate:         values.endDate?.format("YYYY-MM-DD")   || null,
      jobTitle:        values.jobTitle      ?? visaModalData?.lca?.jobTitle      ?? null,
      lcaNumber:       values.lcaNumber     ?? visaModalData?.lca?.lcaNumber     ?? null,
      socCode:         values.socCode       ?? visaModalData?.lca?.socCode       ?? null,
      client:          values.client        ?? visaModalData?.lca?.client        ?? null,
      customer:        values.customer      ?? visaModalData?.lca?.customer      ?? null,
      jobLocation:     values.jobLocation   ?? visaModalData?.lca?.jobLocation   ?? null,
      jobLocation2:    values.jobLocation2  ?? visaModalData?.lca?.jobLocation2  ?? null,
      lcaWage:         values.lcaWage       ?? visaModalData?.lca?.lcaWage       ?? null,
      status:          values.status        ?? null,
      lca:             values.lcaId != null ? values.lcaId : (visaModalData?.lca?.lcaId ?? null),
      lastUpdated:     new Date().toISOString().split("T")[0],
    };

    setVisaSaving(true);
    axios.put(API_ENDPOINTS.updateVisa(visaId), payload)
      .then(() => {
        message.success("Visa updated successfully");
        setVisaModalData(null);
        visaForm.resetFields();
        fetchProfile();
      })
      .catch(() => message.error("Failed to save Visa. Please try again."))
      .finally(() => setVisaSaving(false));
  };

  // Opens the same passport edit modal /visaEmployees uses for its
  // passportNumber column — the profile DTO only carries the number, so
  // the matching record is looked up from this employee's passport list.
  const openPassportModal = () => {
    const passNum = profile?.passportNumber;
    if (!passNum) return;
    const passport = passports.find((p) => p.passportNumber === passNum) || passports[0];
    if (passport && passportRef.current) {
      passportRef.current.openEdit(passport);
    } else {
      message.warning("Passport record not found");
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <Spin />
      </div>
    );
  }

  if (!profile) {
    return <div style={{ padding: 24 }}>No immigration profile found for this employee.</div>;
  }

  const visas = profile.visas || [];
  const sortedVisas = [...visas].sort((a, b) => (b.startDate || "").localeCompare(a.startDate || ""));
  const latestVisa = sortedVisas[0] || null;
  // Defaults to the latest case; the dropdown (shown when there's more than
  // one) lets the user pick an older one to display instead.
  const selectedVisa =
    (selectedVisaId != null && sortedVisas.find((v) => v.visaId === selectedVisaId)) || latestVisa;

  // "Latest LCA" can come from any visa's embedded LCA, or from an LCA with
  // no linked visa at all (profile.lcaList) — merge both before picking.
  const allLcas = [...visas.map((v) => v.lca).filter(Boolean), ...(profile.lcaList || [])];
  const latestLca =
    [...allLcas].sort((a, b) =>
      (b.employmentStartDate || "").localeCompare(a.employmentStartDate || ""),
    )[0] || null;

  const latestPassport =
    [...passports].sort((a, b) => (b.expiryDate || "").localeCompare(a.expiryDate || ""))[0] ||
    null;

  const latestNote =
    [...(profile.notes || [])].sort((a, b) => (b.noteId || 0) - (a.noteId || 0))[0] || null;

  const daysToVisaEnd = selectedVisa?.endDate ? dayjs(selectedVisa.endDate).diff(dayjs(), "day") : null;

  // Simple compliance checks — flags the same kind of gaps the source
  // spreadsheet's "Missing Data" column called out.
  const missing = [];
  if (!profile.passportNumber) missing.push("Passport");
  if (!profile.dob) missing.push("DOB");
  if (profile.i9 !== "Completed") missing.push("I-9");
  if (profile.everifyStatus !== "Completed") missing.push("E-Verify");

  const lcaWage = latestLca?.lcaWage;
  const visaLcaWage = selectedVisa?.lca?.lcaWage ?? selectedVisa?.lcaWage;

  return (
    <>
      <Row gutter={[16, 16]} className="visa-profile-cards-row">
        <Col xs={24} lg={12}>
          <Card
            title={
              <>
                <IdcardOutlined /> Current Profile
              </>
            }
          >
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="Employee Status">
                <Tag color={statusColor(profile.status)}>{profile.status || "NA"}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Visa Status">{profile.visaCategory || "NA"}</Descriptions.Item>
              <Descriptions.Item label="I-9">{profile.i9 || "NA"}</Descriptions.Item>
              <Descriptions.Item label="E-Verify">{profile.everifyStatus || "NA"}</Descriptions.Item>
              <Descriptions.Item label="PAF">
                {profile.paf ? (
                  <a href={profile.paf} target="_blank" rel="noopener noreferrer"
                    style={{ color: "#1677ff", textDecoration: "underline" }}>
                    View PAF
                  </a>
                ) : (
                  "NA"
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Health Insurance">{employee?.insurance || "NA"}</Descriptions.Item>
              <Descriptions.Item label="Current LCA Salary ($)">
                {formatWage(lcaWage) || "NA"}
              </Descriptions.Item>
              <Descriptions.Item label="LCA Effective Date / Note">
                {latestLca
                  ? `${formatWage(lcaWage)} - ${formatDateMDY(latestLca.employmentStartDate)}`
                  : "NA"}
              </Descriptions.Item>
              <Descriptions.Item label="DOB">
                {profile.dob ? formatDateMDY(profile.dob) : "NA"}
              </Descriptions.Item>
              <Descriptions.Item label="Passport Number">
                {profile.passportNumber ? (
                  <LinkText onClick={openPassportModal}>{profile.passportNumber}</LinkText>
                ) : (
                  "NA"
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Passport Expiry">
                {latestPassport?.expiryDate ? formatDateMDY(latestPassport.expiryDate) : "NA"}
              </Descriptions.Item>
              <Descriptions.Item label="I-94 Expiry">NA</Descriptions.Item>
              <Descriptions.Item label="Email ID">{profile.emailId || "NA"}</Descriptions.Item>
              <Descriptions.Item label="Contact Number">{profile.phone || "NA"}</Descriptions.Item>
              <Descriptions.Item label="Project Information">
                {activeProject
                  ? [activeProject.customer?.customerCompanyName, activeProject.client]
                      .filter(Boolean)
                      .join(" / ")
                  : "NA"}
              </Descriptions.Item>
              <Descriptions.Item label="Withdrawal Date">NA</Descriptions.Item>
              <Descriptions.Item label="Last Date of Employment">
                {profile.endDate ? formatDateMDY(profile.endDate) : "NA"}
              </Descriptions.Item>
              <Descriptions.Item label="Exit Reason">NA</Descriptions.Item>
              <Descriptions.Item label="Comments">{latestNote?.details || "NA"}</Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card
            title={
              <>
                <GlobalOutlined /> Latest Visa Case
              </>
            }
            extra={
              sortedVisas.length > 1 && (
                <Select
                  size="small"
                  style={{ minWidth: 240 }}
                  value={selectedVisa?.visaId}
                  onChange={(value) => setSelectedVisaId(value)}
                  options={sortedVisas.map((v) => ({
                    value: v.visaId,
                    label: `${v.receiptNumber || v.visaId} — ${v.visaCategory || "Visa"} (${v.startDate ? formatDateMDY(v.startDate) : "NA"})`,
                  }))}
                />
              )
            }
          >
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="Latest Case ID">
                {selectedVisa?.receiptNumber ? (
                  <LinkText onClick={() => openVisaModal(selectedVisa)}>{selectedVisa.receiptNumber}</LinkText>
                ) : (
                  "NA"
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Visa Category">{selectedVisa?.visaCategory || "NA"}</Descriptions.Item>
              <Descriptions.Item label="Case Status">
                <Tag color={statusColor(selectedVisa?.status)}>{selectedVisa?.status || "NA"}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Start Date">
                {selectedVisa?.startDate ? formatDateMDY(selectedVisa.startDate) : "NA"}
              </Descriptions.Item>
              <Descriptions.Item label="Visa Expiry Date">
                {selectedVisa?.endDate ? formatDateMDY(selectedVisa.endDate) : "NA"}
              </Descriptions.Item>
              <Descriptions.Item label="Days to Visa End">{daysToVisaEnd ?? "NA"}</Descriptions.Item>
              <Descriptions.Item label="Job Title">{selectedVisa?.jobTitle || "NA"}</Descriptions.Item>
              <Descriptions.Item label="SOC">{selectedVisa?.socCode || "NA"}</Descriptions.Item>
              <Descriptions.Item label="LCA Wage ($)">{formatWage(visaLcaWage) || "NA"}</Descriptions.Item>
              <Descriptions.Item label="Wage Effective From">
                {selectedVisa?.lca?.employmentStartDate
                  ? formatDateMDY(selectedVisa.lca.employmentStartDate)
                  : "NA"}
              </Descriptions.Item>
              <Descriptions.Item label="Status Change">NA</Descriptions.Item>
              <Descriptions.Item label="Vendor">{selectedVisa?.customer || "NA"}</Descriptions.Item>
              <Descriptions.Item label="# Visa Cases">{visas.length}</Descriptions.Item>
              <Descriptions.Item label="Alert">
                <Tag color={missing.length === 0 ? "green" : "orange"}>
                  {missing.length === 0 ? "OK" : "Review Needed"}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Missing Data">
                {missing.length ? missing.join(", ") : "None"}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
      </Row>

      <VisaFormModal
        open={!!visaModalData}
        isNew={false}
        visaData={visaModalData}
        lcaOptions={lcaOptions}
        form={visaForm}
        saving={visaSaving}
        onCancel={() => {
          setVisaModalData(null);
          visaForm.resetFields();
        }}
        onSave={handleVisaSave}
        onLcaChange={(selectedLcaId) => {
          const found = lcaOptions.find((o) => o.value === selectedLcaId);
          const lca = found?.lca;
          visaForm.setFieldsValue({
            lcaNumber: lca?.lcaNumber ?? null,
            jobLocation: lca?.jobLocation ?? null,
            jobLocation2: lca?.jobLocation2 ?? null,
            socCode: lca?.socCode ?? null,
            lcaWage: lca?.lcaWage ?? null,
            client: lca?.client ?? null,
            customer: lca?.customer ?? null,
            jobTitle: lca?.jobTitle ?? null,
          });
        }}
      />
      <PassportController ref={passportRef} onSuccess={fetchProfile} />
    </>
  );
};

export default VisaProfile;
