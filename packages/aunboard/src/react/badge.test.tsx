import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Badge } from "./badge";

const element = document.createElement("button");

describe("Badge", () => {
  it("renders the index number and exposes the label as aria-label", () => {
    render(<Badge index={1} element={element} label="Cash-on-Cash" description="Annual return" rect={{ top: 10, left: 10, size: 18 }} />);
    expect(screen.getByText("1")).toBeTruthy();
    expect(screen.getByRole("button").getAttribute("aria-label")).toContain("Cash-on-Cash");
  });

  it("reveals the description on hover", () => {
    render(<Badge index={1} element={element} label="Cash-on-Cash" description="Annual return on invested cash" rect={{ top: 10, left: 10, size: 18 }} />);
    fireEvent.mouseEnter(screen.getByRole("button"));
    expect(screen.getByText("Annual return on invested cash")).toBeTruthy();
  });

  it("shows the label prominently in the tooltip", () => {
    render(<Badge index={1} element={element} label="Run Model" description="Recalculates the model." rect={{ top: 0, left: 0, size: 18 }} />);
    fireEvent.mouseEnter(screen.getByRole("button"));
    expect(screen.getAllByText("Run Model").length).toBeGreaterThan(0);
  });
});
