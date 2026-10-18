import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import { Modal } from "antd";
import axios from "axios";
import { MemoryRouter } from "react-router-dom";
import NewVendor from "./NewVendor";
import API_ENDPOINTS from "../config";

jest.mock("axios");

// antd's static Modal.success/Modal.error calls render outside the tree RTL
// unmounts, so they leak across tests unless explicitly destroyed.
afterEach(() => {
  Modal.destroyAll();
  jest.clearAllMocks();
});

const renderForm = () => {
  render(
    <MemoryRouter>
      <NewVendor />
    </MemoryRouter>,
  );
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

const fillMandatoryFields = async ({
  vendorName = "Sam Supplier",
  ein = "98-7654321",
  phone = "5559876543",
  email = "sam@supplier.test",
} = {}) => {
  if (vendorName) await userEvent.type(screen.getByPlaceholderText("Vendor Name"), vendorName);
  if (ein) await userEvent.type(screen.getByPlaceholderText("EIN"), ein);
  if (phone) await userEvent.type(screen.getByPlaceholderText("+1 (555) 000-000"), phone);
  if (email) await userEvent.type(screen.getByPlaceholderText("you@company.com"), email);
};

const submit = async () => {
  await userEvent.click(screen.getByRole("button", { name: "Submit" }));
};

const lastPostedBody = () => axios.post.mock.calls.at(-1)[1];

describe("NewVendor — rendering", () => {
  it("tells the user which fields are mandatory", () => {
    renderForm();

    expect(screen.getByText(/Mandatory fields are marked with/)).toBeInTheDocument();
  });

  it("renders every mandatory field", () => {
    renderForm();

    expect(screen.getByPlaceholderText("Vendor Name")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Vendor Company Name")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("EIN")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("you@company.com")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("+1 (555) 000-000")).toBeInTheDocument();
  });

  it("renders the vendor-specific type, status and payment fields", () => {
    renderForm();

    expect(screen.getByLabelText("Vendor Type")).toBeInTheDocument();
    expect(screen.getByLabelText("Status")).toBeInTheDocument();
    expect(screen.getByLabelText("Payment Terms")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Payment Policy")).toBeInTheDocument();
  });

  it("renders the address section", () => {
    renderForm();

    expect(screen.getByPlaceholderText("Add address")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("city")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Enter Zip Code")).toBeInTheDocument();
  });
});

describe("NewVendor — Company Name auto-fill", () => {
  it("mirrors Vendor Name into Vendor Company Name while Company Name is untouched", async () => {
    renderForm();

    await userEvent.type(screen.getByPlaceholderText("Vendor Name"), "Supplier");

    expect(screen.getByPlaceholderText("Vendor Company Name")).toHaveValue("Supplier");
  });

  it("stops mirroring once the user edits Company Name directly", async () => {
    renderForm();

    await userEvent.type(screen.getByPlaceholderText("Vendor Name"), "Supplier");
    await userEvent.type(screen.getByPlaceholderText("Vendor Company Name"), " Inc");
    await userEvent.type(screen.getByPlaceholderText("Vendor Name"), " Group");

    expect(screen.getByPlaceholderText("Vendor Company Name")).toHaveValue("Supplier Inc");
  });

  it("submits the mirrored company name when the user never edits it", async () => {
    axios.post.mockResolvedValue({ data: { vendorId: 1 } });
    renderForm();

    await fillMandatoryFields({ vendorName: "Supplier" });
    await submit();

    await waitFor(() => expect(axios.post).toHaveBeenCalled());
    expect(lastPostedBody().vendorCompanyName).toBe("Supplier");
  });
});

describe("NewVendor — mandatory field validation", () => {
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

  it("blocks submission when Vendor Name is missing", async () => {
    renderForm();

    await fillMandatoryFields({ vendorName: null });
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
    axios.post.mockResolvedValue({ data: { vendorId: 1 } });
    renderForm();

    await fillMandatoryFields();
    await submit();

    await waitFor(() => expect(axios.post).toHaveBeenCalled());
    expect(alertSpy).not.toHaveBeenCalled();
  });
});

describe("NewVendor — submission payload", () => {
  beforeEach(() => {
    axios.post.mockResolvedValue({ data: { vendorId: 1 } });
  });

  it("posts to the vendor onboarding endpoint", async () => {
    renderForm();

    await fillMandatoryFields();
    await submit();

    await waitFor(() =>
      expect(axios.post).toHaveBeenCalledWith(
        API_ENDPOINTS.saveOnBoardDetailsVendor,
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
      vendorName: "Sam Supplier",
      ein: "98-7654321",
      phone: "5559876543",
      emailId: "sam@supplier.test",
    });
  });

  it("defaults a brand new vendor's status to Pending, never Active", async () => {
    renderForm();

    await fillMandatoryFields();
    await submit();

    await waitFor(() => expect(axios.post).toHaveBeenCalled());
    expect(lastPostedBody().status).toBe("Pending");
  });

  it("sends the status the user picked instead of the default", async () => {
    renderForm();

    await fillMandatoryFields();
    await selectDropdownOption("Status", "Active");
    await submit();

    await waitFor(() => expect(axios.post).toHaveBeenCalled());
    expect(lastPostedBody().status).toBe("Active");
  });

  it("includes the vendor type the user picked", async () => {
    renderForm();

    await fillMandatoryFields();
    await selectDropdownOption("Vendor Type", "Staffing Firm");
    await submit();

    await waitFor(() => expect(axios.post).toHaveBeenCalled());
    expect(lastPostedBody().vendorType).toBe("Staffing Firm");
  });

  it("leaves the vendor type and payment terms null when the user picks neither", async () => {
    renderForm();

    await fillMandatoryFields();
    await submit();

    await waitFor(() => expect(axios.post).toHaveBeenCalled());
    expect(lastPostedBody().vendorType).toBeNull();
    expect(lastPostedBody().paymentTerms).toBeNull();
  });

  it("includes the separate address components the backend flattens", async () => {
    renderForm();

    await fillMandatoryFields();
    await userEvent.type(screen.getByPlaceholderText("Add address"), "500 Oak Ave");
    await userEvent.type(
      screen.getByPlaceholderText("Apt, suite, unit, etc. (optional)"),
      "Floor 2",
    );
    await userEvent.type(screen.getByPlaceholderText("city"), "Austin");
    await userEvent.type(screen.getByPlaceholderText("state"), "TX");
    await userEvent.type(screen.getByPlaceholderText("Enter Zip Code"), "73301");
    await submit();

    await waitFor(() => expect(axios.post).toHaveBeenCalled());
    expect(lastPostedBody()).toMatchObject({
      streetAddress: "500 Oak Ave",
      streetAddress2: "Floor 2",
      city: "Austin",
      state: "TX",
      zipCode: "73301",
    });
  });

  it("defaults the country to USA", async () => {
    renderForm();

    await fillMandatoryFields();
    await submit();

    await waitFor(() => expect(axios.post).toHaveBeenCalled());
    expect(lastPostedBody().country).toBe("USA");
  });

  it("defaults the start date to today in ISO form", async () => {
    renderForm();

    await fillMandatoryFields();
    await submit();

    await waitFor(() => expect(axios.post).toHaveBeenCalled());
    expect(lastPostedBody().startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("includes the payment policy free-text field", async () => {
    renderForm();

    await fillMandatoryFields();
    await userEvent.type(screen.getByPlaceholderText("Payment Policy"), "Pay on receipt");
    await submit();

    await waitFor(() => expect(axios.post).toHaveBeenCalled());
    expect(lastPostedBody().paymentPolicy).toBe("Pay on receipt");
  });
});

describe("NewVendor — submission outcome", () => {
  it("shows a success message when the save succeeds", async () => {
    axios.post.mockResolvedValue({ data: { vendorId: 1 } });
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

    await fillMandatoryFields({ vendorName: "Sam Supplier" });
    await submit();

    await screen.findByText("Error posting data. Please try again later.");
    expect(screen.getByPlaceholderText("Vendor Name")).toHaveValue("Sam Supplier");
  });
});
