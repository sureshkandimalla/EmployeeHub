import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import { Modal } from "antd";
import axios from "axios";
import { MemoryRouter } from "react-router-dom";
import NewCustomer from "./NewCustomer";
import API_ENDPOINTS from "../config";

jest.mock("axios");

// antd's static Modal.success/Modal.error calls render into their own DOM root
// appended to document.body, outside the tree RTL's automatic cleanup
// unmounts — so they leak across tests unless explicitly destroyed.
afterEach(() => {
  Modal.destroyAll();
  jest.clearAllMocks();
});

const renderForm = () => {
  render(
    <MemoryRouter>
      <NewCustomer />
    </MemoryRouter>,
  );
};

// The visible, clickable antd dropdown rows are plain `.ant-select-item-option`
// divs carrying a `title` attribute, not the role="option" elements (those
// belong to a separate, zero-size accessibility-only proxy list).
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

const fillMandatoryFields = async ({
  customerName = "Jane Buyer",
  ein = "12-3456789",
  phone = "5551234567",
  email = "jane@acme.test",
} = {}) => {
  if (customerName) {
    await userEvent.type(screen.getByPlaceholderText("Customer Name"), customerName);
  }
  if (ein) await userEvent.type(screen.getByPlaceholderText("EIN"), ein);
  if (phone) await userEvent.type(screen.getByPlaceholderText("+1 (555) 000-000"), phone);
  if (email) await userEvent.type(screen.getByPlaceholderText("you@company.com"), email);
};

const submit = async () => {
  await userEvent.click(screen.getByRole("button", { name: "Submit" }));
};

const lastPostedBody = () => axios.post.mock.calls.at(-1)[1];

describe("NewCustomer — rendering", () => {
  it("renders the business, address and commercial-terms sections", () => {
    renderForm();

    expect(screen.getByRole("heading", { name: "Business Details" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Address" })).toBeInTheDocument();
  });

  it("renders every mandatory field", () => {
    renderForm();

    expect(screen.getByPlaceholderText("Customer Name")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Customer Company Name")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("EIN")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("you@company.com")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("+1 (555) 000-000")).toBeInTheDocument();
  });

  it("renders the optional commercial-terms fields", () => {
    renderForm();

    expect(screen.getByLabelText("Standard Currency")).toBeInTheDocument();
    expect(screen.getByLabelText("Default Billing Method")).toBeInTheDocument();
    expect(screen.getByLabelText("Payment Terms")).toBeInTheDocument();
    expect(screen.getByLabelText("MSA Status")).toBeInTheDocument();
  });

  it("starts with every text field blank", () => {
    renderForm();

    expect(screen.getByPlaceholderText("Customer Name")).toHaveValue("");
    expect(screen.getByPlaceholderText("Customer Company Name")).toHaveValue("");
    expect(screen.getByPlaceholderText("EIN")).toHaveValue("");
  });
});

describe("NewCustomer — Company Name auto-fill", () => {
  it("mirrors Customer Name into Customer Company Name while Company Name is untouched", async () => {
    renderForm();

    await userEvent.type(screen.getByPlaceholderText("Customer Name"), "Acme");

    expect(screen.getByPlaceholderText("Customer Company Name")).toHaveValue("Acme");
  });

  it("stops mirroring once the user edits Company Name directly", async () => {
    renderForm();

    await userEvent.type(screen.getByPlaceholderText("Customer Name"), "Acme");
    await userEvent.type(screen.getByPlaceholderText("Customer Company Name"), " Corporation");
    await userEvent.type(screen.getByPlaceholderText("Customer Name"), " Industries");

    expect(screen.getByPlaceholderText("Customer Company Name")).toHaveValue("Acme Corporation");
  });

  it("submits the mirrored company name when the user never edits it", async () => {
    axios.post.mockResolvedValue({ data: { customerId: 1 } });
    renderForm();

    await fillMandatoryFields({ customerName: "Acme" });
    await submit();

    await waitFor(() => expect(axios.post).toHaveBeenCalled());
    expect(lastPostedBody().customerCompanyName).toBe("Acme");
  });

  it("submits the separately-edited company name once it has diverged", async () => {
    axios.post.mockResolvedValue({ data: { customerId: 1 } });
    renderForm();

    await fillMandatoryFields({ customerName: "Acme" });
    await userEvent.type(screen.getByPlaceholderText("Customer Company Name"), " Corp");
    await submit();

    await waitFor(() => expect(axios.post).toHaveBeenCalled());
    expect(lastPostedBody().customerCompanyName).toBe("Acme Corp");
    expect(lastPostedBody().customerName).toBe("Acme");
  });
});

describe("NewCustomer — mandatory field validation", () => {
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

    expect(alertSpy).toHaveBeenCalledWith("Please fill in all mandatory fields");
    expect(axios.post).not.toHaveBeenCalled();
  });

  it("blocks submission when Customer Name is missing", async () => {
    renderForm();

    await fillMandatoryFields({ customerName: null });
    await submit();

    expect(alertSpy).toHaveBeenCalled();
    expect(axios.post).not.toHaveBeenCalled();
  });

  it("blocks submission when EIN is missing", async () => {
    renderForm();

    await fillMandatoryFields({ ein: null });
    await submit();

    expect(alertSpy).toHaveBeenCalled();
    expect(axios.post).not.toHaveBeenCalled();
  });

  it("blocks submission when the phone number is missing", async () => {
    renderForm();

    await fillMandatoryFields({ phone: null });
    await submit();

    expect(alertSpy).toHaveBeenCalled();
    expect(axios.post).not.toHaveBeenCalled();
  });

  it("blocks submission when the email is missing", async () => {
    renderForm();

    await fillMandatoryFields({ email: null });
    await submit();

    expect(alertSpy).toHaveBeenCalled();
    expect(axios.post).not.toHaveBeenCalled();
  });

  it("allows submission once every mandatory field is filled", async () => {
    axios.post.mockResolvedValue({ data: { customerId: 1 } });
    renderForm();

    await fillMandatoryFields();
    await submit();

    await waitFor(() => expect(axios.post).toHaveBeenCalled());
    expect(alertSpy).not.toHaveBeenCalled();
  });
});

describe("NewCustomer — submission payload", () => {
  beforeEach(() => {
    axios.post.mockResolvedValue({ data: { customerId: 1 } });
  });

  it("posts to the customer onboarding endpoint", async () => {
    renderForm();

    await fillMandatoryFields();
    await submit();

    await waitFor(() =>
      expect(axios.post).toHaveBeenCalledWith(
        API_ENDPOINTS.saveOnBoardDetailsCustomer,
        expect.any(Object),
      ),
    );
  });

  it("includes the identity and contact fields the user entered", async () => {
    renderForm();

    await fillMandatoryFields({
      customerName: "Jane Buyer",
      ein: "12-3456789",
      phone: "5551234567",
      email: "jane@acme.test",
    });
    await submit();

    await waitFor(() => expect(axios.post).toHaveBeenCalled());
    expect(lastPostedBody()).toMatchObject({
      customerName: "Jane Buyer",
      ein: "12-3456789",
      phone: "5551234567",
      emailId: "jane@acme.test",
    });
  });

  it("includes the separate address components the backend flattens", async () => {
    renderForm();

    await fillMandatoryFields();
    await userEvent.type(screen.getByPlaceholderText("Add address"), "123 Main St");
    await userEvent.type(
      screen.getByPlaceholderText("Apt, suite, unit, etc. (optional)"),
      "Suite 400",
    );
    await userEvent.type(screen.getByPlaceholderText("city"), "Dallas");
    await userEvent.type(screen.getByPlaceholderText("state"), "TX");
    await userEvent.type(screen.getByPlaceholderText("Enter Zip Code"), "75001");
    await submit();

    await waitFor(() => expect(axios.post).toHaveBeenCalled());
    expect(lastPostedBody()).toMatchObject({
      streetAddress: "123 Main St",
      streetAddress2: "Suite 400",
      city: "Dallas",
      state: "TX",
      zipCode: "75001",
    });
  });

  it("defaults the country and currency so a minimal submission is still complete", async () => {
    renderForm();

    await fillMandatoryFields();
    await submit();

    await waitFor(() => expect(axios.post).toHaveBeenCalled());
    expect(lastPostedBody().country).toBe("USA");
    expect(lastPostedBody().standardCurrency).toBe("USD");
  });

  it("defaults the start date to today in ISO form", async () => {
    renderForm();

    await fillMandatoryFields();
    await submit();

    await waitFor(() => expect(axios.post).toHaveBeenCalled());
    expect(lastPostedBody().startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("leaves the optional dropdowns null when the user does not pick one", async () => {
    renderForm();

    await fillMandatoryFields();
    await submit();

    await waitFor(() => expect(axios.post).toHaveBeenCalled());
    expect(lastPostedBody().msaStatus).toBeNull();
    expect(lastPostedBody().defaultBillingMethod).toBeNull();
    expect(lastPostedBody().paymentTerms).toBeNull();
  });

  it("includes an MSA status the user picked from the dropdown", async () => {
    renderForm();

    await fillMandatoryFields();
    await selectDropdownOption("MSA Status", "Signed");
    await submit();

    await waitFor(() => expect(axios.post).toHaveBeenCalled());
    expect(lastPostedBody().msaStatus).toBe("Signed");
  });

  it("includes the credit limit as a number, not a string", async () => {
    renderForm();

    await fillMandatoryFields();
    await userEvent.type(screen.getByPlaceholderText("Credit Limit"), "50000");
    await submit();

    await waitFor(() => expect(axios.post).toHaveBeenCalled());
    expect(lastPostedBody().creditLimit).toBe(50000);
  });

  it("includes the billing and AP contacts and the notes", async () => {
    renderForm();

    await fillMandatoryFields();
    await userEvent.type(screen.getByPlaceholderText("billing@company.com"), "billing@acme.test");
    await userEvent.type(screen.getByPlaceholderText("ap@company.com"), "ap@acme.test");
    await userEvent.type(screen.getByPlaceholderText("Notes"), "Prefers ACH");
    await submit();

    await waitFor(() => expect(axios.post).toHaveBeenCalled());
    expect(lastPostedBody()).toMatchObject({
      billingContact: "billing@acme.test",
      apContact: "ap@acme.test",
      notes: "Prefers ACH",
    });
  });
});

describe("NewCustomer — submission outcome", () => {
  it("shows a success message when the save succeeds", async () => {
    axios.post.mockResolvedValue({ data: { customerId: 1 } });
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

  it("keeps the entered data on screen when the save fails, so nothing is retyped", async () => {
    axios.post.mockRejectedValue(new Error("network down"));
    renderForm();

    await fillMandatoryFields({ customerName: "Jane Buyer" });
    await submit();

    await screen.findByText("Error posting data. Please try again later.");
    expect(screen.getByPlaceholderText("Customer Name")).toHaveValue("Jane Buyer");
  });

  it("does not show a success message when the response has no body", async () => {
    axios.post.mockResolvedValue({});
    renderForm();

    await fillMandatoryFields();
    await submit();

    await waitFor(() => expect(axios.post).toHaveBeenCalled());
    expect(screen.queryByText("Data saved successfully")).not.toBeInTheDocument();
  });
});
