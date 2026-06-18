import { describe, it, expect, beforeEach } from "vitest";
import { loadRecording, saveRecording, clearRecording, recordingKey, downloadTour, parseImportedFile } from "./storage";
import { serializeTour } from "./artifact";
import type { Tour } from "../tour/types";

const tour: Tour = { id: "demo", name: "Demo", steps: [] };

beforeEach(() => localStorage.clear());

describe("recording storage", () => {
  it("returns null when nothing is stored", () => {
    expect(loadRecording("demo")).toBeNull();
  });
  it("saves and loads a recording by tour id", () => {
    saveRecording(tour);
    expect(loadRecording("demo")).toEqual(tour);
    expect(localStorage.getItem(recordingKey("demo"))).toBeTruthy();
  });
  it("clears a recording", () => {
    saveRecording(tour);
    clearRecording("demo");
    expect(loadRecording("demo")).toBeNull();
  });
  it("returns null (does not throw) on corrupt data", () => {
    localStorage.setItem(recordingKey("demo"), "{not json");
    expect(loadRecording("demo")).toBeNull();
  });
  it("downloadTour does not throw in a DOM", () => {
    expect(() => downloadTour(tour)).not.toThrow();
  });
  it("parseImportedFile round-trips an exported artifact", async () => {
    const file = new File([serializeTour(tour)], "demo.tour.json", { type: "application/json" });
    expect(await parseImportedFile(file)).toEqual(tour);
  });
});
