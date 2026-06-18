import type { Tour, TourStep } from "../tour/types";

export type Session = Tour;

export type SessionAction =
  | { type: "ADD"; step: TourStep }
  | { type: "REMOVE"; index: number }
  | { type: "MOVE"; from: number; to: number }
  | { type: "EDIT"; index: number; patch: Partial<TourStep> }
  | { type: "LOAD"; session: Session };

export function emptySession(id: string, name: string): Session {
  return { id, name, steps: [] };
}

export function sessionReducer(state: Session, action: SessionAction): Session {
  switch (action.type) {
    case "ADD":
      return { ...state, steps: [...state.steps, action.step] };
    case "REMOVE":
      return { ...state, steps: state.steps.filter((_, i) => i !== action.index) };
    case "MOVE": {
      const steps = [...state.steps];
      const [moved] = steps.splice(action.from, 1);
      if (moved) steps.splice(action.to, 0, moved);
      return { ...state, steps };
    }
    case "EDIT":
      return {
        ...state,
        steps: state.steps.map((s, i) => (i === action.index ? { ...s, ...action.patch } : s)),
      };
    case "LOAD":
      return action.session;
    default:
      return state;
  }
}
