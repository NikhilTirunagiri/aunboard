import { describe, expect, it, vi } from "vitest";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCli } from "./run";
import type { StepProbe, VerifyDriver } from "./types";

const found: StepProbe = { found: true, matchedBy: "hook", candidateCount: 1, revealMissing: -1 };
const missing: StepProbe = { found: false, matchedBy: null, candidateCount: 0, revealMissing: -1 };

function workspace(files: Record<string, unknown> = {}): string {
  const dir = mkdtempSync(join(tmpdir(), "aunboard-run-"));
  mkdirSync(join(dir, "tours"));
  const tour = {
    version: 1,
    tour: {
      id: "new-engineer",
      name: "New Engineer Onboarding",
      steps: [
        {
          locator: { tag: "button", hook: { attr: "data-tour-id", value: "save" } },
          label: "Save",
          description: "Saves the form.",
          route: "/settings",
        },
      ],
    },
  };
  writeFileSync(join(dir, "tours", "new-engineer.tour.json"), JSON.stringify(files.tour ?? tour));
  return dir;
}

/** A stand-in for the Playwright driver — no browser is launched in unit tests. */
function fakeDriver(probe: StepProbe): VerifyDriver & { close: ReturnType<typeof vi.fn> } {
  return { checkStep: vi.fn(async () => probe), close: vi.fn(async () => {}) };
}

function harness(cwd: string, driver: VerifyDriver) {
  const out: string[] = [];
  const err: string[] = [];
  return {
    out,
    err,
    deps: {
      cwd,
      createDriver: vi.fn(async () => driver),
      stdout: (line: string) => out.push(line),
      stderr: (line: string) => err.push(line),
    },
  };
}

describe("runCli", () => {
  it("exits 0 and prints a pretty report when every step resolves", async () => {
    const cwd = workspace();
    const driver = fakeDriver(found);
    const h = harness(cwd, driver);

    const code = await runCli(["verify", "--url", "http://localhost:3000"], h.deps);

    expect(code).toBe(0);
    expect(h.out.join("\n")).toContain("All tour steps resolved.");
    expect(driver.close).toHaveBeenCalled();
  });

  it("exits 1 when a step no longer resolves", async () => {
    const h = harness(workspace(), fakeDriver(missing));
    const code = await runCli(["verify", "--url", "http://localhost:3000"], h.deps);
    expect(code).toBe(1);
    expect(h.out.join("\n")).toContain("NOT FOUND");
  });

  it("emits parseable JSON with --json", async () => {
    const h = harness(workspace(), fakeDriver(missing));
    const code = await runCli(["verify", "--url", "http://localhost:3000", "--json"], h.deps);
    expect(code).toBe(1);
    const parsed = JSON.parse(h.out.join("\n"));
    expect(parsed).toMatchObject({ ok: false, summary: { total: 1, passed: 0, failed: 1 } });
    expect(parsed.tours[0].steps[0].status).toBe("not-found");
  });

  it("emits GitHub annotations with --reporter github", async () => {
    const h = harness(workspace(), fakeDriver(missing));
    await runCli(["verify", "--url", "http://localhost:3000", "--reporter", "github"], h.deps);
    expect(h.out.join("\n")).toMatch(/^::error file=tours\/new-engineer\.tour\.json/);
  });

  it("exits 1 with a clear message when a tour file cannot be parsed", async () => {
    const cwd = workspace();
    writeFileSync(join(cwd, "tours", "broken.tour.json"), JSON.stringify({ version: 2, tour: {} }));
    const h = harness(cwd, fakeDriver(found));

    const code = await runCli(["verify", "--url", "http://localhost:3000"], h.deps);

    expect(code).toBe(1);
    expect(h.out.join("\n")).toContain("unsupported artifact version 2");
  });

  it("exits 1 without launching a browser when no tour files match", async () => {
    const h = harness(workspace(), fakeDriver(found));
    const code = await runCli(["verify", "--url", "http://localhost:3000", "--tours", "nope/*.tour.json"], h.deps);
    expect(code).toBe(1);
    expect(h.err.join("\n")).toContain("no tour files matched");
    expect(h.deps.createDriver).not.toHaveBeenCalled();
  });

  it("exits 1 with the install instructions when the driver cannot start", async () => {
    const cwd = workspace();
    const h = harness(cwd, fakeDriver(found));
    h.deps.createDriver = vi.fn(async () => {
      throw new Error("aunboard: Playwright is required to verify tours but was not found.");
    });

    const code = await runCli(["verify", "--url", "http://localhost:3000"], h.deps);

    expect(code).toBe(1);
    expect(h.err.join("\n")).toContain("Playwright is required");
  });

  it("prints help and exits 0", async () => {
    const h = harness(workspace(), fakeDriver(found));
    expect(await runCli(["verify", "--help"], h.deps)).toBe(0);
    expect(h.out.join("\n")).toContain("aunboard verify --url <url>");
  });

  it("prints the package version and exits 0", async () => {
    const h = harness(workspace(), fakeDriver(found));
    expect(await runCli(["--version"], h.deps)).toBe(0);
    expect(h.out.join("\n")).toMatch(/^\d+\.\d+\.\d+/);
  });

  it("prints the error plus help and exits 1 on bad arguments", async () => {
    const h = harness(workspace(), fakeDriver(found));
    expect(await runCli(["verify"], h.deps)).toBe(1);
    expect(h.err.join("\n")).toContain("--url is required");
    expect(h.err.join("\n")).toContain("Usage");
  });
});
