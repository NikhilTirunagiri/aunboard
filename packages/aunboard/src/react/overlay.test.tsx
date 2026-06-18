import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, screen } from "@testing-library/react";
import { Overlay } from "./overlay";
import type { Tour } from "../tour/types";

afterEach(() => { cleanup(); document.body.innerHTML = ""; });

const tour: Tour = {
  id: "demo", name: "Demo",
  steps: [
    { locator: { tag: "button", role: { role: "button", name: "Run" } }, label: "Run", description: "Runs it." },
    { locator: { tag: "table", role: { role: "table", name: "Returns" } }, label: "Returns", description: "Per-year cash." },
  ],
};

it("renders one badge per resolvable step on the current page", () => {
  document.body.innerHTML = `<button aria-label="Run">x</button><table aria-label="Returns"><tbody><tr><td>1</td></tr></tbody></table>`;
  render(<Overlay tour={tour} />);
  expect(screen.getByText("Run")).toBeTruthy();
  expect(screen.getByText("Returns")).toBeTruthy();
});

it("skips steps whose element is not on the page (no crash)", () => {
  document.body.innerHTML = `<button aria-label="Run">x</button>`;
  render(<Overlay tour={tour} />);
  expect(screen.getByText("Run")).toBeTruthy();
  expect(screen.queryByText("Returns")).toBeNull();
});

it("renders nothing when tour is null", () => {
  render(<Overlay tour={null} />);
  expect(document.querySelector("[data-label-mode-overlay]")).toBeNull();
});

it("renders nothing when tour has no steps", () => {
  render(<Overlay tour={{ id: "empty", name: "Empty", steps: [] }} />);
  expect(document.querySelector("[data-label-mode-overlay]")).toBeNull();
});
