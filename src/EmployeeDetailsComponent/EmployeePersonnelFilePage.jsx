import React, { useEffect, useState } from "react";
import axios from "axios";
import dayjs from "dayjs";
import {
  Alert,
  Avatar,
  Button,
  Card,
  Col,
  Descriptions,
  Form,
  Input,
  Modal,
  Row,
  Select,
  Table,
  Tag,
  DatePicker,
  message,
} from "antd";
import {
  EditOutlined,
  EnvironmentOutlined,
  FolderOutlined,
  GlobalOutlined,
  HistoryOutlined,
  IdcardOutlined,
  ProjectOutlined,
  SolutionOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { useLocation } from "react-router-dom";
import API_ENDPOINTS, { employementTypeList, workingStatusList } from "../config";
import { formatDateMDY } from "../Utils/dateFormat";
import { LCA_FIELD_LABELS, VISA_FIELD_LABELS } from "../VisaDetails/visaConstants";
import DocumentsPanel from "../Documents/DocumentsPanel";
import "./EmployeeFullDetailsComponent.css";

const genderList = [
  { value: "M", label: "Male" },
  { value: "F", label: "Female" },
];

const toDayjs = (value) => (value ? dayjs(value) : null);
const fromDayjs = (value) => (value ? value.format("YYYY-MM-DD") : null);

const statusColor = (status) => {
  switch (status) {
    case "Active":
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

// Spelled-out state names show up in both LCA job locations and addresses
// on file interchangeably with their 2-letter codes (e.g. "Dublin Ohio
// 43016" vs "Dublin OH 43016") — the word-overlap address comparison below
// would otherwise flag that as a mismatch, since "ohio" and "oh" are
// different words. Collapsed to the abbreviation (matching multi-word
// names like "New York" as whole phrases) before comparing.
const US_STATE_NAME_TO_ABBR = {
  alabama: "al", alaska: "ak", arizona: "az", arkansas: "ar", california: "ca",
  colorado: "co", connecticut: "ct", delaware: "de", florida: "fl", georgia: "ga",
  hawaii: "hi", idaho: "id", illinois: "il", indiana: "in", iowa: "ia",
  kansas: "ks", kentucky: "ky", louisiana: "la", maine: "me", maryland: "md",
  massachusetts: "ma", michigan: "mi", minnesota: "mn", mississippi: "ms", missouri: "mo",
  montana: "mt", nebraska: "ne", nevada: "nv", "new hampshire": "nh", "new jersey": "nj",
  "new mexico": "nm", "new york": "ny", "north carolina": "nc", "north dakota": "nd", ohio: "oh",
  oklahoma: "ok", oregon: "or", pennsylvania: "pa", "rhode island": "ri", "south carolina": "sc",
  "south dakota": "sd", tennessee: "tn", texas: "tx", utah: "ut", vermont: "vt",
  virginia: "va", washington: "wa", "west virginia": "wv", wisconsin: "wi", wyoming: "wy",
  "district of columbia": "dc",
};
const normalizeStateNames = (str) => {
  let result = (str || "").toLowerCase();
  Object.entries(US_STATE_NAME_TO_ABBR).forEach(([name, abbr]) => {
    result = result.replace(new RegExp(`\\b${name}\\b`, "g"), abbr);
  });
  return result;
};

const EmployeePersonnelFilePage = () => {
  const location = useLocation();
  const { rowData } = location.state;

  const [employee, setEmployee] = useState(rowData);
  // An employee can have several Address rows (one per period they lived
  // somewhere, plus one per project's WORKSITE address) — this card only
  // cares about HOME rows (type null is a pre-this-feature row, also
  // treated as HOME). The current one is whichever is active, or (for rows
  // created before the active flag existed) the one with no active flag set.
  const isHomeAddress = (a) => a.type == null || a.type === "HOME";
  const currentAddress = (addresses) => {
    const home = (addresses || []).filter(isHomeAddress);
    return home.find((a) => a.active == null || a.active) || home[0] || null;
  };
  const [address, setAddress] = useState(currentAddress(rowData.address));

  const [personalModalOpen, setPersonalModalOpen] = useState(false);
  const [employmentModalOpen, setEmploymentModalOpen] = useState(false);
  const [addressModalOpen, setAddressModalOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);

  const [savingPersonal, setSavingPersonal] = useState(false);
  const [savingEmployment, setSavingEmployment] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [addressHistory, setAddressHistory] = useState([]);

  const [latestLca, setLatestLca] = useState(null);
  const [allLcas, setAllLcas] = useState([]);
  const [loadingLca, setLoadingLca] = useState(true);
  const [lcaHistoryModalOpen, setLcaHistoryModalOpen] = useState(false);

  const [latestVisa, setLatestVisa] = useState(null);
  const [allVisas, setAllVisas] = useState([]);
  const [loadingVisa, setLoadingVisa] = useState(true);
  const [visaHistoryModalOpen, setVisaHistoryModalOpen] = useState(false);

  const [projects, setProjects] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  // Which project the card displays — only meaningful when the employee has
  // more than one Active project at once (a dropdown then lets the user
  // pick among them); defaults to the first active one, else just the first
  // project on file.
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [projectHistoryModalOpen, setProjectHistoryModalOpen] = useState(false);
  // The WORKSITE Address row captured for whichever project is currently
  // selected above (Work Arrangement + Work Site Address) — re-fetched
  // whenever the dropdown switches projects.
  const [projectWorksite, setProjectWorksite] = useState(null);

  const [personalForm] = Form.useForm();
  const [employmentForm] = Form.useForm();
  const [addressForm] = Form.useForm();

  const fullName = [employee.firstName, employee.lastName].filter(Boolean).join(" ") || "Employee";
  const initials = `${employee.firstName?.[0] || ""}${employee.lastName?.[0] || ""}`.toUpperCase();

  // Compliance flag: the LCA's authorized job location should match wherever
  // the employee is actually working — a Remote work arrangement means that
  // "wherever" is their home address, so compare against that; Hybrid/Onsite
  // (or a project with no work arrangement on file, e.g. pre-dating that
  // field) compare against the project's own captured work site address
  // instead, falling back to the home address when no work site address has
  // been captured yet. A mismatch means either the address on file is stale
  // or the LCA needs amending.
  //
  // The comparison itself is deliberately loose — lowercased, with commas,
  // periods, and runs of whitespace all treated as plain word breaks — and
  // matched by word overlap (every word in the shorter address must appear
  // in the longer one) rather than requiring one string to literally
  // contain the other. Word overlap (vs. a raw substring check) is what
  // lets "13313 Wysong, Haslet, TX 76052" match "13313 Wysong Dr Haslet TX
  // 76052" even though the LCA's jobLocation has an extra "Dr" sitting in
  // the middle — a substring check breaks the moment any word is inserted,
  // not just appended, which is a common enough gap (missing street-suffix
  // abbreviations, "City, ST" vs the full street address, etc.) that it's
  // worth tolerating here.
  const toWords = (str) =>
    normalizeStateNames(str)
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
  const isRemoteWorksite = projectWorksite?.workArrangement === "Remote";
  const lcaComparisonAddress =
    !isRemoteWorksite && projectWorksite?.address ? projectWorksite : address;
  const lcaComparisonLabel =
    !isRemoteWorksite && projectWorksite?.address ? "Project work site address" : "Home address";
  const addressMismatchesLca = () => {
    if (!latestLca?.jobLocation || !lcaComparisonAddress) return false;
    const compareStr = `${lcaComparisonAddress.address || ""} ${lcaComparisonAddress.city || ""} ${lcaComparisonAddress.state || ""} ${lcaComparisonAddress.zipCode || ""}`;
    const a = toWords(compareStr);
    const b = toWords(latestLca.jobLocation);
    if (!a.length || !b.length) return false;
    const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
    const longerSet = new Set(longer);
    return !shorter.every((word) => longerSet.has(word));
  };

  // The LCA with the most recent employment start date is treated as the
  // one currently governing this employee's authorized worksite.
  useEffect(() => {
    let cancelled = false;
    axios
      .get(API_ENDPOINTS.getLCAByEmployee(employee.employeeId))
      .then(({ data }) => {
        if (cancelled) return;
        const lcas = data || [];
        const latest = lcas.reduce(
          (best, lca) =>
            !best || (lca.employmentStartDate || "") > (best.employmentStartDate || "") ? lca : best,
          null,
        );
        setLatestLca(latest);
        setAllLcas(
          [...lcas].sort((a, b) => (b.employmentStartDate || "").localeCompare(a.employmentStartDate || "")),
        );
      })
      .catch((error) => console.error("Error fetching LCA:", error))
      .finally(() => !cancelled && setLoadingLca(false));
    return () => {
      cancelled = true;
    };
  }, [employee.employeeId]);

  // The visa with the most recent start date is treated as this employee's
  // current case — same "latest wins" rule used for the LCA card above.
  useEffect(() => {
    let cancelled = false;
    axios
      .get(API_ENDPOINTS.getVisasByEmployee(employee.employeeId))
      .then(({ data }) => {
        if (cancelled) return;
        const visas = data || [];
        const latest = visas.reduce(
          (best, visa) =>
            !best || (visa.startDate || "") > (best.startDate || "") ? visa : best,
          null,
        );
        setLatestVisa(latest);
        setAllVisas(
          [...visas].sort((a, b) => (b.startDate || "").localeCompare(a.startDate || "")),
        );
      })
      .catch((error) => console.error("Error fetching visas:", error))
      .finally(() => !cancelled && setLoadingVisa(false));
    return () => {
      cancelled = true;
    };
  }, [employee.employeeId]);

  useEffect(() => {
    let cancelled = false;
    axios
      .get(API_ENDPOINTS.projectsByEmployeeId(employee.employeeId))
      .then(({ data }) => {
        if (cancelled) return;
        const list = data || [];
        setProjects(list);
        const active = list.filter((p) => p.status === "Active");
        setSelectedProjectId((active[0] || list[0])?.projectId ?? null);
      })
      .catch((error) => console.error("Error fetching projects:", error))
      .finally(() => !cancelled && setLoadingProjects(false));
    return () => {
      cancelled = true;
    };
  }, [employee.employeeId]);

  useEffect(() => {
    if (!selectedProjectId) {
      setProjectWorksite(null);
      return;
    }
    let cancelled = false;
    axios
      .get(API_ENDPOINTS.getWorksiteAddressForProject(selectedProjectId))
      .then(({ data }) => {
        if (!cancelled) setProjectWorksite(data || null);
      })
      .catch(() => {
        if (!cancelled) setProjectWorksite(null);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedProjectId]);

  // Every edit modal PUTs the *entire* employee object (merged with the
  // edited fields) rather than a partial one — EmployeeController's update
  // endpoint overwrites every field it's handed, so sending only a few
  // fields would null out everything else (ssn, visa, taxTerm, etc.).
  const saveEmployeeFields = async (changedFields) => {
    const { data } = await axios.put(API_ENDPOINTS.updateEmployee(employee.employeeId), {
      ...employee,
      ...changedFields,
    });
    setEmployee(data);
    return data;
  };

  const openPersonalModal = () => {
    personalForm.setFieldsValue({
      firstName: employee.firstName,
      lastName: employee.lastName,
      gender: employee.gender,
      dob: toDayjs(employee.dob),
      emailId: employee.emailId,
      phone: employee.phone,
    });
    setPersonalModalOpen(true);
  };

  const handleSavePersonal = async () => {
    try {
      const values = await personalForm.validateFields();
      setSavingPersonal(true);
      await saveEmployeeFields({ ...values, dob: fromDayjs(values.dob) });
      setPersonalModalOpen(false);
      message.success("Personal information updated.");
    } catch (error) {
      if (error?.errorFields) return;
      console.error("Error updating personal information:", error);
      message.error("Failed to update personal information.");
    } finally {
      setSavingPersonal(false);
    }
  };

  const openEmploymentModal = () => {
    employmentForm.setFieldsValue({
      employmentType: employee.employmentType,
      startDate: toDayjs(employee.startDate),
      employeeDept: employee.employeeDept,
      status: employee.status,
    });
    setEmploymentModalOpen(true);
  };

  const handleSaveEmployment = async () => {
    try {
      const values = await employmentForm.validateFields();
      setSavingEmployment(true);
      await saveEmployeeFields({ ...values, startDate: fromDayjs(values.startDate) });
      setEmploymentModalOpen(false);
      message.success("Employment details updated.");
    } catch (error) {
      if (error?.errorFields) return;
      console.error("Error updating employment details:", error);
      message.error("Failed to update employment details.");
    } finally {
      setSavingEmployment(false);
    }
  };

  const openAddressModal = () => {
    addressForm.setFieldsValue({
      address: address?.address || "",
      city: address?.city || "",
      state: address?.state || "",
      zipCode: address?.zipCode || "",
      country: address?.country || "",
      // Blank on purpose — this is the start of a *new* address period, not
      // an edit of the current one, so there's nothing to prefill. Left
      // blank, the backend defaults the start date to today.
      startDate: null,
      endDate: null,
    });
    setAddressModalOpen(true);
  };

  const handleSaveAddress = async () => {
    try {
      const values = await addressForm.validateFields();
      setSavingAddress(true);
      const payload = {
        ...values,
        startDate: fromDayjs(values.startDate), // null → backend defaults to today
        endDate: fromDayjs(values.endDate),
      };
      const { data } = await axios.put(API_ENDPOINTS.updateEmployeeAddress(employee.employeeId), payload);
      setAddress(data);
      setAddressModalOpen(false);
      message.success("Address updated.");
    } catch (error) {
      if (error?.errorFields) return;
      console.error("Error updating address:", error);
      message.error("Failed to update address.");
    } finally {
      setSavingAddress(false);
    }
  };

  const openHistoryModal = async () => {
    setHistoryModalOpen(true);
    setLoadingHistory(true);
    try {
      const { data } = await axios.get(
        `${API_ENDPOINTS.getEmployeeAddressHistory(employee.employeeId)}?type=HOME`,
      );
      setAddressHistory(data || []);
    } catch (error) {
      console.error("Error fetching address history:", error);
      message.error("Failed to load address history.");
    } finally {
      setLoadingHistory(false);
    }
  };

  const historyColumns = [
    { title: "Address", dataIndex: "address", key: "address" },
    { title: "City", dataIndex: "city", key: "city" },
    { title: "State", dataIndex: "state", key: "state" },
    { title: "Zip Code", dataIndex: "zipCode", key: "zipCode" },
    { title: "Country", dataIndex: "country", key: "country" },
    {
      title: "Start Date",
      dataIndex: "startDate",
      key: "startDate",
      render: (value) => (value ? formatDateMDY(value) : "NA"),
    },
    {
      title: "End Date",
      dataIndex: "endDate",
      key: "endDate",
      render: (value) => (value ? formatDateMDY(value) : "Present"),
    },
    {
      title: "Status",
      dataIndex: "active",
      key: "active",
      render: (value) => (
        <Tag color={value == null || value ? "green" : "default"}>
          {value == null || value ? "Active" : "Inactive"}
        </Tag>
      ),
    },
  ];

  const lcaHistoryColumns = [
    { title: LCA_FIELD_LABELS.lcaNumber, dataIndex: "lcaNumber", key: "lcaNumber" },
    { title: LCA_FIELD_LABELS.jobTitle, dataIndex: "jobTitle", key: "jobTitle" },
    { title: LCA_FIELD_LABELS.jobLocation, dataIndex: "jobLocation", key: "jobLocation" },
    { title: "Status", dataIndex: "status", key: "status" },
    {
      title: LCA_FIELD_LABELS.employmentStartDate,
      dataIndex: "employmentStartDate",
      key: "employmentStartDate",
      render: (value) => (value ? formatDateMDY(value) : "NA"),
    },
    {
      title: LCA_FIELD_LABELS.employmentEndDate,
      dataIndex: "employmentEndDate",
      key: "employmentEndDate",
      render: (value) => (value ? formatDateMDY(value) : "NA"),
    },
  ];

  const visaHistoryColumns = [
    { title: VISA_FIELD_LABELS.receiptNumber, dataIndex: "receiptNumber", key: "receiptNumber" },
    { title: VISA_FIELD_LABELS.visaCategory, dataIndex: "visaCategory", key: "visaCategory" },
    { title: VISA_FIELD_LABELS.jobTitle, dataIndex: "jobTitle", key: "jobTitle" },
    { title: "Status", dataIndex: "status", key: "status" },
    {
      title: VISA_FIELD_LABELS.startDate,
      dataIndex: "startDate",
      key: "startDate",
      render: (value) => (value ? formatDateMDY(value) : "NA"),
    },
    {
      title: VISA_FIELD_LABELS.endDate,
      dataIndex: "endDate",
      key: "endDate",
      render: (value) => (value ? formatDateMDY(value) : "NA"),
    },
  ];

  const projectHistoryColumns = [
    { title: "Project Name", dataIndex: "projectName", key: "projectName" },
    { title: "Client", dataIndex: "client", key: "client" },
    {
      title: "Customer",
      key: "customer",
      render: (_, record) => record.customer?.customerCompanyName || "NA",
    },
    { title: "Status", dataIndex: "status", key: "status" },
    {
      title: "Start Date",
      dataIndex: "startDate",
      key: "startDate",
      render: (value) => (value ? formatDateMDY(value) : "NA"),
    },
    {
      title: "End Date",
      dataIndex: "endDate",
      key: "endDate",
      render: (value) => (value ? formatDateMDY(value) : "NA"),
    },
  ];

  const activeProjects = projects.filter((p) => p.status === "Active");
  const selectedProject =
    projects.find((p) => p.projectId === selectedProjectId) || activeProjects[0] || projects[0] || null;

  return (
    <main className="personnel-file-redesign">
      <Card className="personnel-profile-header">
        <div className="personnel-profile-header-content">
          <Avatar size={64} className="personnel-avatar">
            {initials || <UserOutlined />}
          </Avatar>
          <div className="personnel-profile-header-text">
            <h2>{fullName}</h2>
            <div className="personnel-profile-header-meta">
              <span>{employee.designation || "No designation on file"}</span>
              <Tag color={statusColor(employee.status)}>{employee.status || "Unknown"}</Tag>
              <span className="personnel-id">ID #{employee.employeeId}</span>
            </div>
          </div>
        </div>
      </Card>

      {addressMismatchesLca() && (
        <Alert
          type="warning"
          showIcon
          message={`${lcaComparisonLabel} doesn't match the LCA work location`}
          description={`${lcaComparisonLabel} on file: "${lcaComparisonAddress.address}, ${lcaComparisonAddress.city}, ${lcaComparisonAddress.state} ${lcaComparisonAddress.zipCode}" — LCA job location: "${latestLca.jobLocation}". Confirm which one is current, and update the other.`}
        />
      )}

      <Row gutter={[16, 16]} className="personnel-cards-row">
        <Col xs={24} lg={12}>
          <Card
            title={
              <>
                <UserOutlined /> Personal Information
              </>
            }
            extra={
              <Button icon={<EditOutlined />} onClick={openPersonalModal}>
                Edit
              </Button>
            }
          >
            <Descriptions column={{ xs: 1, sm: 2 }} size="small">
              <Descriptions.Item label="First Name">{employee.firstName || "NA"}</Descriptions.Item>
              <Descriptions.Item label="Last Name">{employee.lastName || "NA"}</Descriptions.Item>
              <Descriptions.Item label="Gender">
                {genderList.find((g) => g.value === employee.gender)?.label || employee.gender || "NA"}
              </Descriptions.Item>
              <Descriptions.Item label="Date of Birth">
                {employee.dob ? formatDateMDY(employee.dob) : "NA"}
              </Descriptions.Item>
              <Descriptions.Item label="Email">{employee.emailId || "NA"}</Descriptions.Item>
              <Descriptions.Item label="Phone">{employee.phone || "NA"}</Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card
            title={
              <>
                <SolutionOutlined /> Employment Details
              </>
            }
            extra={
              <Button icon={<EditOutlined />} onClick={openEmploymentModal}>
                Edit
              </Button>
            }
          >
            <Descriptions column={{ xs: 1, sm: 2 }} size="small">
              <Descriptions.Item label="Employment Type">{employee.employmentType || "NA"}</Descriptions.Item>
              <Descriptions.Item label="Start Date">
                {employee.startDate ? formatDateMDY(employee.startDate) : "NA"}
              </Descriptions.Item>
              <Descriptions.Item label="Department">{employee.employeeDept || "NA"}</Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={statusColor(employee.status)}>{employee.status || "NA"}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Employee ID">{employee.employeeId}</Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card
            title={
              <>
                <EnvironmentOutlined /> Current Home Address
              </>
            }
            extra={
              <div className="personnel-card-actions">
                <Button icon={<HistoryOutlined />} onClick={openHistoryModal}>
                  Address History
                </Button>
                <Button type="primary" icon={<EditOutlined />} onClick={openAddressModal}>
                  Update Address
                </Button>
              </div>
            }
          >
            <Descriptions column={{ xs: 1, sm: 2 }} size="small">
              <Descriptions.Item label="Address">{address?.address || "NA"}</Descriptions.Item>
              <Descriptions.Item label="City">{address?.city || "NA"}</Descriptions.Item>
              <Descriptions.Item label="State">{address?.state || "NA"}</Descriptions.Item>
              <Descriptions.Item label="Zip Code">{address?.zipCode || "NA"}</Descriptions.Item>
              <Descriptions.Item label="Country">{address?.country || "NA"}</Descriptions.Item>
              <Descriptions.Item label="Resident Since">
                {address?.startDate ? formatDateMDY(address.startDate) : "NA"}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card
            title={
              <>
                <GlobalOutlined /> LCA Work Location
              </>
            }
            extra={
              <Button icon={<HistoryOutlined />} onClick={() => setLcaHistoryModalOpen(true)}>
                LCA History
              </Button>
            }
            loading={loadingLca}
          >
            {!loadingLca && !latestLca ? (
              <span className="personnel-id">No LCA on file for this employee.</span>
            ) : (
              <Descriptions column={{ xs: 1, sm: 2 }} size="small">
                <Descriptions.Item label={LCA_FIELD_LABELS.jobLocation}>
                  {latestLca?.jobLocation || "NA"}
                </Descriptions.Item>
                {latestLca?.jobLocation2 && (
                  <Descriptions.Item label={LCA_FIELD_LABELS.jobLocation2}>
                    {latestLca.jobLocation2}
                  </Descriptions.Item>
                )}
                <Descriptions.Item label={LCA_FIELD_LABELS.lcaNumber}>
                  {latestLca?.lcaNumber || "NA"}
                </Descriptions.Item>
                <Descriptions.Item label="Status">{latestLca?.status || "NA"}</Descriptions.Item>
                <Descriptions.Item label={LCA_FIELD_LABELS.employmentStartDate}>
                  {latestLca?.employmentStartDate ? formatDateMDY(latestLca.employmentStartDate) : "NA"}
                </Descriptions.Item>
                <Descriptions.Item label={LCA_FIELD_LABELS.employmentEndDate}>
                  {latestLca?.employmentEndDate ? formatDateMDY(latestLca.employmentEndDate) : "NA"}
                </Descriptions.Item>
              </Descriptions>
            )}
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card
            title={
              <>
                <IdcardOutlined /> Visa
              </>
            }
            extra={
              <Button icon={<HistoryOutlined />} onClick={() => setVisaHistoryModalOpen(true)}>
                Visa History
              </Button>
            }
            loading={loadingVisa}
          >
            {!loadingVisa && !latestVisa ? (
              <span className="personnel-id">No visa on file for this employee.</span>
            ) : (
              <Descriptions column={{ xs: 1, sm: 2 }} size="small">
                <Descriptions.Item label={VISA_FIELD_LABELS.visaCategory}>
                  {latestVisa?.visaCategory || "NA"}
                </Descriptions.Item>
                <Descriptions.Item label={VISA_FIELD_LABELS.receiptNumber}>
                  {latestVisa?.receiptNumber || "NA"}
                </Descriptions.Item>
                <Descriptions.Item label="Status">
                  <Tag color={statusColor(latestVisa?.status)}>{latestVisa?.status || "NA"}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label={VISA_FIELD_LABELS.jobTitle}>
                  {latestVisa?.jobTitle || "NA"}
                </Descriptions.Item>
                <Descriptions.Item label={VISA_FIELD_LABELS.startDate}>
                  {latestVisa?.startDate ? formatDateMDY(latestVisa.startDate) : "NA"}
                </Descriptions.Item>
                <Descriptions.Item label={VISA_FIELD_LABELS.endDate}>
                  {latestVisa?.endDate ? formatDateMDY(latestVisa.endDate) : "NA"}
                </Descriptions.Item>
              </Descriptions>
            )}
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card
            title={
              <>
                <ProjectOutlined /> Project
              </>
            }
            extra={
              <Button icon={<HistoryOutlined />} onClick={() => setProjectHistoryModalOpen(true)}>
                Project History
              </Button>
            }
            loading={loadingProjects}
          >
            {!loadingProjects && !selectedProject ? (
              <span className="personnel-id">No project on file for this employee.</span>
            ) : (
              <Descriptions column={{ xs: 1, sm: 2 }} size="small">
                <Descriptions.Item label="Project Name">
                  {activeProjects.length > 1 ? (
                    <Select
                      size="small"
                      style={{ minWidth: 200 }}
                      value={selectedProject?.projectId}
                      onChange={(value) => setSelectedProjectId(value)}
                      options={activeProjects.map((p) => ({
                        value: p.projectId,
                        label: p.projectName || p.client || `Project ${p.projectId}`,
                      }))}
                    />
                  ) : (
                    selectedProject?.projectName || "NA"
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="Client">{selectedProject?.client || "NA"}</Descriptions.Item>
                <Descriptions.Item label="Customer">
                  {selectedProject?.customer?.customerCompanyName || "NA"}
                </Descriptions.Item>
                <Descriptions.Item label="Status">
                  <Tag color={statusColor(selectedProject?.status)}>{selectedProject?.status || "NA"}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Work Type">
                  {projectWorksite?.workArrangement || "NA"}
                </Descriptions.Item>
                <Descriptions.Item label="Work Site Address">
                  {projectWorksite?.address
                    ? [
                        projectWorksite.address,
                        projectWorksite.city,
                        projectWorksite.state,
                        projectWorksite.zipCode,
                      ]
                        .filter(Boolean)
                        .join(", ")
                    : "NA"}
                </Descriptions.Item>
                <Descriptions.Item label="Start Date">
                  {selectedProject?.startDate ? formatDateMDY(selectedProject.startDate) : "NA"}
                </Descriptions.Item>
                <Descriptions.Item label="End Date">
                  {selectedProject?.endDate ? formatDateMDY(selectedProject.endDate) : "NA"}
                </Descriptions.Item>
              </Descriptions>
            )}
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card
            title={
              <>
                <FolderOutlined /> Documents
              </>
            }
          >
            <DocumentsPanel entityType="Employee" entityId={employee.employeeId} />
          </Card>
        </Col>
      </Row>

      {/* Personal Information modal */}
      <Modal
        title="Edit Personal Information"
        open={personalModalOpen}
        onCancel={() => setPersonalModalOpen(false)}
        onOk={handleSavePersonal}
        confirmLoading={savingPersonal}
        okText="Save"
      >
        <Form form={personalForm} layout="vertical">
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="First Name" name="firstName" rules={[{ required: true, message: "Required" }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Last Name" name="lastName" rules={[{ required: true, message: "Required" }]}>
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="Gender" name="gender">
                <Select options={genderList} allowClear />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Date of Birth" name="dob">
                <DatePicker format="MM/DD/YYYY" style={{ width: "100%" }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="Email" name="emailId" rules={[{ type: "email", message: "Enter a valid email" }]}>
            <Input />
          </Form.Item>
          <Form.Item label="Phone" name="phone">
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      {/* Employment Details modal */}
      <Modal
        title="Edit Employment Details"
        open={employmentModalOpen}
        onCancel={() => setEmploymentModalOpen(false)}
        onOk={handleSaveEmployment}
        confirmLoading={savingEmployment}
        okText="Save"
      >
        <Form form={employmentForm} layout="vertical">
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="Employment Type" name="employmentType">
                <Select options={employementTypeList} allowClear />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Start Date" name="startDate">
                <DatePicker format="MM/DD/YYYY" style={{ width: "100%" }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="Department" name="employeeDept">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Status" name="status">
                <Select options={workingStatusList} allowClear />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* Address modal */}
      <Modal
        title="Update Address"
        open={addressModalOpen}
        onCancel={() => setAddressModalOpen(false)}
        onOk={handleSaveAddress}
        confirmLoading={savingAddress}
        okText="Save"
      >
        <Form form={addressForm} layout="vertical">
          <Form.Item label="Address" name="address" rules={[{ required: true, message: "Address is required" }]}>
            <Input />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="City" name="city" rules={[{ required: true, message: "City is required" }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="State" name="state" rules={[{ required: true, message: "State is required" }]}>
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item
                label="Zip Code"
                name="zipCode"
                rules={[{ required: true, message: "Zip code is required" }]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Country" name="country">
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="Start Date" name="startDate" help="Defaults to today if left blank">
                <DatePicker format="MM/DD/YYYY" style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="End Date" name="endDate" help="Leave blank if still current">
                <DatePicker format="MM/DD/YYYY" style={{ width: "100%" }} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* Address history modal */}
      <Modal
        title="Address History"
        open={historyModalOpen}
        onCancel={() => setHistoryModalOpen(false)}
        footer={null}
        width={720}
      >
        <Table
          dataSource={addressHistory}
          columns={historyColumns}
          rowKey="addressHistoryId"
          loading={loadingHistory}
          pagination={false}
          size="small"
          locale={{ emptyText: "No previous addresses on file." }}
        />
      </Modal>

      {/* LCA history modal */}
      <Modal
        title="LCA History"
        open={lcaHistoryModalOpen}
        onCancel={() => setLcaHistoryModalOpen(false)}
        footer={null}
        width={820}
      >
        <Table
          dataSource={allLcas}
          columns={lcaHistoryColumns}
          rowKey="lcaId"
          loading={loadingLca}
          pagination={false}
          size="small"
          locale={{ emptyText: "No LCAs on file for this employee." }}
        />
      </Modal>

      {/* Visa history modal */}
      <Modal
        title="Visa History"
        open={visaHistoryModalOpen}
        onCancel={() => setVisaHistoryModalOpen(false)}
        footer={null}
        width={820}
      >
        <Table
          dataSource={allVisas}
          columns={visaHistoryColumns}
          rowKey="visaId"
          loading={loadingVisa}
          pagination={false}
          size="small"
          locale={{ emptyText: "No visas on file for this employee." }}
        />
      </Modal>

      {/* Project history modal */}
      <Modal
        title="Project History"
        open={projectHistoryModalOpen}
        onCancel={() => setProjectHistoryModalOpen(false)}
        footer={null}
        width={820}
      >
        <Table
          dataSource={projects}
          columns={projectHistoryColumns}
          rowKey="projectId"
          loading={loadingProjects}
          pagination={false}
          size="small"
          locale={{ emptyText: "No projects on file for this employee." }}
        />
      </Modal>
    </main>
  );
};

export default EmployeePersonnelFilePage;
