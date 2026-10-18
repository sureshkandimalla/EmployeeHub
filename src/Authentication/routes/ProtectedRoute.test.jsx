import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./ProtectedRoute";

// This is the client-side "don't even render the page" gate. If it lets an
// unauthenticated visitor through, a protected screen renders (and starts
// firing API calls) before the backend ever rejects them.

const renderAt = (initialPath) =>
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/" element={<div>Login page</div>} />
        <Route
          path="/secret"
          element={
            <ProtectedRoute>
              <div>Protected content</div>
            </ProtectedRoute>
          }
        />
      </Routes>
    </MemoryRouter>,
  );

afterEach(() => {
  localStorage.clear();
});

describe("ProtectedRoute", () => {
  it("renders the protected page when the stored session carries a token", () => {
    localStorage.setItem("user", JSON.stringify({ email: "hr@example.com", token: "abc" }));

    renderAt("/secret");

    expect(screen.getByText("Protected content")).toBeInTheDocument();
  });

  it("redirects to the login page when nothing is stored", () => {
    renderAt("/secret");

    expect(screen.getByText("Login page")).toBeInTheDocument();
    expect(screen.queryByText("Protected content")).not.toBeInTheDocument();
  });

  it("redirects to the login page when the stored session has no token", () => {
    localStorage.setItem("user", JSON.stringify({ email: "hr@example.com", role: "HR" }));

    renderAt("/secret");

    expect(screen.getByText("Login page")).toBeInTheDocument();
    expect(screen.queryByText("Protected content")).not.toBeInTheDocument();
  });

  it("redirects to the login page when the stored token is an empty string", () => {
    localStorage.setItem("user", JSON.stringify({ email: "hr@example.com", token: "" }));

    renderAt("/secret");

    expect(screen.getByText("Login page")).toBeInTheDocument();
  });

  it("redirects to the login page when the stored entry is not valid JSON", () => {
    localStorage.setItem("user", "}{not json");

    renderAt("/secret");

    expect(screen.getByText("Login page")).toBeInTheDocument();
    expect(screen.queryByText("Protected content")).not.toBeInTheDocument();
  });

  it("redirects to the login page when the stored entry is the literal string null", () => {
    localStorage.setItem("user", "null");

    renderAt("/secret");

    expect(screen.getByText("Login page")).toBeInTheDocument();
  });

  it("does not require a role, only a token — role gating happens elsewhere", () => {
    localStorage.setItem("user", JSON.stringify({ email: "nobody@example.com", token: "abc" }));

    renderAt("/secret");

    expect(screen.getByText("Protected content")).toBeInTheDocument();
  });
});
