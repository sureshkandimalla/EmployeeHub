import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import { Modal } from "antd";
import axios from "axios";
import NewPotentialEmployee from "./NewPotentialEmployee";
import API_ENDPOINTS from "../config";

jest.mock("axios");

jest.setTimeout(30000);

afterEach(() => {
  Modal.destroyAll();
  jest.clearAllMocks();
});

const renderForm = (onClose = jest.fn()) => {
  render(<NewPotentialEmployee onClose={onClose} />);
  return { onClose };
};

// Several Form.Items on this form carry a `label` but no `name`, so antd never
// links the <label> to its control and the accessible-name query finds
// nothing. Resolve the combobox through its own form item instead, which is
// still a user-visible relationship ("the dropdown under the Gender label").
const getComboByFieldLabel = (labelText) => {
  const formItem = screen.getByText(labelText).closest(".ant-form-item");
  return within(formItem).getByRole("combobox");
};

const selectDropdownOption = async (labelText, optionText) => {
  const combo = getComboByFieldLabel(labelText);
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

// The four fields handleSubmit actually guards on.
const fillMandatoryFields = async ({
  firstName = "Grace",
  lastName = "Hopper",
  email = "grace@example.com",
  phone = "5557654321",
} = {}) => {
  if (firstName) await userEvent.type(screen.getByPlaceholderText("First Name"), firstName);
  if (lastName) await userEvent.type(screen.getByPlaceholderText("Last Name"), lastName);
  if (email) await userEvent.type(screen.getByPlaceholderText("you@company.com"), email);
  if (phone) await userEvent.type(screen.getByPlaceholderText("+1 (555) 000-000"), phone);
};

const submit = async () => {
  await userEvent.click(screen.getByRole("button", { name: "Submit" }));
};

const lastPostedBody = () => axios.post.mock.calls.at(-1)[1];

describe("NewPotentialEmployee — rendering", () => {
  it("tells the user which fields are mandatory", () => {
    renderForm();

    expect(screen.getByText(/Mandatory fields are marked with/)).toBeInTheDocument();
  });

  it("renders the mandatory identity and contact fields", () => {
    renderForm();

    expect(screen.getByPlaceholderText("First Name")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Last Name")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("you@company.com")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("+1 (555) 000-000")).toBeInTheDocument();
  });

  it("renders the recruiting fields a sourcer fills in", () => {
    renderForm();

    expect(screen.getByPlaceholderText("Primary Skills")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Secondary Skills")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Current Location")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Referred By")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Company")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Year")).toBeInTheDocument();
  });

  it("renders the gender, status and work-country dropdowns", () => {
    renderForm();

    expect(getComboByFieldLabel("Gender")).toBeInTheDocument();
    expect(getComboByFieldLabel("Status")).toBeInTheDocument();
    expect(getComboByFieldLabel("Work Country")).toBeInTheDocument();
  });

  it("starts with every text field blank", () => {
    renderForm();

    expect(screen.getByPlaceholderText("First Name")).toHaveValue("");
    expect(screen.getByPlaceholderText("Primary Skills")).toHaveValue("");
  });
});

describe("NewPotentialEmployee — mandatory field validation", () => {
  let alertSpy;

  beforeEach(() => {
    alertSpy = jest.spyOn(window, "alert").mockImplementation(() => {});
  });

  afterEach(() => {
    alertSpy.mockRestore();
  });

  it("blocks submission and warns when the form is entirely empty", async () => {
    renderForm();

    await submit();

    expect(alertSpy).toHaveBeenCalledWith("Please fill in all mandatory fields.");
    expect(axios.post).not.toHaveBeenCalled();
  });

  it.each([
    ["first name", { firstName: null }],
    ["last name", { lastName: null }],
    ["email", { email: null }],
    ["phone number", { phone: null }],
  ])("blocks submission when the %s is missing", async (_label, overrides) => {
    renderForm();

    await fillMandatoryFields(overrides);
    await submit();

    expect(alertSpy).toHaveBeenCalledWith("Please fill in all mandatory fields.");
    expect(axios.post).not.toHaveBeenCalled();
  });

  it("allows submission once every mandatory field is filled", async () => {
    axios.post.mockResolvedValue({ data: { id: 1 } });
    renderForm();

    await fillMandatoryFields();
    await submit();

    await waitFor(() => expect(axios.post).toHaveBeenCalled());
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it("shows antd's own validation message for a badly formatted email", async () => {
    renderForm();

    const emailInput = screen.getByPlaceholderText("you@company.com");
    await userEvent.type(emailInput, "not-an-email");
    await userEvent.tab();

    expect(await screen.findByText("Please enter a valid Email ID")).toBeInTheDocument();
  });
});

describe("NewPotentialEmployee — submission payload", () => {
  beforeEach(() => {
    axios.post.mockResolvedValue({ data: { id: 1 } });
  });

  it("posts to the potential-employee endpoint", async () => {
    renderForm();

    await fillMandatoryFields();
    await submit();

    await waitFor(() =>
      expect(axios.post).toHaveBeenCalledWith(
        API_ENDPOINTS.createPotentialEmployee,
        expect.any(Object),
      ),
    );
  });

  it("includes the identity and contact fields the user entered", async () => {
    renderForm();

    await fillMandatoryFields();
    await submit();

    await waitFor(() => expect(axios.post).toHaveBeenCalled());
    expect(lastPostedBody()).toMatchObject({
      firstName: "Grace",
      lastName: "Hopper",
      emailId: "grace@example.com",
      phone: "5557654321",
    });
  });

  it("includes the gender the user picked", async () => {
    renderForm();

    await fillMandatoryFields();
    await selectDropdownOption("Gender", "Female");
    await submit();

    await waitFor(() => expect(axios.post).toHaveBeenCalled());
    expect(lastPostedBody().gender).toBe("Female");
  });

  it("includes the status the user picked", async () => {
    renderForm();

    await fillMandatoryFields();
    await selectDropdownOption("Status", "Active");
    await submit();

    await waitFor(() => expect(axios.post).toHaveBeenCalled());
    expect(lastPostedBody().status).toBe("Active");
  });

  it("includes the work country the user picked", async () => {
    renderForm();

    await fillMandatoryFields();
    await selectDropdownOption("Work Country", "USA");
    await submit();

    await waitFor(() => expect(axios.post).toHaveBeenCalled());
    expect(lastPostedBody().workCountry).toBe("USA");
  });

  it("includes the skills, location, referrer and company fields", async () => {
    renderForm();

    await fillMandatoryFields();
    await userEvent.type(screen.getByPlaceholderText("Primary Skills"), "Java");
    await userEvent.type(screen.getByPlaceholderText("Secondary Skills"), "SQL");
    await userEvent.type(screen.getByPlaceholderText("Current Location"), "Dallas");
    await userEvent.type(screen.getByPlaceholderText("Referred By"), "Ada");
    await userEvent.type(screen.getByPlaceholderText("Company"), "Acme Corp");
    await userEvent.type(screen.getByPlaceholderText("Year"), "2026");
    await submit();

    await waitFor(() => expect(axios.post).toHaveBeenCalled());
    expect(lastPostedBody()).toMatchObject({
      primarySkills: "Java",
      secondarySkills: "SQL",
      currentLocation: "Dallas",
      referredBy: "Ada",
      company: "Acme Corp",
      year: "2026",
    });
  });

  it("leaves the untouched date fields null rather than sending an empty string", async () => {
    renderForm();

    await fillMandatoryFields();
    await submit();

    await waitFor(() => expect(axios.post).toHaveBeenCalled());
    expect(lastPostedBody().dob).toBeNull();
    expect(lastPostedBody().startDate).toBeNull();
    expect(lastPostedBody().endDate).toBeNull();
  });
});

describe("NewPotentialEmployee — submission outcome", () => {
  it("shows a success message when the save succeeds", async () => {
    axios.post.mockResolvedValue({ data: { id: 1 } });
    renderForm();

    await fillMandatoryFields();
    await submit();

    expect(await screen.findByText("Data saved successfully")).toBeInTheDocument();
  });

  it("shows an error message when the save fails", async () => {
    axios.post.mockRejectedValue(new Error("network down"));
    renderForm();

    await fillMandatoryFields();
    await submit();

    expect(
      await screen.findByText("Error posting data. Please try again later."),
    ).toBeInTheDocument();
  });

  it("keeps the entered data on screen when the save fails", async () => {
    axios.post.mockRejectedValue(new Error("network down"));
    renderForm();

    await fillMandatoryFields();
    await submit();

    await screen.findByText("Error posting data. Please try again later.");
    expect(screen.getByPlaceholderText("First Name")).toHaveValue("Grace");
  });

  it("does not close the drawer when the save fails", async () => {
    axios.post.mockRejectedValue(new Error("network down"));
    const { onClose } = renderForm();

    await fillMandatoryFields();
    await submit();

    await screen.findByText("Error posting data. Please try again later.");
    expect(onClose).not.toHaveBeenCalled();
  });
});
