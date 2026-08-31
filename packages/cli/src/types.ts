import type { ElementLocator } from "../../aunboard/src/locator/types";
import type { Tour, TourStep } from "../../aunboard/src/tour/types";

export type { ElementLocator, Tour, TourStep };

/** Outcome of a single step check. */
export type StepStatus = "ok" | "not-found" | "ambiguous" | "error";

export interface StepResult {
  /** 0-based position of the step within its tour. */
  index: number;
  label: string;
  route?: string;
  status: StepStatus;
  /** Human explanation — always present for a failure, omitted for `ok`. */
  reason?: string;
  /** How many elements the locator's signals matched in the live page. */
  candidateCount: number;
  /** Which signal the locator expected to match on (hook / role+name / text / nth). */
  expected: string;
}

export interface TourResult {
  id: string;
  name: string;
  /** cwd-relative path of the tour file (used by the GitHub annotation reporter). */
  file: string;
  steps: StepResult[];
  /** Set when the file itself could not be parsed; `steps` is then empty. */
  error?: string;
}

export interface VerifyReport {
  ok: boolean;
  tours: TourResult[];
  summary: { total: number; passed: number; failed: number };
}

/** What the page tells us back about one step. Fully serializable across `page.evaluate`. */
export interface StepProbe {
  found: boolean;
  matchedBy: "hook" | "role" | "text" | null;
  candidateCount: number;
  /** Index of the first `reveal` locator that could not be resolved, or -1. */
  revealMissing: number;
  /** Set when the check could not run at all (navigation failure, missing bundle, ...). */
  error?: string;
}

/** A page driver. The real one wraps Playwright; tests substitute a fake. */
export interface VerifyDriver {
  checkStep(step: TourStep): Promise<StepProbe>;
  close(): Promise<void>;
}
