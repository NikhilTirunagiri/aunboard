import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ModeSwitch } from "./mode-switch";
import { LabelModeContext, type LabelModeValue } from "./context";
import type { Tours } from "../tour/types";

afterEach(cleanup);

const tours: Tours = {
  onboard: {
    id: "onboard",
    name: "Onboarding",
    steps: [{ locator: { tag: "button" }, label: "A", description: "a" }],
  },
};

function ctx(overrides: Partial<LabelModeValue> = {}): LabelModeValue {
  return {
    mode: "off",
    setMode: vi.fn(),
    tours,
    activeTourId: "onboard",
    setActiveTourId: vi.fn(),
    ...overrides,
  };
}

function renderSwitch(value: LabelModeValue) {
  return render(
    <LabelModeContext.Provider value={value}>
      <ModeSwitch />
    </LabelModeContext.Provider>,
  );
}

describe("ModeSwitch", () => {
  it("sets mode when a segment is clicked", () => {
    const setMode = vi.fn();
    renderSwitch(ctx({ setMode }));
    fireEvent.click(screen.getByRole("button", { name: "Explore" }));
    expect(setMode).toHaveBeenCalledWith("explore");
  });

  it("hides the Walkthrough segment when there are no tours", () => {
    renderSwitch(ctx({ tours: {} }));
    expect(screen.queryByRole("button", { name: "Walkthrough" })).toBeNull();
  });

  it("marks the active mode pressed", () => {
    renderSwitch(ctx({ mode: "explore" }));
    expect(screen.getByRole("button", { name: "Explore" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("shows the tour picker with >1 tour in walkthrough mode and changes the active tour", () => {
    const setActiveTourId = vi.fn();
    const multi: Tours = {
      a: { id: "a", name: "Tour A", steps: [{ locator: { tag: "button" }, label: "X", description: "x" }] },
      b: { id: "b", name: "Tour B", steps: [{ locator: { tag: "button" }, label: "Y", description: "y" }] },
    };
    renderSwitch(ctx({ mode: "walkthrough", tours: multi, activeTourId: "a", setActiveTourId }));
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "b" } });
    expect(setActiveTourId).toHaveBeenCalledWith("b");
  });

  it("hides the tour picker with a single tour", () => {
    renderSwitch(ctx({ mode: "walkthrough" }));
    expect(screen.queryByRole("combobox")).toBeNull();
  });
});
