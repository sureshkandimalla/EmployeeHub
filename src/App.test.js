import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import App from "./App";

// Google's GSI widget needs a real browser (it injects a cross-origin
// iframe), so the sign-in button is replaced with a stand-in. Everything
// else — the router, the auth context, the protected-route guard — is the
// real thing.
jest.mock("@react-oauth/google", () => ({
  GoogleOAuthProvider: ({ children }) => children,
  GoogleLogin: () => <button type="button">Sign in with Google</button>,
  googleLogout: jest.fn(),
}));

// App mounts the whole route table, and several screens fetch on mount.
jest.mock("axios", () => ({
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
  interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
}));

// eslint-disable-next-line import/first
const axios = require("axios");

jest.setTimeout(30000);

beforeEach(() => {
  // Create React App's Jest preset sets resetMocks: true, which clears every
  // mock implementation between tests — so the default resolutions have to be
  // (re)installed per test rather than once in the module factory.
  axios.get.mockResolvedValue({ data: [] });
  axios.post.mockResolvedValue({ data: {} });
  axios.put.mockResolvedValue({ data: {} });
  axios.delete.mockResolvedValue({ data: {} });
});

afterEach(() => {
  localStorage.clear();
});

describe("App — unauthenticated entry point", () => {
  it("renders the sign-in screen when nothing is stored in localStorage", async () => {
    render(<App />);

    expect(await screen.findByRole("button", { name: "Sign in with Google" })).toBeInTheDocument();
  });

  it("renders the sign-in screen when the stored user has no token", async () => {
    localStorage.setItem("user", JSON.stringify({ email: "stale@example.com" }));

    render(<App />);

    expect(await screen.findByRole("button", { name: "Sign in with Google" })).toBeInTheDocument();
  });

  it("renders the sign-in screen when the stored user entry is not valid JSON", async () => {
    localStorage.setItem("user", "}{not json");

    render(<App />);

    expect(await screen.findByRole("button", { name: "Sign in with Google" })).toBeInTheDocument();
  });

  it("does not render any protected application chrome while signed out", async () => {
    render(<App />);

    await screen.findByRole("button", { name: "Sign in with Google" });
    expect(screen.queryByText("Export to Excel")).not.toBeInTheDocument();
  });
});

describe("App — authenticated entry point", () => {
  it("leaves the sign-in screen once a stored session carries a token", async () => {
    localStorage.setItem(
      "user",
      JSON.stringify({ email: "hr@example.com", role: "HR", token: "test-token" }),
    );

    render(<App />);

    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Sign in with Google" })).not.toBeInTheDocument(),
    );
  });
});
