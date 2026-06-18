import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { StepList } from "./step-list";
import type { Session } from "./session";

afterEach(() => { cleanup(); });

const makeSession = (...labels: string[]): Session => ({
  id: "demo",
  name: "Demo",
  steps: labels.map((label) => ({ locator: { tag: "button" }, label, description: `${label} desc` })),
});

describe("StepList", () => {
  it("renders Steps: N count and all step labels", () => {
    render(
      <StepList
        session={makeSession("Alpha", "Beta")}
        armed={false}
        onToggleArm={vi.fn()}
        onRemove={vi.fn()}
        onMove={vi.fn()}
        onExport={vi.fn()}
      />,
    );
    expect(screen.getByText("Steps: 2")).toBeTruthy();
    expect(screen.getByText("Alpha")).toBeTruthy();
    expect(screen.getByText("Beta")).toBeTruthy();
  });

  it("calls onRemove with the correct index when ✕ is clicked", () => {
    const onRemove = vi.fn();
    render(
      <StepList
        session={makeSession("Alpha", "Beta")}
        armed={false}
        onToggleArm={vi.fn()}
        onRemove={onRemove}
        onMove={vi.fn()}
        onExport={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /remove step 1/i }));
    expect(onRemove).toHaveBeenCalledWith(0);
  });

  it("calls onMove when ↑ is clicked on a non-first step", () => {
    const onMove = vi.fn();
    render(
      <StepList
        session={makeSession("Alpha", "Beta")}
        armed={false}
        onToggleArm={vi.fn()}
        onRemove={vi.fn()}
        onMove={onMove}
        onExport={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /move step 2 up/i }));
    expect(onMove).toHaveBeenCalledWith(1, 0);
  });

  it("shows the Pick element toggle and responds to arm state", () => {
    const onToggleArm = vi.fn();
    render(
      <StepList
        session={makeSession()}
        armed={false}
        onToggleArm={onToggleArm}
        onRemove={vi.fn()}
        onMove={vi.fn()}
        onExport={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: /pick element/i })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /pick element/i }));
    expect(onToggleArm).toHaveBeenCalled();
  });

  it("shows Picking text when armed", () => {
    render(
      <StepList
        session={makeSession()}
        armed={true}
        onToggleArm={vi.fn()}
        onRemove={vi.fn()}
        onMove={vi.fn()}
        onExport={vi.fn()}
      />,
    );
    expect(screen.getByText(/picking/i)).toBeTruthy();
  });

  it("marks fragile/weak steps with a ⚠ but not stable ones", () => {
    const session: Session = {
      id: "demo",
      name: "Demo",
      steps: [
        { locator: { tag: "div", hook: { attr: "data-explain", value: "k" } }, label: "Stable", description: "" },
        { locator: { tag: "input", nth: 0, nthOf: 37 }, label: "Fragile", description: "" },
      ],
    };
    render(
      <StepList session={session} armed={false} onToggleArm={vi.fn()} onRemove={vi.fn()} onMove={vi.fn()} onExport={vi.fn()} />,
    );
    // Exactly one warning marker, on the fragile step.
    const warnings = screen.getAllByTitle(/position|name|text|stable/i);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].getAttribute("title")).toMatch(/1 of 37/);
  });

  it("calls onExport when Download JSON is clicked", () => {
    const onExport = vi.fn();
    render(
      <StepList
        session={makeSession()}
        armed={false}
        onToggleArm={vi.fn()}
        onRemove={vi.fn()}
        onMove={vi.fn()}
        onExport={onExport}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /download json/i }));
    expect(onExport).toHaveBeenCalled();
  });
});
