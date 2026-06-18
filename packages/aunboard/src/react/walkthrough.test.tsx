import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, waitFor, fireEvent, cleanup } from "@testing-library/react";
import { Walkthrough } from "./walkthrough";
import { LabelModeContext, type LabelModeValue } from "./context";
import type { Tours } from "../tour/types";

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
  localStorage.clear();
});

const tours: Tours = {
  onboard: {
    id: "onboard",
    name: "Onboarding",
    steps: [
      {
        locator: { tag: "button", role: { role: "button", name: "Run" } },
        label: "Run button",
        description: "Runs the model.",
      },
    ],
  },
};

function ctx(overrides: Partial<LabelModeValue> = {}): LabelModeValue {
  return {
    mode: "walkthrough",
    setMode: vi.fn(),
    tours,
    activeTourId: "onboard",
    setActiveTourId: vi.fn(),
    ...overrides,
  };
}

function renderWalkthrough(value: LabelModeValue) {
  return render(
    <LabelModeContext.Provider value={value}>
      <Walkthrough persist={false} />
    </LabelModeContext.Provider>,
  );
}

describe("Walkthrough", () => {
  it("spotlights the first step once its element exists — shows step.label + step.description + Step i of N", async () => {
    document.body.innerHTML = `<button>Run</button>`;
    renderWalkthrough(ctx());
    await waitFor(() => expect(screen.getByText("Run button")).toBeTruthy());
    expect(screen.getByText("Runs the model.")).toBeTruthy();
    expect(screen.getByText("Step 1 of 1")).toBeTruthy();
  });

  it("Close sets mode back to off", async () => {
    document.body.innerHTML = `<button>Run</button>`;
    const setMode = vi.fn();
    renderWalkthrough(ctx({ setMode }));
    await waitFor(() => expect(screen.getByText("Run button")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Close walkthrough" }));
    expect(setMode).toHaveBeenCalledWith("off");
  });

  it("renders nothing when there is no active tour", () => {
    const { container } = renderWalkthrough(ctx({ activeTourId: null }));
    expect(container.textContent).toBe("");
  });

  it("shows a not-found card when the step's element never appears", async () => {
    const missing: Tours = {
      onboard: {
        id: "onboard",
        name: "Onboarding",
        steps: [
          {
            locator: { tag: "button", role: { role: "button", name: "Ghost" } },
            label: "Ghost",
            description: "Nowhere to be found.",
          },
        ],
      },
    };
    render(
      <LabelModeContext.Provider value={ctx({ tours: missing })}>
        <Walkthrough persist={false} waitTimeout={20} />
      </LabelModeContext.Provider>,
    );
    await waitFor(() => expect(screen.getByText(/Couldn't find/)).toBeTruthy());
  });

  it("shows the done card after finishing the last step", async () => {
    document.body.innerHTML = `<button>Run</button>`;
    const single: Tours = {
      onboard: {
        id: "onboard",
        name: "Onboarding",
        steps: [
          {
            locator: { tag: "button", role: { role: "button", name: "Run" } },
            label: "Run button",
            description: "Runs the model.",
          },
        ],
      },
    };
    render(
      <LabelModeContext.Provider value={ctx({ tours: single })}>
        <Walkthrough persist={false} />
      </LabelModeContext.Provider>,
    );
    await waitFor(() => expect(screen.getByText("Run button")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Finish" }));
    await waitFor(() => expect(screen.getByText(/You finished/)).toBeTruthy());
  });
});
