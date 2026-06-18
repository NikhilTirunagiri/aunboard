export interface TourProgress {
  /** Index of the step the user was last on. */
  stepIndex: number;
  /** True once the user reached the end. */
  completed: boolean;
}

const PREFIX = "label-mode:tour:";

function storage(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null; // access can throw in some privacy modes
  }
}

export function loadProgress(tourId: string): TourProgress | null {
  const ls = storage();
  if (!ls) return null;
  try {
    const raw = ls.getItem(PREFIX + tourId);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TourProgress;
    if (typeof parsed?.stepIndex !== "number" || typeof parsed?.completed !== "boolean") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveProgress(tourId: string, progress: TourProgress): void {
  const ls = storage();
  if (!ls) return;
  try {
    ls.setItem(PREFIX + tourId, JSON.stringify(progress));
  } catch {
    /* storage full or blocked — progress is best-effort */
  }
}

export function clearProgress(tourId: string): void {
  const ls = storage();
  if (!ls) return;
  try {
    ls.removeItem(PREFIX + tourId);
  } catch {
    /* ignore */
  }
}
