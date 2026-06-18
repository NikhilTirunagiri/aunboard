import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LegendPanel } from "./legend";
import type { TourStep } from "../tour/types";

const steps: TourStep[] = [
  { locator: { tag: "table" }, label: "Cash-on-Cash", description: "Annual return" },
  { locator: { tag: "button" }, label: "Run Model", description: "Recalculate" },
];

describe("LegendPanel", () => {
  it("lists every step label", () => {
    render(<LegendPanel steps={steps} />);
    expect(screen.getByText("Cash-on-Cash")).toBeTruthy();
    expect(screen.getByText("Run Model")).toBeTruthy();
  });

  it("renders nothing when steps is empty", () => {
    const { container } = render(<LegendPanel steps={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when no steps prop is provided", () => {
    const { container } = render(<LegendPanel />);
    expect(container.firstChild).toBeNull();
  });
});
