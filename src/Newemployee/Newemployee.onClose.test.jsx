import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import axios from "axios";
import Newemployee from "./Newemployee";
import API_ENDPOINTS from "../config";

jest.mock("axios");

jest.setTimeout(30000);

// This assertion lives in its own file on purpose. antd's *static* modals
// (Modal.success/Modal.error) mount a separate React 18 root on
// document.body; once React Testing Library has torn down a previous test's
// tree in the same file, a statically-mounted modal created afterwards still
// renders but its React event handlers no longer fire under jsdom, so
// clicking OK does nothing. Keeping this the only test in its file means the
// modal under test is always the first static modal of the run, where the OK
// button behaves. (Environment limitation, not an application defect — the
// text-only assertions in Newemployee.test.jsx cover the rest.)

describe("Newemployee — success acknowledgement", () => {
  it("notifies the parent to close the drawer when the user acknowledges the success message", async () => {
    axios.get.mockResolvedValue({ data: [] });
    axios.post.mockResolvedValue({ data: { employeeId: 1 } });
    const onClose = jest.fn();

    render(<Newemployee onClose={onClose} />);
    await waitFor(() => expect(axios.get).toHaveBeenCalledWith(API_ENDPOINTS.getAllVendors));

    await userEvent.type(screen.getByPlaceholderText("First Name"), "Ada");
    await userEvent.type(screen.getByPlaceholderText("Last Name"), "Lovelace");
    await userEvent.type(screen.getByPlaceholderText("Designation"), "Engineer");
    await userEvent.type(screen.getByPlaceholderText("ssn"), "123-45-6789");
    await userEvent.type(screen.getByPlaceholderText("you@company.com"), "ada@example.com");
    await userEvent.type(screen.getByPlaceholderText("+1 (555) 000-000"), "5551234567");
    await userEvent.type(screen.getByPlaceholderText("Enter Zip Code"), "75001");
    await userEvent.click(screen.getByRole("radio", { name: "Female" }));

    const companyCombo = screen.getByRole("combobox", { name: "Company" });
    await userEvent.click(companyCombo);
    await waitFor(() => expect(companyCombo).toHaveAttribute("aria-expanded", "true"));
    const listboxId = companyCombo.getAttribute("aria-controls");
    let optionList = null;
    await waitFor(() => {
      optionList = document.getElementById(listboxId)?.parentElement ?? null;
      expect(optionList).not.toBeNull();
    });
    await userEvent.click(
      await within(optionList).findByTitle("Intellan Technologies LLC"),
    );

    await userEvent.click(screen.getByRole("button", { name: "Submit" }));

    const successMessage = await screen.findByText("Data saved successfully");
    const modal = successMessage.closest(".ant-modal-confirm");
    await userEvent.click(within(modal).getByRole("button", { name: "OK" }));

    await waitFor(() => expect(onClose).toHaveBeenCalledWith("submit"));
  });
});
