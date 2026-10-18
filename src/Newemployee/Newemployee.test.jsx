import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import { Modal } from "antd";
import axios from "axios";
import Newemployee from "./Newemployee";
import API_ENDPOINTS from "../config";

jest.mock("axios");

// This form has ~20 fields; filling the nine mandatory ones through
// userEvent (which simulates real per-character typing) plus an antd Select
// legitimately takes longer than Jest's 5s default on a cold run.
jest.setTimeout(30000);

const VENDORS = [
  { vendorId: 11, vendorCompanyName: "Supplier Inc" },
  { vendorId: 12, vendorCompanyName: "", vendorName: "Sam Supplier" },
];

beforeEach(() => {
  axios.get.mockResolvedValue({ data: VENDORS });
});

afterEach(() => {
  // antd's static Modal.* calls mount into their own root appended to
  // document.body, outside the tree RTL's automatic cleanup unmounts, so they
  // leak across tests unless explicitly destroyed.
  Modal.destroyAll();
  jest.clearAllMocks();
});

const renderForm = async (onClose = jest.fn()) => {
  render(<Newemployee onClose={onClose} />);
  // The vendor list is fetched on mount; wait for that to settle so no state
  // update lands outside an act() boundary.
  await waitFor(() => expect(axios.get).toHaveBeenCalledWith(API_ENDPOINTS.getAllVendors));
  return { onClose };
};

const selectDropdownOption = async (labelText, optionText) => {
  const combo = screen.getByRole("combobox", { name: labelText });
  await userEvent.click(combo);
  await waitFor(() => expect(combo).toHaveAttribute("aria-expanded", "true"));
  const listboxId = combo.getAttribute("aria-controls");
  let container = null;
  await waitFor(() => {
    container = document.getElementById(listboxId)?.parentElement ?? null;
    expect(container).not.toBeNull();
  });
  await userEvent.click(await within(container).findByTitle(optionText));
};

// The nine fields handleSubmit actually guards on.
const fillMandatoryFields = async (overrides = {}) => {
  const values = {
    firstName: "Ada",
    lastName: "Lovelace",
    designation: "Engineer",
    ssn: "123-45-6789",
    email: "ada@example.com",
    phone: "5551234567",
    zipCode: "75001",
    gender: "Female",
    company: "Intellan Technologies LLC",
    ...overrides,
  };

  if (values.firstName) {
    await userEvent.type(screen.getByPlaceholderText("First Name"), values.firstName);
  }
  if (values.lastName) {
    await userEvent.type(screen.getByPlaceholderText("Last Name"), values.lastName);
  }
  if (values.designation) {
    await userEvent.type(screen.getByPlaceholderText("Designation"), values.designation);
  }
  if (values.ssn) await userEvent.type(screen.getByPlaceholderText("ssn"), values.ssn);
  if (values.email) {
    await userEvent.type(screen.getByPlaceholderText("you@company.com"), values.email);
  }
  if (values.phone) {
    await userEvent.type(screen.getByPlaceholderText("+1 (555) 000-000"), values.phone);
  }
  if (values.zipCode) {
    await userEvent.type(screen.getByPlaceholderText("Enter Zip Code"), values.zipCode);
  }
  if (values.gender) {
    await userEvent.click(screen.getByRole("radio", { name: values.gender }));
  }
  if (values.company) await selectDropdownOption("Company", values.company);
};

const submit = async () => {
  await userEvent.click(screen.getByRole("button", { name: "Submit" }));
};

const lastPostedBody = () => axios.post.mock.calls.at(-1)[1];

describe("Newemployee — rendering", () => {
  it("tells the user which fields are mandatory", async () => {
    await renderForm();

    expect(screen.getByText(/Mandatory fields are marked with/)).toBeInTheDocument();
  });

  it("renders the personal details fields", async () => {
    await renderForm();

    expect(screen.getByPlaceholderText("First Name")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Last Name")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Designation")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("ssn")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("you@company.com")).toBeInTheDocument();
  });

  it("offers all three gender choices as radio buttons", async () => {
    await renderForm();

    expect(screen.getByRole("radio", { name: "Male" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Female" })).toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: /I Choose not to disclose/ }),
    ).toBeInTheDocument();
  });

  it("renders the employment status section", async () => {
    await renderForm();

    expect(screen.getByRole("heading", { name: "Employment Status" })).toBeInTheDocument();
    expect(screen.getByLabelText("Employement Type")).toBeInTheDocument();
    expect(screen.getByLabelText("Tax Terms")).toBeInTheDocument();
    expect(screen.getByLabelText("Status")).toBeInTheDocument();
    expect(screen.getByLabelText("Company")).toBeInTheDocument();
    expect(screen.getByLabelText("Current Work Authorization Type")).toBeInTheDocument();
  });
});

describe("Newemployee — vendor loading", () => {
  it("fetches the vendor list once on mount", async () => {
    await renderForm();

    expect(axios.get).toHaveBeenCalledTimes(1);
  });

  it("hides the Vendor dropdown until the employment type is C2C", async () => {
    await renderForm();

    expect(screen.queryByLabelText("Vendor")).not.toBeInTheDocument();
  });

  it("reveals the Vendor dropdown once the employment type is C2C", async () => {
    await renderForm();

    await selectDropdownOption("Employement Type", "C2C");

    expect(await screen.findByLabelText("Vendor")).toBeInTheDocument();
  });

  it("keeps the Vendor dropdown hidden for a non-C2C employment type", async () => {
    await renderForm();

    await selectDropdownOption("Employement Type", "Full-Time");

    expect(screen.queryByLabelText("Vendor")).not.toBeInTheDocument();
  });

  it("lists each vendor by company name, falling back to the contact name", async () => {
    await renderForm();
    await selectDropdownOption("Employement Type", "C2C");

    const combo = await screen.findByRole("combobox", { name: "Vendor" });
    await userEvent.click(combo);

    expect(await screen.findByTitle("Supplier Inc")).toBeInTheDocument();
    expect(await screen.findByTitle("Sam Supplier")).toBeInTheDocument();
  });

  it("still renders the form when the vendor fetch fails", async () => {
    axios.get.mockRejectedValue(new Error("network down"));
    render(<Newemployee onClose={jest.fn()} />);

    expect(await screen.findByPlaceholderText("First Name")).toBeInTheDocument();
  });
});

describe("Newemployee — mandatory field validation", () => {
  let alertSpy;

  beforeEach(() => {
    alertSpy = jest.spyOn(window, "alert").mockImplementation(() => {});
  });

  afterEach(() => {
    alertSpy.mockRestore();
  });

  it("blocks submission and warns when the form is entirely empty", async () => {
    await renderForm();

    await submit();

    expect(alertSpy).toHaveBeenCalledWith("Please fill in all mandatory fields");
    expect(axios.post).not.toHaveBeenCalled();
  });

  it.each([
    ["first name", { firstName: null }],
    ["last name", { lastName: null }],
    ["designation", { designation: null }],
    ["SSN", { ssn: null }],
    ["email", { email: null }],
    ["phone number", { phone: null }],
    ["zip code", { zipCode: null }],
    ["gender", { gender: null }],
    ["company", { company: null }],
  ])("blocks submission when the %s is missing", async (_label, overrides) => {
    await renderForm();

    await fillMandatoryFields(overrides);
    await submit();

    expect(alertSpy).toHaveBeenCalledWith("Please fill in all mandatory fields");
    expect(axios.post).not.toHaveBeenCalled();
  });

  it("allows submission once every mandatory field is filled", async () => {
    axios.post.mockResolvedValue({ data: { employeeId: 1 } });
    await renderForm();

    await fillMandatoryFields();
    await submit();

    await waitFor(() => expect(axios.post).toHaveBeenCalled());
    expect(alertSpy).not.toHaveBeenCalled();
  });
});

describe("Newemployee — submission payload", () => {
  beforeEach(() => {
    axios.post.mockResolvedValue({ data: { employeeId: 1 } });
  });

  it("posts to the employee onboarding endpoint", async () => {
    await renderForm();

    await fillMandatoryFields();
    await submit();

    await waitFor(() =>
      expect(axios.post).toHaveBeenCalledWith(
        API_ENDPOINTS.saveOnBoardDetails,
        expect.any(Object),
      ),
    );
  });

  it("includes the personal details the user entered", async () => {
    await renderForm();

    await fillMandatoryFields();
    await submit();

    await waitFor(() => expect(axios.post).toHaveBeenCalled());
    expect(lastPostedBody()).toMatchObject({
      firstName: "Ada",
      lastName: "Lovelace",
      designation: "Engineer",
      ssn: "123-45-6789",
      emailId: "ada@example.com",
      phoneNumber: "5551234567",
      zipCode: "75001",
    });
  });

  it("sends the gender code behind the selected radio button", async () => {
    await renderForm();

    await fillMandatoryFields({ gender: "Female" });
    await submit();

    await waitFor(() => expect(axios.post).toHaveBeenCalled());
    expect(lastPostedBody().gender).toBe("f");
  });

  it("mirrors employmentType into employeeType, which the C2C tax exemption reads", async () => {
    await renderForm();

    await fillMandatoryFields();
    await selectDropdownOption("Employement Type", "C2C");
    await submit();

    await waitFor(() => expect(axios.post).toHaveBeenCalled());
    expect(lastPostedBody().employmentType).toBe("C2C");
    expect(lastPostedBody().employeeType).toBe("C2C");
  });

  it("sends the chosen vendor id for a C2C hire", async () => {
    await renderForm();

    await fillMandatoryFields();
    await selectDropdownOption("Employement Type", "C2C");
    await selectDropdownOption("Vendor", "Supplier Inc");
    await submit();

    await waitFor(() => expect(axios.post).toHaveBeenCalled());
    expect(lastPostedBody().vendorId).toBe(11);
  });

  it("leaves the vendor id null for a non-C2C hire", async () => {
    await renderForm();

    await fillMandatoryFields();
    await selectDropdownOption("Employement Type", "Full-Time");
    await submit();

    await waitFor(() => expect(axios.post).toHaveBeenCalled());
    expect(lastPostedBody().vendorId).toBeNull();
  });

  it("sends the company name, which decides the employee's reserved id range", async () => {
    await renderForm();

    await fillMandatoryFields({ company: "Code9 LLC" });
    await submit();

    await waitFor(() => expect(axios.post).toHaveBeenCalled());
    expect(lastPostedBody().companyName).toBe("Code9 LLC");
  });

  it("sends the working status, which decides the standard vs new-hire id range", async () => {
    await renderForm();

    await fillMandatoryFields();
    await selectDropdownOption("Status", "New Hires");
    await submit();

    await waitFor(() => expect(axios.post).toHaveBeenCalled());
    expect(lastPostedBody().status).toBe("NewHires");
  });

  it("sends the work authorization type", async () => {
    await renderForm();

    await fillMandatoryFields();
    await selectDropdownOption("Current Work Authorization Type", "H1B");
    await submit();

    await waitFor(() => expect(axios.post).toHaveBeenCalled());
    expect(lastPostedBody().workAuthorization).toBe("H1B");
  });

  it("sends the tax terms", async () => {
    await renderForm();

    await fillMandatoryFields();
    await selectDropdownOption("Tax Terms", "W2");
    await submit();

    await waitFor(() => expect(axios.post).toHaveBeenCalled());
    expect(lastPostedBody().taxTerms).toBe("W2");
  });

  it("sends the address components the backend turns into an Address row", async () => {
    await renderForm();

    await fillMandatoryFields();
    await userEvent.type(screen.getByPlaceholderText("Add address"), "123 Main St");
    await userEvent.type(screen.getByPlaceholderText("city"), "Dallas");
    await userEvent.type(screen.getByPlaceholderText("state"), "TX");
    await selectDropdownOption("Country", "USA");
    await submit();

    await waitFor(() => expect(axios.post).toHaveBeenCalled());
    expect(lastPostedBody()).toMatchObject({
      streetAddress: "123 Main St",
      city: "Dallas",
      state: "TX",
      country: "USA",
    });
  });

  it("sends the referredBy free-text field", async () => {
    await renderForm();

    await fillMandatoryFields();
    await userEvent.type(screen.getByLabelText("ReferredBy"), "Alan Turing");
    await submit();

    await waitFor(() => expect(axios.post).toHaveBeenCalled());
    expect(lastPostedBody().referredBy).toBe("Alan Turing");
  });
});

describe("Newemployee — submission outcome", () => {
  it("shows a success message when the save succeeds", async () => {
    axios.post.mockResolvedValue({ data: { employeeId: 1 } });
    await renderForm();

    await fillMandatoryFields();
    await submit();

    expect(await screen.findByText("Data saved successfully")).toBeInTheDocument();
  });

  it("offers an OK action on the success message so the drawer can be dismissed", async () => {
    // That clicking OK actually calls onClose("submit") is asserted in
    // Newemployee.onClose.test.jsx — see the note at the top of that file for
    // why it cannot live alongside these tests.
    axios.post.mockResolvedValue({ data: { employeeId: 1 } });
    await renderForm();

    await fillMandatoryFields();
    await submit();

    const successMessage = await screen.findByText("Data saved successfully");
    const modal = successMessage.closest(".ant-modal-confirm");
    expect(within(modal).getByRole("button", { name: "OK" })).toBeInTheDocument();
  });

  it("shows an error message when the save fails", async () => {
    axios.post.mockRejectedValue(new Error("network down"));
    await renderForm();

    await fillMandatoryFields();
    await submit();

    expect(
      await screen.findByText("Error posting data. Please try again later."),
    ).toBeInTheDocument();
  });

  it("does not close the drawer when the save fails", async () => {
    axios.post.mockRejectedValue(new Error("network down"));
    const { onClose } = await renderForm();

    await fillMandatoryFields();
    await submit();

    await screen.findByText("Error posting data. Please try again later.");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("keeps the entered data on screen when the save fails", async () => {
    axios.post.mockRejectedValue(new Error("network down"));
    await renderForm();

    await fillMandatoryFields();
    await submit();

    await screen.findByText("Error posting data. Please try again later.");
    expect(screen.getByPlaceholderText("First Name")).toHaveValue("Ada");
  });
});
