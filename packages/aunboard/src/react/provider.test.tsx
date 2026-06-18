import { describe, it, expect, afterEach, vi, beforeEach } from "vitest";
import { act, render, screen, fireEvent, cleanup } from "@testing-library/react";
import { LabelModeProvider } from "./provider";
import { useLabelMode } from "./context";
import type { Tours } from "../tour/types";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

const tours: Tours = {
  onboard: {
    id: "onboard",
    name: "Onboarding",
    steps: [{ locator: { tag: "button", role: { role: "button", name: "Run" } }, label: "Run", description: "Runs it." }],
  },
};

function Probe() {
  const { mode, setMode, activeTourId } = useLabelMode();
  return (
    <div>
      <span data-testid="mode">{mode}</span>
      <span data-testid="tour">{activeTourId}</span>
      <button onClick={() => setMode("explore")}>go-explore</button>
    </div>
  );
}

describe("LabelModeProvider", () => {
  it("renders children only (no overlay) when disabled", () => {
    render(
      <LabelModeProvider enabled={false}>
        <div>app</div>
      </LabelModeProvider>,
    );
    expect(screen.getByText("app")).toBeTruthy();
    expect(document.querySelector("[data-label-mode-overlay]")).toBeNull();
  });

  it("defaults the active tour to the first tour", () => {
    render(
      <LabelModeProvider tours={tours} enabled>
        <Probe />
      </LabelModeProvider>,
    );
    expect(screen.getByTestId("tour").textContent).toBe("onboard");
    expect(screen.getByTestId("mode").textContent).toBe("off");
  });

  it("switching to explore mounts the overlay when a tour with steps is provided", () => {
    document.body.innerHTML = "";
    render(
      <LabelModeProvider tours={tours} enabled>
        <Probe />
      </LabelModeProvider>,
    );
    // Put an element the locator can resolve
    const btn = document.createElement("button");
    btn.setAttribute("aria-label", "Run");
    document.body.appendChild(btn);
    fireEvent.click(screen.getByText("go-explore"));
    expect(document.querySelector("[data-label-mode-overlay]")).not.toBeNull();
  });

  it("throws on an invalid tour (missing locator) at startup", () => {
    const bad: Tours = {
      x: {
        id: "x",
        name: "X",
        // @ts-expect-error intentionally testing runtime validation
        steps: [{ label: "Ghost", description: "No locator." }],
      },
    };
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() =>
      render(
        <LabelModeProvider tours={bad} enabled>
          <div>app</div>
        </LabelModeProvider>,
      ),
    ).toThrow(/missing a valid locator/);
    spy.mockRestore();
  });

  it("defaultMode='explore' mounts the overlay on first render when tours have steps", async () => {
    const btn = document.createElement("button");
    btn.setAttribute("aria-label", "Run");
    document.body.appendChild(btn);
    await act(async () => {
      render(
        <LabelModeProvider tours={tours} enabled defaultMode="explore">
          <div />
        </LabelModeProvider>,
      );
    });
    expect(document.querySelector("[data-label-mode-overlay]")).not.toBeNull();
  });

  it("does not activate via the shortcut when disabled", () => {
    render(
      <LabelModeProvider enabled={false}>
        <div>app</div>
      </LabelModeProvider>,
    );
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "/", metaKey: true }));
    expect(document.querySelector("[data-label-mode-overlay]")).toBeNull();
  });

  it("throws when defaultTourId is not present in tours", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() =>
      render(
        <LabelModeProvider tours={tours} defaultTourId="nope" enabled>
          <div>app</div>
        </LabelModeProvider>,
      ),
    ).toThrow(/defaultTourId "nope" is not present/);
    spy.mockRestore();
  });

  it("walkthrough renders the first recording step when tours={} (record-first flow)", async () => {
    const { saveRecording } = await import("../record/storage");

    // Save a recording with a step whose locator resolves to a real DOM button.
    saveRecording({
      id: "rec-tour",
      name: "Recorded Tour",
      steps: [
        {
          locator: { tag: "button", role: { role: "button", name: "Launch" } },
          label: "Launch button",
          description: "Click to launch the app.",
        },
      ],
    });

    // Put the element the locator resolves to in the DOM.
    const btn = document.createElement("button");
    btn.setAttribute("aria-label", "Launch");
    document.body.appendChild(btn);

    render(
      <LabelModeProvider
        tours={{}}
        enabled
        defaultMode="walkthrough"
        record={{ tour: { id: "rec-tour", name: "Recorded Tour" } }}
      >
        <div />
      </LabelModeProvider>,
    );

    // The walkthrough should eventually start and show the step label/narration.
    // activeTourId must be adopted from liveTours once the recording effect resolves.
    expect(await screen.findByText("Launch button")).toBeTruthy();
  });

  it("a localStorage recording wins over static tour steps in Explore", async () => {
    const { saveRecording } = await import("../record/storage");

    // Static tour has a step labelled "Placeholder"
    const staticTours: Tours = {
      demo: {
        id: "demo",
        name: "Demo",
        steps: [
          {
            locator: { tag: "button", role: { role: "button", name: "Placeholder" } },
            label: "Placeholder",
            description: "Should be overridden by recording.",
          },
        ],
      },
    };

    // localStorage recording for the same tour id has a step labelled "Recorded"
    saveRecording({
      id: "demo",
      name: "Demo",
      steps: [
        {
          locator: { tag: "button", role: { role: "button", name: "Recorded" } },
          label: "Recorded",
          description: "From the recording.",
        },
      ],
    });

    // Put the element that "Recorded" resolves to in the DOM
    const btn = document.createElement("button");
    btn.setAttribute("aria-label", "Recorded");
    document.body.appendChild(btn);

    render(
      <LabelModeProvider tours={staticTours} enabled defaultMode="explore">
        <div />
      </LabelModeProvider>,
    );

    // The localStorage recording wins: badge shows "Recorded", not "Placeholder"
    expect(screen.getByText("Recorded")).toBeTruthy();
    expect(screen.queryByText("Placeholder")).toBeNull();
  });

});
