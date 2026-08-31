import { describe, expect, it } from "vitest";
import { render, renderGithub, renderJson, renderPretty } from "./report";
import type { VerifyReport } from "./types";

const ctx = { url: "http://localhost:3000" };

const passing: VerifyReport = {
  ok: true,
  tours: [
    {
      id: "new-engineer",
      name: "New Engineer Onboarding",
      file: "tours/new-engineer.tour.json",
      steps: [
        { index: 0, label: "Dashboard", route: "/dashboard", status: "ok", candidateCount: 1, expected: 'hook [data-tour-id="dash"]' },
        { index: 1, label: "Save", route: "/settings", status: "ok", candidateCount: 1, expected: 'role "button" named "Save"' },
      ],
    },
  ],
  summary: { total: 2, passed: 2, failed: 0 },
};

const failing: VerifyReport = {
  ok: false,
  tours: [
    {
      id: "new-engineer",
      name: "New Engineer Onboarding",
      file: "tours/new-engineer.tour.json",
      steps: [
        { index: 0, label: "Dashboard", route: "/dashboard", status: "ok", candidateCount: 1, expected: 'hook [data-tour-id="dash"]' },
        {
          index: 1,
          label: "Save",
          route: "/settings",
          status: "not-found",
          candidateCount: 0,
          expected: 'hook [data-tour-id="save"]',
          reason: 'expected hook [data-tour-id="save"]; found 0 candidates',
        },
        {
          index: 2,
          label: "Row",
          status: "ambiguous",
          candidateCount: 4,
          expected: 'text "Row"',
          reason: 'expected text "Row" but 4 elements matched and the locator has no "nth" to disambiguate',
        },
      ],
    },
    { id: "tours/bad.tour.json", name: "tours/bad.tour.json", file: "tours/bad.tour.json", steps: [], error: "aunboard: unsupported artifact version 2." },
  ],
  summary: { total: 4, passed: 1, failed: 3 },
};

describe("renderPretty", () => {
  it("shows the url, each step and a green summary", () => {
    const out = renderPretty(passing, ctx);
    expect(out).toContain("aunboard verify — http://localhost:3000");
    expect(out).toContain("new-engineer — New Engineer Onboarding  (tours/new-engineer.tour.json)");
    expect(out).toContain("OK        1. Dashboard  /dashboard");
    expect(out).toContain("1 tour, 2 steps: 2 passed, 0 failed");
    expect(out).toContain("All tour steps resolved.");
    expect(out).not.toContain("NOT FOUND");
  });

  it("shows status, reason and candidate count for failures", () => {
    const out = renderPretty(failing, ctx);
    expect(out).toContain("NOT FOUND 2. Save  /settings");
    expect(out).toContain('expected hook [data-tour-id="save"]; found 0 candidates');
    expect(out).toContain("AMBIGUOUS 3. Row");
    expect(out).toContain("candidates found: 4");
    expect(out).toContain("ERROR     aunboard: unsupported artifact version 2.");
    expect(out).toContain("2 tours, 4 steps: 1 passed, 3 failed");
    expect(out).toContain("Some tour steps no longer resolve.");
  });
});

describe("renderJson", () => {
  it("emits the documented machine-readable shape", () => {
    const parsed = JSON.parse(renderJson(failing));
    expect(parsed.ok).toBe(false);
    expect(parsed.summary).toEqual({ total: 4, passed: 1, failed: 3 });
    expect(parsed.tours[0].id).toBe("new-engineer");
    expect(parsed.tours[0].name).toBe("New Engineer Onboarding");
    expect(parsed.tours[0].steps[1]).toMatchObject({
      index: 1,
      label: "Save",
      route: "/settings",
      status: "not-found",
      candidateCount: 0,
    });
    expect(parsed.tours[0].steps[1].reason).toMatch(/found 0 candidates/);
    expect(parsed.tours[1].error).toMatch(/unsupported artifact version 2/);
  });

  it("is valid JSON for a passing run and reports ok: true", () => {
    const parsed = JSON.parse(renderJson(passing));
    expect(parsed.ok).toBe(true);
    expect(parsed.tours[0].steps.every((s: { status: string }) => s.status === "ok")).toBe(true);
  });
});

describe("renderGithub", () => {
  it("annotates only failures, one workflow command per line", () => {
    const lines = renderGithub(failing).split("\n");
    expect(lines).toHaveLength(4); // 2 failed steps + 1 unparseable file + summary
    expect(lines[0]).toMatch(/^::error file=tours\/new-engineer\.tour\.json,title=aunboard tour "new-engineer" step 2::/);
    expect(lines[0]).toContain("NOT FOUND");
    expect(lines[0]).toContain("on route /settings");
    expect(lines[0]).toContain("[candidates: 0]");
    expect(lines[1]).toContain("AMBIGUOUS");
    expect(lines[2]).toBe("::error file=tours/bad.tour.json::aunboard: unsupported artifact version 2.");
    expect(lines[3]).toBe("::error::aunboard verify: 3 of 4 tour steps failed to resolve.");
  });

  it("emits a single notice when everything passes", () => {
    expect(renderGithub(passing)).toBe("::notice::aunboard verify: 2/2 tour steps resolved.");
  });

  it("escapes newlines and percent signs in annotation data", () => {
    const out = renderGithub({
      ok: false,
      tours: [{ id: "t", name: "T", file: "t.json", steps: [], error: "line one\nline 50% two" }],
      summary: { total: 1, passed: 0, failed: 1 },
    });
    expect(out.split("\n")[0]).toBe("::error file=t.json::line one%0Aline 50%25 two");
  });
});

describe("render", () => {
  it("dispatches by reporter name and defaults to pretty", () => {
    expect(render("json", passing, ctx)).toBe(renderJson(passing));
    expect(render("github", passing, ctx)).toBe(renderGithub(passing));
    expect(render("pretty", passing, ctx)).toBe(renderPretty(passing, ctx));
  });
});
