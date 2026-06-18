import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { OverlayCard } from "./overlay-card";

afterEach(() => { cleanup(); document.body.innerHTML = ""; });

function makeAnchor(): HTMLElement {
  document.body.innerHTML = `<button id="anchor">Run</button>`;
  return document.getElementById("anchor")!;
}

describe("OverlayCard", () => {
  it("renders label and description inputs", () => {
    const anchor = makeAnchor();
    render(<OverlayCard anchor={anchor} onSave={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByPlaceholderText(/label/i)).toBeTruthy();
    expect(screen.getByPlaceholderText(/description/i)).toBeTruthy();
  });

  it("calls onSave with typed values when Save step is clicked", () => {
    const anchor = makeAnchor();
    const onSave = vi.fn();
    render(<OverlayCard anchor={anchor} onSave={onSave} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/label/i), { target: { value: "Run" } });
    fireEvent.change(screen.getByPlaceholderText(/description/i), { target: { value: "Runs the model." } });
    fireEvent.click(screen.getByRole("button", { name: /save step/i }));
    expect(onSave).toHaveBeenCalledWith("Run", "Runs the model.");
  });

  it("does not call onSave when label is empty", () => {
    const anchor = makeAnchor();
    const onSave = vi.fn();
    render(<OverlayCard anchor={anchor} onSave={onSave} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /save step/i }));
    expect(onSave).not.toHaveBeenCalled();
  });

  it("calls onCancel when Cancel is clicked", () => {
    const anchor = makeAnchor();
    const onCancel = vi.fn();
    render(<OverlayCard anchor={anchor} onSave={vi.fn()} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalled();
  });

  it("shows a fragility warning when the locator is not stable", () => {
    const anchor = makeAnchor();
    render(
      <OverlayCard
        anchor={anchor}
        onSave={vi.fn()}
        onCancel={vi.fn()}
        durability={{ tier: "fragile", reason: "Matched by position (1 of 37)." }}
      />,
    );
    expect(screen.getByRole("note")).toBeTruthy();
    expect(screen.getByText(/position \(1 of 37\)/i)).toBeTruthy();
  });

  it("shows no warning when the locator is stable", () => {
    const anchor = makeAnchor();
    render(
      <OverlayCard
        anchor={anchor}
        onSave={vi.fn()}
        onCancel={vi.fn()}
        durability={{ tier: "stable", reason: "Durable." }}
      />,
    );
    expect(screen.queryByRole("note")).toBeNull();
  });
});
