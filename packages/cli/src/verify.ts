import type { ElementLocator, StepProbe, StepResult, TourResult, TourStep, VerifyDriver, VerifyReport } from "./types";
import type { LoadedTour, TourLoadError } from "./tours";

/** One-line description of the signal a locator leads with, plus its disambiguators. */
export function describeLocator(locator: ElementLocator): string {
  const parts: string[] = [];
  if (locator.hook) {
    parts.push(`hook [${locator.hook.attr}="${locator.hook.value}"]`);
  } else if (locator.role) {
    parts.push(
      locator.role.name === undefined
        ? `role "${locator.role.role}"`
        : `role "${locator.role.role}" named "${locator.role.name}"`,
    );
  } else if (locator.text !== undefined) {
    parts.push(`text "${locator.text}"`);
  } else {
    parts.push(`tag <${locator.tag}>`);
  }
  if (locator.nth !== undefined) {
    parts.push(locator.nthOf === undefined ? `nth ${locator.nth}` : `nth ${locator.nth} of ${locator.nthOf}`);
  }
  if (locator.scope) parts.push(`scoped to <${locator.scope.tag}>`);
  return parts.join(", ");
}

/** Turn a page probe into a reportable result. Pure — the unit under test for status/reason. */
export function classifyStep(step: TourStep, index: number, probe: StepProbe): StepResult {
  const expected = describeLocator(step.locator);
  const base = { index, label: step.label, route: step.route, candidateCount: probe.candidateCount, expected };

  if (probe.error) {
    return { ...base, status: "error", reason: probe.error };
  }
  if (probe.found) {
    return { ...base, status: "ok" };
  }
  if (probe.revealMissing >= 0) {
    const missing = step.reveal?.[probe.revealMissing];
    return {
      ...base,
      status: "not-found",
      reason: `reveal ${probe.revealMissing} (${missing ? describeLocator(missing) : "unknown"}) could not be resolved, so the target was never revealed; expected ${expected}`,
    };
  }
  if (probe.candidateCount > 1 && step.locator.nth === undefined) {
    return {
      ...base,
      status: "ambiguous",
      reason: `expected ${expected} but ${probe.candidateCount} elements matched and the locator has no "nth" to disambiguate`,
    };
  }
  if (step.locator.nth !== undefined && step.locator.nthOf !== undefined && probe.candidateCount !== step.locator.nthOf) {
    return {
      ...base,
      status: "not-found",
      reason: `expected ${expected} but found ${probe.candidateCount} candidates; "nth" is only trusted while the candidate count is unchanged`,
    };
  }
  return {
    ...base,
    status: "not-found",
    reason: `expected ${expected}; found ${probe.candidateCount} candidate${probe.candidateCount === 1 ? "" : "s"}`,
  };
}

/** Roll per-tour results (and unparseable files) into the final report. */
export function buildReport(tours: TourResult[]): VerifyReport {
  let total = 0;
  let passed = 0;
  let failed = 0;
  for (const tour of tours) {
    if (tour.error) {
      total += 1;
      failed += 1;
      continue;
    }
    for (const step of tour.steps) {
      total += 1;
      if (step.status === "ok") passed += 1;
      else failed += 1;
    }
  }
  return { ok: failed === 0, tours, summary: { total, passed, failed } };
}

/** A failed run exits 1 so CI goes red; a clean run exits 0. */
export function exitCodeFor(report: VerifyReport): 0 | 1 {
  return report.ok ? 0 : 1;
}

/** Walk every step of every tour through the driver, in file then step order. */
export async function verifyTours(
  loaded: LoadedTour[],
  parseErrors: TourLoadError[],
  driver: VerifyDriver,
): Promise<VerifyReport> {
  const results: TourResult[] = [];

  for (const { tour, file } of loaded) {
    const steps: StepResult[] = [];
    for (let i = 0; i < tour.steps.length; i++) {
      const step = tour.steps[i]!;
      let probe: StepProbe;
      try {
        probe = await driver.checkStep(step);
      } catch (err) {
        probe = { found: false, matchedBy: null, candidateCount: 0, revealMissing: -1, error: (err as Error).message };
      }
      steps.push(classifyStep(step, i, probe));
    }
    results.push({ id: tour.id, name: tour.name, file, steps });
  }

  for (const bad of parseErrors) {
    results.push({ id: bad.file, name: bad.file, file: bad.file, steps: [], error: bad.error });
  }

  return buildReport(results);
}
