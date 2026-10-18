import axios from "axios";
import { message } from "antd";
import { buildRowActions } from "./rowActions";
import API_ENDPOINTS from "../config";

jest.mock("axios");

// Archive and Delete destroy or hide business records. Only an admin may run
// them directly; everyone else files a request for approval. Getting this
// backwards either blocks every non-admin or lets anyone delete an employee.

const asRole = (role, extra = {}) =>
  localStorage.setItem("user", JSON.stringify({ role, ...extra }));

const buildFor = (overrides = {}) =>
  buildRowActions({
    onArchive: jest.fn(),
    onDelete: jest.fn(),
    entityType: "Employee",
    entityId: 42,
    entityLabel: "Ada Lovelace",
    ...overrides,
  });

beforeEach(() => {
  axios.post.mockResolvedValue({ data: {} });
  jest.spyOn(message, "success").mockImplementation(() => {});
  jest.spyOn(message, "error").mockImplementation(() => {});
});

afterEach(() => {
  localStorage.clear();
  jest.restoreAllMocks();
});

describe("buildRowActions — admin", () => {
  beforeEach(() => asRole("ADMIN"));

  it("offers Archive and Delete as direct actions", () => {
    const actions = buildFor();

    expect(actions.map((a) => a.label)).toEqual(["Archive", "Delete"]);
  });

  it("marks Delete as a dangerous action", () => {
    expect(buildFor().find((a) => a.key === "delete").danger).toBe(true);
  });

  it("wires Archive straight to the caller's handler", () => {
    const onArchive = jest.fn();

    buildFor({ onArchive }).find((a) => a.key === "archive").onClick();

    expect(onArchive).toHaveBeenCalled();
  });

  it("wires Delete straight to the caller's handler", () => {
    const onDelete = jest.fn();

    buildFor({ onDelete }).find((a) => a.key === "delete").onClick();

    expect(onDelete).toHaveBeenCalled();
  });

  it("does not file an approval request for a direct admin action", () => {
    buildFor().find((a) => a.key === "delete").onClick();

    expect(axios.post).not.toHaveBeenCalled();
  });

  it("appends any grid-specific extra actions after the shared two", () => {
    const actions = buildFor({ extra: [{ key: "custom", label: "Mark Billable" }] });

    expect(actions.map((a) => a.key)).toEqual(["archive", "delete", "custom"]);
  });
});

describe.each(["HR", "ACCOUNTING", "IMMIGRATION"])("buildRowActions — %s", (role) => {
  beforeEach(() => asRole(role));

  it("offers Request Archive and Request Delete instead of the direct actions", () => {
    expect(buildFor().map((a) => a.label)).toEqual(["Request Archive", "Request Delete"]);
  });

  it("never calls the caller's archive handler directly", () => {
    const onArchive = jest.fn();

    buildFor({ onArchive }).find((a) => a.key === "archive").onClick();

    expect(onArchive).not.toHaveBeenCalled();
  });

  it("never calls the caller's delete handler directly", () => {
    const onDelete = jest.fn();

    buildFor({ onDelete }).find((a) => a.key === "delete").onClick();

    expect(onDelete).not.toHaveBeenCalled();
  });
});

describe("buildRowActions — approval requests", () => {
  beforeEach(() => asRole("HR", { name: "Helen HR", email: "hr@example.com" }));

  it("files an ARCHIVE request identifying the row", async () => {
    buildFor().find((a) => a.key === "archive").onClick();

    expect(axios.post).toHaveBeenCalledWith(API_ENDPOINTS.createActionRequest, {
      type: "Employee",
      entityId: 42,
      entityLabel: "Ada Lovelace",
      action: "ARCHIVE",
      requestedBy: "Helen HR",
    });
  });

  it("files a DELETE request identifying the row", async () => {
    buildFor().find((a) => a.key === "delete").onClick();

    expect(axios.post).toHaveBeenCalledWith(
      API_ENDPOINTS.createActionRequest,
      expect.objectContaining({ action: "DELETE", entityId: 42 }),
    );
  });

  it("confirms to the user once the request has been filed", async () => {
    buildFor().find((a) => a.key === "archive").onClick();

    await Promise.resolve();
    expect(message.success).toHaveBeenCalledWith(
      "Archive request sent to an admin for approval",
    );
  });

  it("tells the user when filing the request fails", async () => {
    axios.post.mockRejectedValue(new Error("network down"));

    buildFor().find((a) => a.key === "delete").onClick();

    await Promise.resolve();
    await Promise.resolve();
    expect(message.error).toHaveBeenCalledWith("Failed to send the request. Please try again.");
  });

  it("falls back to the email address when the stored user has no name", async () => {
    localStorage.setItem("user", JSON.stringify({ role: "HR", email: "hr@example.com" }));

    buildFor().find((a) => a.key === "archive").onClick();

    expect(axios.post.mock.calls[0][1].requestedBy).toBe("hr@example.com");
  });

  it("falls back to Unknown when the stored user has neither a name nor an email", async () => {
    localStorage.setItem("user", JSON.stringify({ role: "HR" }));

    buildFor().find((a) => a.key === "archive").onClick();

    expect(axios.post.mock.calls[0][1].requestedBy).toBe("Unknown");
  });
});

describe("buildRowActions — no session", () => {
  it("treats a visitor with no stored user as a non-admin", () => {
    expect(buildFor().map((a) => a.label)).toEqual(["Request Archive", "Request Delete"]);
  });

  it("treats a corrupt stored user as a non-admin rather than throwing", () => {
    localStorage.setItem("user", "}{not json");

    expect(buildFor().map((a) => a.label)).toEqual(["Request Archive", "Request Delete"]);
  });

  it("treats a lower-case role of 'admin' as a non-admin (the check is exact)", () => {
    localStorage.setItem("user", JSON.stringify({ role: "admin" }));

    expect(buildFor().map((a) => a.label)).toEqual(["Request Archive", "Request Delete"]);
  });
});
