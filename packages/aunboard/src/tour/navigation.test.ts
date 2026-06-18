import { describe, it, expect, vi, afterEach } from "vitest";
import { resolveNavigate, needsNavigation, currentPath, defaultNavigate } from "./navigation";

afterEach(() => window.history.pushState({}, "", "/")); // pathname persists across tests in a file

describe("navigation adapter", () => {
  it("uses the supplied navigate when given", () => {
    const nav = vi.fn();
    resolveNavigate(nav)("/x");
    expect(nav).toHaveBeenCalledWith("/x");
  });

  it("falls back to the History API when none supplied", () => {
    const fn = resolveNavigate(undefined);
    fn("/dashboard");
    expect(window.location.pathname).toBe("/dashboard");
  });

  it("needsNavigation is true only when route differs from current", () => {
    expect(needsNavigation("/a", "/b")).toBe(true);
    expect(needsNavigation("/a", "/a")).toBe(false);
    expect(needsNavigation(undefined, "/a")).toBe(false);
    expect(needsNavigation("", "/a")).toBe(false);
  });

  it("defaultNavigate dispatches popstate", () => {
    const spy = vi.fn();
    window.addEventListener("popstate", spy);
    defaultNavigate("/again");
    window.removeEventListener("popstate", spy);
    expect(spy).toHaveBeenCalled();
    expect(currentPath()).toBe("/again");
  });
});
