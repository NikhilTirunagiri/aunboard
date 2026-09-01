import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { AunboardProvider } from "./provider";
import { useAunboard, useAunboardOptional } from "./context";
import type { Tours } from "../tour/types";

afterEach(() => { document.body.innerHTML = ""; vi.restoreAllMocks(); });

const tours: Tours = {
  demo: { id: "demo", name: "Demo", steps: [{ locator: { tag: "button" }, label: "A", description: "a" }] },
};

function Trigger() {
  const { enabled, setMode } = useAunboard();
  return <button disabled={!enabled} onClick={() => setMode("walkthrough")}>Start tour</button>;
}

describe("showModeSwitch", () => {
  it("renders the built-in switcher by default", () => {
    render(<AunboardProvider tours={tours} enabled><div /></AunboardProvider>);
    expect(screen.queryByRole("button", { name: /explore/i })).toBeTruthy();
  });

  it("renders no floating control when disabled", () => {
    // A product build drives the tour from its own UI; a permanent pill is not acceptable.
    render(<AunboardProvider tours={tours} enabled showModeSwitch={false}><div /></AunboardProvider>);
    expect(screen.queryByRole("button", { name: /explore/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /walkthrough/i })).toBeNull();
  });
});

describe("context when the overlay is switched off", () => {
  it("still provides context, so a trigger in shared UI does not crash", () => {
    // Previously an inactive provider rendered bare children, so useAunboard() threw for
    // every consumer — a tour button could not live in a shared component.
    expect(() =>
      render(<AunboardProvider tours={tours} enabled={false}><Trigger /></AunboardProvider>),
    ).not.toThrow();
    const btn = screen.getByRole("button", { name: "Start tour" }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("reports enabled:true when the overlay is on", () => {
    render(<AunboardProvider tours={tours} enabled><Trigger /></AunboardProvider>);
    expect((screen.getByRole("button", { name: "Start tour" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("setMode is inert while disabled", () => {
    render(<AunboardProvider tours={tours} enabled={false}><Trigger /></AunboardProvider>);
    screen.getByRole("button", { name: "Start tour" }).click();
    expect(document.querySelector("[data-aunboard-overlay]")).toBeNull();
  });
});

describe("useAunboardOptional", () => {
  it("returns null with no provider instead of throwing", () => {
    function Probe() {
      const ctx = useAunboardOptional();
      return <span>{ctx === null ? "no provider" : "provider"}</span>;
    }
    render(<Probe />);
    expect(screen.getByText("no provider")).toBeTruthy();
  });

  it("still throws for useAunboard with no provider — that is a wiring bug, not a state", () => {
    function Probe() { useAunboard(); return null; }
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow(/must be used inside/);
  });
});

describe("defaultTourId while tours load asynchronously", () => {
  it("does not throw when tours are still empty", () => {
    // A tours map built from a query is {} for the first render or two. Throwing here
    // white-screened every page until the data arrived.
    expect(() =>
      render(<AunboardProvider tours={{}} enabled defaultTourId="demo"><div /></AunboardProvider>),
    ).not.toThrow();
  });

  it("does not throw when the id is genuinely absent, and warns instead", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(() =>
      render(<AunboardProvider tours={tours} enabled defaultTourId="nope"><div /></AunboardProvider>),
    ).not.toThrow();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('defaultTourId "nope"'));
  });

  it("adopts the tour once it arrives", () => {
    const { rerender } = render(
      <AunboardProvider tours={{}} enabled defaultTourId="demo"><div /></AunboardProvider>,
    );
    rerender(<AunboardProvider tours={tours} enabled defaultTourId="demo"><div /></AunboardProvider>);
    expect(screen.queryByRole("button", { name: /walkthrough/i })).toBeTruthy();
  });
});
