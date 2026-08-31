/**
 * The test that makes the committed tour real.
 *
 * It renders the actual app into jsdom, one route at a time, and resolves every step's
 * locator with aunboard's own `resolveLocator`. A step that no longer finds exactly one
 * element fails here — the same failure CI produces when it replays the tour against a
 * real build with `aunboard verify`, just cheaper and closer to the change.
 */
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { resolveLocator, type Tour, type TourStep } from "aunboard";
import artifact from "../tours/demo.tour.json";
import { tours } from "../src/aunboard.tours";
import { Demo } from "../src/Demo";

const tour = artifact.tour as Tour;
const routeOf = (step: TourStep) => step.route ?? "/";
const routes = [...new Set(tour.steps.map(routeOf))];

function mountAt(route: string) {
  window.history.pushState(null, "", route);
  render(<Demo />);
}

afterEach(cleanup);

describe("committed demo tour artifact", () => {
  it("uses the version 1 envelope", () => {
    expect(artifact.version).toBe(1);
    expect(tour.id).toBe("demo");
    expect(tour.name).toBe("Product Demo");
  });

  it("is the tour the app actually ships", () => {
    expect(tours.demo).toBe(tour);
  });

  it("covers every route in the app", () => {
    expect(routes.sort()).toEqual(["/", "/projects", "/settings"]);
  });

  it("only uses durable locators — accessible role + name, never an index", () => {
    for (const step of tour.steps) {
      expect(step.locator.role?.role, `step "${step.label}" has no role`).toBeTruthy();
      expect(step.locator.role?.name, `step "${step.label}" has no accessible name`).toBeTruthy();
      expect(step.locator.nth, `step "${step.label}" leans on a positional index`).toBeUndefined();
      expect(step.label.length).toBeGreaterThan(0);
      expect(step.description.length).toBeGreaterThan(0);
    }
  });
});

describe.each(routes)("steps on route %s", (route) => {
  const steps = tour.steps.filter((step) => routeOf(step) === route);

  it.each(steps.map((step) => [step.label, step] as const))(
    "step %s resolves to exactly one element",
    (_label, step) => {
      mountAt(route);

      const result = resolveLocator(step.locator);

      expect(result.candidateCount, `${step.label}: ambiguous or missing`).toBe(1);
      expect(result.element, `${step.label}: no element found`).not.toBeNull();
      expect(result.matchedBy).toBe("role");
      expect(result.element!.tagName.toLowerCase()).toBe(step.locator.tag);
    },
  );
});
