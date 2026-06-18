import { describe, it, expect, afterEach, vi } from "vitest";
import { act, render, screen, cleanup } from "@testing-library/react";
import { LabelModeProvider } from "./provider";
import type { Tours } from "../tour/types";

// Hoisted mock so Vitest intercepts the dynamic import("../record/index.js") in provider.tsx
vi.mock("../record/index", () => ({
  RecordController: ({ tour }: { tour: { id: string; name: string } }) => (
    <div data-testid="rc">{tour.id}</div>
  ),
}));

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

describe("LabelModeProvider – record mode", () => {
  it("dynamically mounts RecordController when mode is record", async () => {
    await act(async () => {
      render(
        <LabelModeProvider
          tours={tours}
          enabled
          defaultMode="record"
          record={{ tour: { id: "demo", name: "Demo" } }}
        >
          <div />
        </LabelModeProvider>,
      );
    });

    // Wait for the dynamic import to resolve and the component to mount
    const rc = await screen.findByTestId("rc");
    expect(rc).toBeTruthy();
    // Verify it received tour.id
    expect(rc.textContent).toBe("demo");
  });
});
