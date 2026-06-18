export type TourStatus = "idle" | "navigating" | "waiting" | "running" | "not-found" | "done";

export interface TourState {
  status: TourStatus;
  index: number;
  /** Bumps on each navigation command; the hook keys its resolve effect on it. */
  token: number;
}

export type TourAction =
  | { type: "START"; index: number }
  | { type: "GOTO"; index: number }
  | { type: "NEXT" }
  | { type: "PREV" }
  | { type: "WAITING" }
  | { type: "ARRIVED" }
  | { type: "NOT_FOUND" }
  | { type: "STOP" };

export const FIRST_STEP = 0;

export function clampIndex(index: number, total: number): number {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(index, total - 1));
}

export function isLastStep(index: number, total: number): boolean {
  if (total <= 0) return false;
  return index >= total - 1;
}

/**
 * Pure transitions. START/GOTO/NEXT/PREV move the index, enter "navigating", and bump the
 * token so the hook runs exactly one resolve. WAITING/ARRIVED only change status. NEXT past
 * the last step ends the tour.
 */
export function tourReducer(state: TourState, action: TourAction, total: number): TourState {
  switch (action.type) {
    // START begins/resumes a tour; GOTO jumps within it. Same transition today.
    case "START":
    case "GOTO":
      return { status: "navigating", index: clampIndex(action.index, total), token: state.token + 1 };
    case "NEXT":
      return isLastStep(state.index, total)
        ? { status: "done", index: state.index, token: state.token }
        : { status: "navigating", index: state.index + 1, token: state.token + 1 };
    case "PREV":
      return {
        status: "navigating",
        index: Math.max(FIRST_STEP, state.index - 1),
        token: state.token + 1,
      };
    case "WAITING":
      return { ...state, status: "waiting" };
    case "ARRIVED":
      return { ...state, status: "running" };
    case "NOT_FOUND":
      return { ...state, status: "not-found" };
    case "STOP":
      return { ...state, status: "idle" };
    default:
      return state;
  }
}
