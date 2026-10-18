// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import "@testing-library/jest-dom";

// ─── jsdom gaps the UI libraries this app uses depend on ────────────────────
// antd (Form/Row responsive observers, Select dropdowns) and AG Grid both
// reach for browser APIs jsdom doesn't implement. Shimming them once here
// keeps every test file from repeating the same boilerplate.

// antd's responsive observer calls window.matchMedia on mount.
if (!window.matchMedia) {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  });
}

// AG Grid and antd's rc-* internals observe element size.
if (!window.ResizeObserver) {
  window.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

if (!window.IntersectionObserver) {
  window.IntersectionObserver = class IntersectionObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  };
}

// antd Select scrolls the active option into view; AG Grid scrolls cells.
if (!window.HTMLElement.prototype.scrollIntoView) {
  window.HTMLElement.prototype.scrollIntoView = jest.fn();
}

// jsdom reports 0 for every layout measurement, so rc-virtual-list (behind
// antd's Select dropdown) never believes it has room to render real,
// clickable option rows, and AG Grid renders no viewport. Force non-zero
// dimensions so both behave like a real browser.
if (!Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetHeight")?.value) {
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
    configurable: true,
    value: 400,
  });
}
if (!Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetWidth")?.value) {
  Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
    configurable: true,
    value: 400,
  });
}

// jsdom has no clipboard API; AG Grid's copy support probes for it.
if (!navigator.clipboard) {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: jest.fn().mockResolvedValue(undefined) },
  });
}
