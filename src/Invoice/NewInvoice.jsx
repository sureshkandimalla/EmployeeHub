import React, { useState, useEffect, useMemo } from "react";
import { Tag, Button, Form, Input, Row, Col, Select, Modal, Spin } from "antd";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import "./Invoice.css";
import API_ENDPOINTS from "../config";
import { INVOICE_TERM_OPTIONS, computeInvoiceEndDate } from "../Utils/invoiceTerm";

const NewInvoice = ({ onClose, employeeId, open }) => {
  const { Option } = Select;
  const [form] = Form.useForm();
  const [selectedEmployeeId, setSelectedEmployeeId] = useState();
  const [selectedCustomerId, setSelectedCustomerId] = useState();
  const [selectedProjectId, setSelectedProjectId] = useState();
  const [employees, setEmployeesData] = useState([]);
  const [customers, setCustomersData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [projects, setProjectsData] = useState([]);

  const initialGeneralDetails = {
    employeeId: null,
    employeeName: "",
    customerName: "",
    customerId: null,
    projectId: null,
    projectName: "",
    startDate: "",
    endDate: "",
    invoiceTerm: null,
    billRate: 0,
    hours: 0,
    invoiceNumber: 0,
    invoiceMonth: "",
    total: 0,
  };
  const [generalDetails, setGeneralDetails] = useState(initialGeneralDetails);

  const handleAddNew = () => {
    form.resetFields(); // Reset Ant Design form fields
    setGeneralDetails(initialGeneralDetails); // Reset state
    setSelectedEmployeeId(null); // Clear dropdown selection
    setSelectedCustomerId(null);
    setSelectedProjectId(null);
  };

  // Fetch employees and customers
  const fetchEmployeesAndCustomers = async () => {
    try {
      const [employeesData, customersData, projectsData] = await Promise.all([
        fetch(API_ENDPOINTS.getEmployees).then((response) => response.json()),
        fetch(API_ENDPOINTS.getAllCustomers).then((response) => response.json()),
        fetch(API_ENDPOINTS.getProjects).then((response) => response.json()),
      ]);
      setEmployeesData(getFlattenedData(employeesData));
      setCustomersData(getFlattenedData(customersData));
      setProjectsData(getFlattenedData(projectsData));
    } catch (error) {
      console.error("Error fetching data:", error);
      Modal.error({
        content: "Error fetching employees or customers. Please try again later.",
      });
    } finally {
      setLoading(false);
    }
  };

  const getFlattenedData = (data) => {
    return data.map((dataObj) => ({ ...dataObj })) || [];
  };

  useEffect(() => {
    handleAddNew();
    fetchEmployeesAndCustomers();
  }, []);

  // Handle form submission
  const handleSubmit = () => {
    generalDetails.total = generalDetails.hours * generalDetails.billRate;
    console.log("Submitted General Details:", generalDetails);

    // Validate required fields
    if (
      !generalDetails.customerId ||
      !generalDetails.invoiceNumber ||
      !generalDetails.billRate ||
      !generalDetails.invoiceMonth ||
      !generalDetails.hours
    ) {
      Modal.error({
        content: "Please fill in all mandatory fields before submitting.",
      });
      return;
    }

    // Final guard: Start/End Date must still fall within the currently
    // selected project's own date range. The per-field pickers already
    // reject/clamp out-of-range values as they're entered, but dates set
    // for a *different* project (before switching Employee/Customer/Project)
    // are never automatically revalidated, so this catches anything stale.
    const submittingProject = projects.find(
      (project) => project.projectId === generalDetails.projectId,
    );
    const submittingProjectStartDate = submittingProject?.startDate || null;
    const submittingProjectEndDate = submittingProject?.endDate || null;
    if (
      (submittingProjectStartDate &&
        generalDetails.startDate &&
        generalDetails.startDate < submittingProjectStartDate) ||
      (submittingProjectEndDate &&
        generalDetails.startDate &&
        generalDetails.startDate > submittingProjectEndDate) ||
      (submittingProjectEndDate &&
        generalDetails.endDate &&
        generalDetails.endDate > submittingProjectEndDate) ||
      (submittingProjectStartDate &&
        generalDetails.endDate &&
        generalDetails.endDate < submittingProjectStartDate)
    ) {
      Modal.error({
        content: `Start/End Date must fall within the project's own date range (${submittingProjectStartDate || "no start"} to ${submittingProjectEndDate || "no end"}).`,
      });
      return;
    }

    const updatedDataToSave = [
      {
        ...generalDetails, // Spread the existing properties
        formatSelectedDate: generalDetails.invoiceMonth, // Add the new property
      },
    ];
    fetch(
      API_ENDPOINTS.addInvoices,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updatedDataToSave),
      },
    )
      .then(async (response) => {
        if (response && response.status === 201) {
          Modal.success({
            content: "Data saved successfully",
            onOk: () => {
              onClose();
              handleClear();
            },
          });
        } else {
          // fetch() only rejects on a network-level failure — an HTTP error
          // status (400/500/etc.) still resolves here, so a non-201 must be
          // surfaced too or a failed save looks identical to a successful
          // one (this previously only logged to the console, invisible in
          // production — confirmed as the cause of an invoice silently
          // failing to save with no visible error).
          const bodyText = await response.text().catch(() => "");
          console.error("Invoice save failed:", response.status, bodyText);
          Modal.error({
            content: `Failed to save invoice (server returned ${response.status}). Please try again or contact support.`,
          });
        }
      })
      .catch((error) => {
        console.error("Error posting data:", error);
        // Display error message
        Modal.error({
          content: "Error posting data. Please try again later.",
        });
      });
  };

  const handleCancel = () => {
    //history.push('/project')
    Modal.warning({
      content: "Are you sure you want to cancel?",
      onOk: () => {
        onClose();
        handleClear();
      },
    });
  };

  const handleClear = () => {
    form.resetFields();
    setGeneralDetails(initialGeneralDetails);
    setSelectedEmployeeId(null);
    setSelectedCustomerId(null);
    setSelectedProjectId(null);
  };

  const handleGeneralData = (value, field) => {
    setGeneralDetails((prevState) => ({
      ...prevState,
      [field]: value,
    }));
  };

  // react-datepicker hands back a Date representing a local calendar day, but
  // with an arbitrary (and not always identical between calls) time-of-day
  // component. `date.toISOString()` converts to UTC first, so that stray
  // time-of-day can push the date a day forward/back depending on the local
  // UTC offset. Reading the local Y/M/D getters instead sidesteps that.
  const toLocalISODate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // The reverse of toLocalISODate, for feeding a stored "yyyy-MM-dd" string
  // back into react-datepicker's `selected` prop. react-datepicker calls
  // `new Date(selected)` internally when given anything that isn't already a
  // Date instance — for a bare date string that parses as UTC midnight,
  // which renders as the *previous* day (or month, for the month/year
  // picker) in any timezone behind UTC (e.g. US timezones). Constructing the
  // Date via local year/month/day components instead avoids that shift.
  const parseLocalDate = (iso) => {
    if (!iso) return null;
    const [year, month, day] = iso.split("-").map(Number);
    return new Date(year, month - 1, day);
  };

  // Projects/customers tied to the currently selected employee — falls back to
  // the full lists when no employee is selected yet.
  const projectsForEmployee = useMemo(() => {
    if (!selectedEmployeeId) return projects;
    return projects.filter((project) => project.employeeId === selectedEmployeeId);
  }, [projects, selectedEmployeeId]);

  const customersForEmployee = useMemo(() => {
    if (!selectedEmployeeId) return customers;
    const customerIds = new Set(projectsForEmployee.map((project) => project.customerId));
    return customers.filter((customer) => customerIds.has(customer.customerId));
  }, [customers, projectsForEmployee, selectedEmployeeId]);

  // When more than one project matches a selection, default to the most
  // recently started one (user can still switch via the Project dropdown,
  // which stays scoped to the same matching set).
  const pickLatestProject = (projectList) => {
    if (!projectList || projectList.length === 0) return null;
    return [...projectList].sort((a, b) => {
      const dateA = a.startDate ? new Date(a.startDate).getTime() : -Infinity;
      const dateB = b.startDate ? new Date(b.startDate).getTime() : -Infinity;
      return dateB - dateA;
    })[0];
  };

  // Fill employee/customer/project/billRate fields from a resolved project record.
  const applyProjectSelection = (project) => {
    const employeeId = project?.employeeId ?? null;
    const employeeName = project?.employeeName ?? "";
    const customerId = project?.customerId ?? null;
    const customerName = project?.customerName ?? "";
    const projectId = project?.projectId ?? null;
    const projectName = project?.projectName ?? "";
    const billRate = project?.billRate ?? 0;
    // Backend sends invoiceTerm as a string code (e.g. "1"); normalize to a
    // Number so it matches the dropdown's numeric option values.
    const invoiceTerm =
      project?.invoiceTerm != null ? Number(project.invoiceTerm) : null;

    setSelectedEmployeeId(employeeId);
    setSelectedCustomerId(customerId);
    setSelectedProjectId(projectId);
    form.setFieldsValue({ employeeId, customerId, projectId, billRate, invoiceTerm });
    handleGeneralData(employeeId, "employeeId");
    handleGeneralData(employeeName, "employeeName");
    handleGeneralData(customerId, "customerId");
    handleGeneralData(customerName, "customerName");
    handleGeneralData(projectId, "projectId");
    handleGeneralData(projectName, "projectName");
    handleGeneralData(billRate, "billRate");
    handleGeneralData(invoiceTerm, "invoiceTerm");

    // A Start/End Date already picked for a *different* project may not
    // fall within this one's own date range (switching Employee/Customer/
    // Project never used to revalidate them, letting a stale, now-invalid
    // date slip through all the way to submit). Clamp back into range
    // rather than leaving them stale.
    const newProjectStartDate = project?.startDate || null;
    const newProjectEndDate = project?.endDate || null;

    if (generalDetails.startDate) {
      let clampedStartDate = generalDetails.startDate;
      if (newProjectStartDate && clampedStartDate < newProjectStartDate) {
        clampedStartDate = newProjectStartDate;
      }
      if (newProjectEndDate && clampedStartDate > newProjectEndDate) {
        clampedStartDate = newProjectEndDate;
      }
      if (clampedStartDate !== generalDetails.startDate) {
        handleGeneralData(clampedStartDate, "startDate");
        form.setFieldsValue({ startDate: parseLocalDate(clampedStartDate) });
      }
    }

    if (generalDetails.endDate) {
      let clampedEndDate = generalDetails.endDate;
      if (newProjectEndDate && clampedEndDate > newProjectEndDate) {
        clampedEndDate = newProjectEndDate;
      }
      if (newProjectStartDate && clampedEndDate < newProjectStartDate) {
        clampedEndDate = newProjectStartDate;
      }
      if (clampedEndDate !== generalDetails.endDate) {
        handleGeneralData(clampedEndDate, "endDate");
        form.setFieldsValue({ endDate: parseLocalDate(clampedEndDate) });
      }
    }
  };

  const handleEmployeeChange = (value) => {
    const selectedEmployee = employees.find(
      (employee) => employee.employeeId === value,
    );
    setSelectedEmployeeId(value);
    handleGeneralData(value, "employeeId");
    handleGeneralData(
      selectedEmployee?.Name,
      "employeeName",
    );

    // If this employee has one or more projects, auto-fill the latest one
    // (and its customer/bill rate) — the Project dropdown still lets the user
    // switch to any other project belonging to this employee.
    const matchingProjects = projects.filter(
      (project) => project.employeeId === value,
    );
    if (matchingProjects.length > 0) {
      applyProjectSelection(pickLatestProject(matchingProjects));
      return;
    }

    // Otherwise, a previously selected customer/project (and its bill rate) may not apply to the new employee.
    setSelectedCustomerId(null);
    setSelectedProjectId(null);
    form.setFieldsValue({ customerId: null, projectId: null, billRate: 0, invoiceTerm: null });
    handleGeneralData(null, "customerId");
    handleGeneralData("", "customerName");
    handleGeneralData(null, "projectId");
    handleGeneralData("", "projectName");
    handleGeneralData(0, "billRate");
    handleGeneralData(null, "invoiceTerm");
  };

  // When opened from a context that already knows the employee (e.g. the
  // Employee Full Details "INVOICES" tab), pre-select them by default —
  // same cascade as picking them from the dropdown (auto-fills their latest
  // project/customer/bill rate), but the dropdown still lets the user switch.
  // Re-runs on every reopen (`open` in the deps) since the Drawer doesn't
  // unmount this form on close — after a successful submit, handleClear()
  // resets selectedEmployeeId to null, so without `open` as a dependency
  // this would only ever fire once and never re-fill on the next invoice.
  useEffect(() => {
    if (open && employeeId && employees.length > 0 && !selectedEmployeeId) {
      form.setFieldsValue({ employeeId });
      handleEmployeeChange(employeeId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, employeeId, employees, projects]);

  const handleProjectChange = (value) => {
    const selectedProject = projects.find(
      (project) => project.projectId === value,
    );
    applyProjectSelection(selectedProject);
  };

  const handleCustomerChange = (value) => {
    const selectedCustomer = customers.find(
      (customer) => customer.customerId === value,
    );
    setSelectedCustomerId(value);
    handleGeneralData(value, "customerId");
    handleGeneralData(selectedCustomer?.customerCompanyName || "", "customerName");

    // If this customer (scoped to the current employee, if any) has one or more
    // matching projects, auto-fill the latest one (and its employee/bill rate)
    // — the Project dropdown still lets the user switch to any other match.
    const matchingProjects = projects.filter(
      (project) =>
        project.customerId === value &&
        (!selectedEmployeeId || project.employeeId === selectedEmployeeId),
    );
    if (matchingProjects.length > 0) {
      applyProjectSelection(pickLatestProject(matchingProjects));
    }
  };

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
        }}
      >
        <Spin size="large" />
      </div>
    );
  }

  // Start/End Date must stay within the selected project's own date range.
  const selectedProject = projects.find(
    (project) => project.projectId === selectedProjectId,
  );
  const projectStartDate = selectedProject?.startDate || null;
  const projectEndDate = selectedProject?.endDate || null;

  return (
    <>
      <p>
        Mandatory fields are marked with <Tag color="error">*</Tag>
      </p>
      <h3>Invoice Details</h3>
      <Form
        layout="vertical"
        form={form}
        autoComplete="off"
        style={{ maxWidth: 600 }}
      >
        <Row gutter={25}>
          <Col span={12}>
            <Form.Item
              label="Employee"
              name="employeeId"
              rules={[{ required: true, message: "Please select an employee" }]}
            >
              <Select
                showSearch
                value={selectedEmployeeId}
                onChange={handleEmployeeChange}
                filterOption={(input, option) =>
                  option?.children?.toLowerCase().includes(input.toLowerCase())
                }
              >
                {employees.map((employee) => (
                  <Option key={employee.employeeId} value={employee.employeeId}>
                    {employee.name}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Col>

          <Col span={12}>
            <Form.Item
              label="Customer"
              name="customerId"
              rules={[{ required: true, message: "Please select a customer" }]}
            >
              <Select
                showSearch
                value={selectedCustomerId}
                onChange={handleCustomerChange}
                filterOption={(input, option) =>
                  option?.children?.toLowerCase().includes(input.toLowerCase())
                }
              >
                {customersForEmployee.map((customer) => (
                  <Option key={customer.customerId} value={customer.customerId}>
                    {customer.customerCompanyName}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={25}>
          <Col span={12}>
            <Form.Item
              label="Project"
              name="projectId"
              rules={[{ required: true, message: "Please select an Project" }]}
            >
              <Select
                showSearch
                value={selectedProjectId}
                onChange={handleProjectChange}
                filterOption={(input, option) =>
                  option?.children?.toLowerCase().includes(input.toLowerCase())
                }
              >
                {projectsForEmployee.map((project) => (
                  <Option key={project.projectId} value={project.projectId}>
                    {project.projectName}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="Invoice Term" name="invoiceTerm">
              <Select
                placeholder="Select Invoice Term"
                value={generalDetails.invoiceTerm || undefined}
                onChange={(invoiceTerm) => {
                  handleGeneralData(invoiceTerm, "invoiceTerm");

                  const endDateISO = computeInvoiceEndDate(
                    generalDetails.startDate,
                    invoiceTerm,
                  );
                  if (endDateISO) {
                    handleGeneralData(endDateISO, "endDate");
                    form.setFieldsValue({ endDate: parseLocalDate(endDateISO) });
                  }
                }}
              >
                {INVOICE_TERM_OPTIONS.map((option) => (
                  <Option key={option.value} value={option.value}>
                    {option.label}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={25}>
          <Col span={8}>
            <Form.Item
              label="Invoice Number"
              name="invoiceNumber"
              rules={[{ required: true, message: "Please enter invoice number" }]}
            >
              <Input
                placeholder="Invoice Number"
                onChange={(e) => handleGeneralData(e.target.value, "invoiceNumber")}
                value={generalDetails.invoiceNumber}
              />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              label="Billing"
              name="billRate"
              rules={[{ required: true, message: "Please enter bill amount" }]}
            >
              <Input
                type="number"
                placeholder="Bill Amount"
                onChange={(e) =>
                  handleGeneralData(Number(e.target.value), "billRate")
                }
                value={generalDetails.billRate}
              />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              label="Hours"
              name="hours"
              rules={[{ required: true, message: "Please enter Hours" }]}
            >
              <Input
                placeholder="Hours"
                onChange={(e) => handleGeneralData(e.target.value, "hours")}
                value={generalDetails.hours}
              />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={25}>
          <Col span={8}>
            <Form.Item
              label="Invoice Month"
              name="invoiceMonth"
              rules={[
                { required: true, message: "Please enter invoice month" },
              ]}
            >
              <DatePicker
                selected={parseLocalDate(generalDetails.invoiceMonth)}
                onChange={(date) => {
                  // react-datepicker fires onChange(null) when the input is
                  // fully cleared (e.g. user backspaces all the text).
                  if (!date) {
                    handleGeneralData("", "invoiceMonth");
                    return;
                  }
                  const invoiceMonthISO = toLocalISODate(date);

                  // The derived Start Date (1st of the chosen month) must
                  // fall within the selected project's own date range —
                  // same rule as picking Start Date directly. Exception: if
                  // the project itself starts partway through this same
                  // month, picking that month is still allowed — Start Date
                  // just clamps up to the project's actual start date
                  // instead of the 1st.
                  let startDateISO = `${invoiceMonthISO.slice(0, 7)}-01`;
                  if (projectStartDate && startDateISO < projectStartDate) {
                    const pickedMonth = invoiceMonthISO.slice(0, 7);
                    const projectStartMonth = projectStartDate.slice(0, 7);
                    if (pickedMonth === projectStartMonth) {
                      startDateISO = projectStartDate;
                    } else {
                      Modal.warning({
                        content: `Invoice Month cannot start before the project's start date (${projectStartDate}).`,
                      });
                      return;
                    }
                  }
                  if (projectEndDate && startDateISO > projectEndDate) {
                    Modal.warning({
                      content: `Invoice Month cannot start after the project's end date (${projectEndDate}).`,
                    });
                    return;
                  }

                  handleGeneralData(invoiceMonthISO, "invoiceMonth");
                  handleGeneralData(startDateISO, "startDate");
                  form.setFieldsValue({ startDate: parseLocalDate(startDateISO) });

                  let endDateISO = computeInvoiceEndDate(
                    startDateISO,
                    generalDetails.invoiceTerm,
                  );
                  if (endDateISO) {
                    // Clamped down to the project's own end date, if any.
                    if (projectEndDate && endDateISO > projectEndDate) {
                      endDateISO = projectEndDate;
                    }
                    handleGeneralData(endDateISO, "endDate");
                    form.setFieldsValue({ endDate: parseLocalDate(endDateISO) });
                  }
                }}
                showMonthYearPicker
                dateFormat="MM/yyyy"
              />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item label="Start Date" name="startDate">
              <DatePicker
                selected={parseLocalDate(generalDetails.startDate)}
                onChange={(date) => {
                  // react-datepicker fires onChange(null) when the input is
                  // fully cleared (e.g. user backspaces all the text).
                  if (!date) {
                    handleGeneralData("", "startDate");
                    return;
                  }
                  const startDateISO = toLocalISODate(date);

                  // Start Date must fall within the selected project's own
                  // date range.
                  if (projectStartDate && startDateISO < projectStartDate) {
                    Modal.warning({
                      content: `Start Date cannot be before the project's start date (${projectStartDate}).`,
                    });
                    return;
                  }
                  if (projectEndDate && startDateISO > projectEndDate) {
                    Modal.warning({
                      content: `Start Date cannot be after the project's end date (${projectEndDate}).`,
                    });
                    return;
                  }

                  handleGeneralData(startDateISO, "startDate");

                  // Keep Invoice Month in sync with Start Date's month/year.
                  const invoiceMonthISO = `${startDateISO.slice(0, 7)}-01`;
                  handleGeneralData(invoiceMonthISO, "invoiceMonth");
                  form.setFieldsValue({ invoiceMonth: parseLocalDate(invoiceMonthISO) });

                  let endDateISO = computeInvoiceEndDate(
                    startDateISO,
                    generalDetails.invoiceTerm,
                  );
                  if (endDateISO) {
                    if (projectEndDate && endDateISO > projectEndDate) {
                      endDateISO = projectEndDate;
                    }
                    handleGeneralData(endDateISO, "endDate");
                    form.setFieldsValue({ endDate: parseLocalDate(endDateISO) });
                  }
                }}
                dateFormat="MM/dd/yyyy"
              />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item label="End Date" name="endDate">
              <DatePicker
                selected={parseLocalDate(generalDetails.endDate)}
                onChange={(date) => {
                  // react-datepicker fires onChange(null) when the input is
                  // fully cleared (e.g. user backspaces all the text).
                  if (!date) {
                    handleGeneralData("", "endDate");
                    return;
                  }
                  const endDateISO = toLocalISODate(date);

                  // End Date must fall within the selected project's own
                  // date range.
                  if (projectEndDate && endDateISO > projectEndDate) {
                    Modal.warning({
                      content: `End Date cannot be after the project's end date (${projectEndDate}).`,
                    });
                    return;
                  }
                  if (projectStartDate && endDateISO < projectStartDate) {
                    Modal.warning({
                      content: `End Date cannot be before the project's start date (${projectStartDate}).`,
                    });
                    return;
                  }

                  handleGeneralData(endDateISO, "endDate");
                }}
                dateFormat="MM/dd/yyyy"
              />
            </Form.Item>
          </Col>
        </Row>
        <hr />
        <section>
          <Row gutter={30}>
            <Col span={8} className="form-row">
              <Form.Item>
                <Button type="primary" onClick={handleClear}>
                  Clear
                </Button>
              </Form.Item>
            </Col>
            <Col span={8} className="form-row">
              <Form.Item>
                <Button type="primary" onClick={handleCancel}>
                  Cancel
                </Button>
              </Form.Item>
            </Col>
            <Col span={8} className="form-row">
              <Form.Item>
                <Button type="primary" htmlType="submit" onClick={handleSubmit}>
                  Submit
                </Button>
              </Form.Item>
            </Col>
          </Row>
        </section>
      </Form>
    </>
  );
};

export default NewInvoice;
