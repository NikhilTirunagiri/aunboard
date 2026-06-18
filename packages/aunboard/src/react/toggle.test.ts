import { describe, it, expect, vi } from "vitest";
import { nextMode, installModeShortcut } from "./toggle";
import type { LabelMode } from "./context";

describe("nextMode", () => {
  it("cycles off -> explore -> walkthrough -> off when tours exist", () => {
    expect(nextMode("off", true)).toBe("explore");
    expect(nextMode("explore", true)).toBe("walkthrough");
    expect(nextMode("walkthrough", true)).toBe("off");
  });

  it("skips walkthrough when there are no tours", () => {
    expect(nextMode("explore", false)).toBe("off");
  });
});

describe("installModeShortcut", () => {
  it("cycles mode on Cmd/Ctrl+/ and uninstalls cleanly", () => {
    let mode: LabelMode = "off";
    const setMode = (u: (p: LabelMode) => LabelMode) => {
      mode = u(mode);
    };
    const uninstall = installModeShortcut(setMode, () => true);
    const fire = () =>
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "/", metaKey: true }));
    fire();
    expect(mode).toBe("explore");
    fire();
    expect(mode).toBe("walkthrough");
    uninstall();
    fire();
    expect(mode).toBe("walkthrough"); // no longer listening
  });

  it("also responds to Ctrl+/", () => {
    let mode: LabelMode = "off";
    const setMode = (u: (p: LabelMode) => LabelMode) => {
      mode = u(mode);
    };
    const uninstall = installModeShortcut(setMode, () => true);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "/", ctrlKey: true }));
    expect(mode).toBe("explore");
    uninstall();
  });
});

describe('"record" is NOT in the keyboard cycle', () => {
  it("nextMode never produces 'record' from any input", () => {
    const allInputs: LabelMode[] = ["off", "explore", "walkthrough", "record"];
    for (const m of allInputs) {
      expect(nextMode(m, true)).not.toBe("record");
      expect(nextMode(m, false)).not.toBe("record");
    }
  });

  it("keyboard shortcut starting from 'record' falls back to off (not record)", () => {
    let mode: LabelMode = "record";
    const setMode = (u: (p: LabelMode) => LabelMode) => {
      mode = u(mode);
    };
    const uninstall = installModeShortcut(setMode, () => true);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "/", metaKey: true }));
    // "record" is not in the cycle — falling through nextMode("record", ...) gives "off"
    expect(mode).toBe("off");
    uninstall();
  });

  it("full cycle off -> explore -> walkthrough -> off never touches record", () => {
    const steps: LabelMode[] = [];
    let mode: LabelMode = "off";
    const setMode = (u: (p: LabelMode) => LabelMode) => {
      mode = u(mode);
      steps.push(mode);
    };
    const uninstall = installModeShortcut(setMode, () => true);
    const fire = () =>
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "/", metaKey: true }));
    fire(); // off -> explore
    fire(); // explore -> walkthrough
    fire(); // walkthrough -> off
    uninstall();
    expect(steps).toEqual(["explore", "walkthrough", "off"]);
    expect(steps).not.toContain("record");
  });
});
