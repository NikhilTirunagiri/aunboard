import { describe, expect, it, vi } from "vitest";
import type { LoadedTour } from "./tours";
import type { StepProbe, TourStep, VerifyDriver } from "./types";
import { buildReport, classifyStep, describeLocator, exitCodeFor, verifyTours } from "./verify";

const ok: StepProbe = { found: true, matchedBy: "hook", candidateCount: 1, revealMissing: -1 };
const gone: StepProbe = { found: false, matchedBy: null, candidateCount: 0, revealMissing: -1 };

function step(over: Partial<TourStep> = {}): TourStep {
  return {
    locator: { tag: "button", hook: { attr: "data-tour-id", value: "save" } },
    label: "Save",
    description: "Saves the form.",
    route: "/settings",
    ...over,
  };
}

describe("describeLocator", () => {
  it("leads with the hook", () => {
    expect(describeLocator({ tag: "button", hook: { attr: "data-tour-id", value: "save" }, text: "Save" })).toBe(
      'hook [data-tour-id="save"]',
    );
  });
  it("falls back to role + accessible name, then text, then tag", () => {
    expect(describeLocator({ tag: "button", role: { role: "button", name: "Save" } })).toBe('role "button" named "Save"');
    expect(describeLocator({ tag: "button", role: { role: "button" } })).toBe('role "button"');
    expect(describeLocator({ tag: "span", text: "Save" })).toBe('text "Save"');
    expect(describeLocator({ tag: "div" })).toBe("tag <div>");
  });
  it("appends nth and scope", () => {
    expect(describeLocator({ tag: "li", text: "Row", nth: 2, nthOf: 5, scope: { tag: "ul" } })).toBe(
      'text "Row", nth 2 of 5, scoped to <ul>',
    );
  });
});

describe("classifyStep", () => {
  it("marks a resolved step ok with no reason", () => {
    const result = classifyStep(step(), 0, ok);
    expect(result).toMatchObject({ index: 0, label: "Save", route: "/settings", status: "ok", candidateCount: 1 });
    expect(result.reason).toBeUndefined();
  });

  it("marks a vanished element not-found and names the expected signal", () => {
    const result = classifyStep(step(), 3, gone);
    expect(result.status).toBe("not-found");
    expect(result.expected).toBe('hook [data-tour-id="save"]');
    expect(result.reason).toMatch(/expected hook \[data-tour-id="save"\]; found 0 candidates/);
  });

  it("marks multiple matches with no nth as ambiguous", () => {
    const result = classifyStep(step({ locator: { tag: "button", text: "Save" } }), 0, {
      ...gone,
      candidateCount: 3,
    });
    expect(result.status).toBe("ambiguous");
    expect(result.candidateCount).toBe(3);
    expect(result.reason).toMatch(/3 elements matched and the locator has no "nth"/);
  });

  it("explains an nth whose candidate count changed", () => {
    const result = classifyStep(step({ locator: { tag: "li", text: "Row", nth: 2, nthOf: 5 } }), 0, {
      ...gone,
      candidateCount: 4,
    });
    expect(result.status).toBe("not-found");
    expect(result.reason).toMatch(/"nth" is only trusted while the candidate count is unchanged/);
  });

  it("blames the reveal locator when the reveal pass failed", () => {
    const result = classifyStep(step({ reveal: [{ tag: "button", role: { role: "button", name: "Advanced" } }] }), 0, {
      ...gone,
      revealMissing: 0,
    });
    expect(result.status).toBe("not-found");
    expect(result.reason).toMatch(/reveal 0 \(role "button" named "Advanced"\) could not be resolved/);
  });

  it("surfaces a driver error as status error", () => {
    const result = classifyStep(step(), 0, { ...gone, error: "could not navigate to /settings" });
    expect(result).toMatchObject({ status: "error", reason: "could not navigate to /settings" });
  });
});

describe("buildReport / exitCodeFor", () => {
  it("counts passes and failures and exits 0 when clean", () => {
    const report = buildReport([
      {
        id: "t",
        name: "T",
        file: "tours/t.tour.json",
        steps: [
          { index: 0, label: "a", status: "ok", candidateCount: 1, expected: "x" },
          { index: 1, label: "b", status: "ok", candidateCount: 1, expected: "x" },
        ],
      },
    ]);
    expect(report).toMatchObject({ ok: true, summary: { total: 2, passed: 2, failed: 0 } });
    expect(exitCodeFor(report)).toBe(0);
  });

  it("exits 1 when any step failed", () => {
    const report = buildReport([
      {
        id: "t",
        name: "T",
        file: "tours/t.tour.json",
        steps: [
          { index: 0, label: "a", status: "ok", candidateCount: 1, expected: "x" },
          { index: 1, label: "b", status: "not-found", candidateCount: 0, expected: "x", reason: "gone" },
        ],
      },
    ]);
    expect(report).toMatchObject({ ok: false, summary: { total: 2, passed: 1, failed: 1 } });
    expect(exitCodeFor(report)).toBe(1);
  });

  it("counts an unparseable tour file as one failure", () => {
    const report = buildReport([{ id: "bad", name: "bad", file: "tours/bad.tour.json", steps: [], error: "boom" }]);
    expect(report).toMatchObject({ ok: false, summary: { total: 1, passed: 0, failed: 1 } });
    expect(exitCodeFor(report)).toBe(1);
  });
});

describe("verifyTours", () => {
  function loaded(steps: TourStep[]): LoadedTour[] {
    return [
      {
        path: "/abs/tours/t.tour.json",
        file: "tours/t.tour.json",
        tour: { id: "t", name: "T", steps },
      },
    ];
  }

  it("walks every step through the driver in order", async () => {
    const checkStep = vi.fn(async (_step: TourStep) => ok);
    const driver: VerifyDriver = { checkStep, close: vi.fn(async () => {}) };

    const report = await verifyTours(loaded([step({ label: "one" }), step({ label: "two" })]), [], driver);

    expect(checkStep).toHaveBeenCalledTimes(2);
    expect(checkStep.mock.calls.map((c) => c[0].label)).toEqual(["one", "two"]);
    expect(report.ok).toBe(true);
    expect(report.tours[0]).toMatchObject({ id: "t", name: "T", file: "tours/t.tour.json" });
  });

  it("turns a thrown driver error into an error step rather than crashing", async () => {
    const driver: VerifyDriver = {
      checkStep: vi.fn(async () => {
        throw new Error("browser crashed");
      }),
      close: vi.fn(async () => {}),
    };

    const report = await verifyTours(loaded([step()]), [], driver);

    expect(report.ok).toBe(false);
    expect(report.tours[0]!.steps[0]).toMatchObject({ status: "error", reason: "browser crashed" });
  });

  it("includes unparseable files as failed tours", async () => {
    const driver: VerifyDriver = { checkStep: vi.fn(async () => ok), close: vi.fn(async () => {}) };
    const report = await verifyTours(
      loaded([step()]),
      [{ path: "/abs/tours/bad.tour.json", file: "tours/bad.tour.json", error: "aunboard: unsupported artifact version 2" }],
      driver,
    );
    expect(report.summary).toEqual({ total: 2, passed: 1, failed: 1 });
    expect(report.tours[1]!.error).toMatch(/unsupported artifact version 2/);
  });
});
