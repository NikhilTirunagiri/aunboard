import type { Tour } from "../tour/types";
import { serializeTour, parseTour } from "./artifact";

export const recordingKey = (tourId: string) => `lm:recording:${tourId}`;

function storage(): Storage | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadRecording(tourId: string): Tour | null {
  const s = storage();
  if (!s) return null;
  try {
    // getItem itself can throw SecurityError (Safari private mode, sandboxed iframes),
    // so it must be inside the try, not just parseTour.
    const raw = s.getItem(recordingKey(tourId));
    if (!raw) return null;
    return parseTour(raw);
  } catch {
    return null;
  }
}

export function saveRecording(tour: Tour): void {
  const s = storage();
  if (!s) return;
  try {
    s.setItem(recordingKey(tour.id), serializeTour(tour));
  } catch {
    /* quota / disabled — caller can still export */
  }
}

export function clearRecording(tourId: string): void {
  storage()?.removeItem(recordingKey(tourId));
}

/** Trigger a browser download of the tour as `<id>.tour.json`. No-op without a DOM. */
export function downloadTour(tour: Tour): void {
  if (typeof document === "undefined") return;
  try {
    const blob = new Blob([serializeTour(tour)], { type: "application/json" });
    const url =
      typeof URL !== "undefined" && typeof URL.createObjectURL === "function"
        ? URL.createObjectURL(blob)
        : `data:application/json;charset=utf-8,${encodeURIComponent(serializeTour(tour))}`;
    const a = document.createElement("a");
    a.href = url;
    a.download = `${tour.id}.tour.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Defer the revoke: revoking the object URL synchronously right after click() can cancel
    // the in-flight download in some browsers. A macrotask later is safe.
    if (url.startsWith("blob:") && typeof URL !== "undefined" && typeof URL.revokeObjectURL === "function") {
      setTimeout(() => URL.revokeObjectURL(url), 0);
    }
  } catch {
    /* no-op if DOM APIs are unavailable */
  }
}

/** Parse a user-selected .tour.json File into a Tour (throws on malformed). */
export function parseImportedFile(file: File): Promise<Tour> {
  // `File.prototype.text()` is not available in all jsdom versions; fall back to FileReader.
  if (typeof file.text === "function") {
    return file.text().then(parseTour);
  }
  return new Promise<Tour>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve(parseTour(reader.result as string));
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}
