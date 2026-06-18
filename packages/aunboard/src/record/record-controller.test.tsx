import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import { RecordController } from "./record-controller";

afterEach(() => { cleanup(); document.body.innerHTML = ""; localStorage.clear(); });

function setup() {
  document.body.innerHTML = `<main><button id="run">Run projection</button></main>`;
  render(<RecordController tour={{ id: "demo", name: "Demo" }} currentRoute={() => "/dash"} />);
}

/**
 * Note on jsdom limitation: inline `onclick="..."` attributes are NOT evaluated by
 * jsdom when set via innerHTML (jsdom disables JavaScript in HTML attribute event
 * handlers for security). We use addEventListener instead, which DOES work, and
 * captures the same behavioral requirement: "host handler runs on plain click".
 */
describe("RecordController", () => {
  it("Alt+click picks an element and opens the narration card", () => {
    setup();
    fireEvent.click(document.getElementById("run")!, { altKey: true });
    expect(screen.getByPlaceholderText(/label/i)).toBeTruthy();
  });

  it("plain clicks pass through so the host app stays navigable (not picking)", () => {
    document.body.innerHTML = `<main><button id="run">Run</button></main>`;
    render(<RecordController tour={{ id: "demo", name: "Demo" }} currentRoute={() => "/dash"} />);
    // Use addEventListener (not inline onclick) — jsdom does not eval inline attribute handlers
    const btn = document.getElementById("run")!;
    let fired = false;
    btn.addEventListener("click", () => { fired = true; });
    fireEvent.mouseDown(btn);
    fireEvent.click(btn);
    expect(fired).toBe(true);  // app handler DID run — you can navigate
    expect(screen.queryByPlaceholderText(/label/i)).toBeNull(); // nothing picked
  });

  it("while armed, the host control is suppressed on mousedown (never activates)", () => {
    document.body.innerHTML = `<main><button id="run">Run</button></main>`;
    render(<RecordController tour={{ id: "demo", name: "Demo" }} currentRoute={() => "/dash"} />);
    // Use addEventListener — jsdom does not eval inline attribute handlers
    const btn = document.getElementById("run")!;
    let fired = false;
    btn.addEventListener("click", () => { fired = true; });
    fireEvent.click(screen.getByRole("button", { name: /pick element/i })); // arm
    fireEvent.mouseDown(btn);
    fireEvent.click(btn);
    expect(fired).toBe(false); // app handler never ran while picking
  });

  it("auto-disarms after a pick (next plain click works again)", () => {
    document.body.innerHTML = `<main><button id="run">Run</button></main>`;
    render(<RecordController tour={{ id: "demo", name: "Demo" }} currentRoute={() => "/dash"} />);
    fireEvent.click(screen.getByRole("button", { name: /pick element/i })); // arm
    fireEvent.click(document.getElementById("run")!);                       // pick → disarms
    expect(screen.getByPlaceholderText(/label/i)).toBeTruthy();
  });

  const byText = (text: string) =>
    [...document.querySelectorAll("button")].find((b) => b.textContent === text)!;
  const savedSteps = () => JSON.parse(localStorage.getItem("lm:recording:demo")!).tour.steps;

  it("captures a same-page pass-through click as a reveal for the next pick", () => {
    document.body.innerHTML = `<main><button>Cash Flow</button><button>Run</button></main>`;
    render(<RecordController tour={{ id: "demo", name: "Demo" }} currentRoute={() => "/dash"} />);
    fireEvent.click(byText("Cash Flow"));                 // plain pass-through click (navigate)
    fireEvent.click(byText("Run"), { altKey: true });    // Alt-pick the target
    const card = screen.getByRole("dialog", { name: /label this element/i });
    expect(within(card).getByText("Cash Flow")).toBeTruthy();     // reveal chip in the card
    expect(within(card).getByRole("button", { name: /remove reveal 1/i })).toBeTruthy();
  });

  it("persists the captured reveal onto the saved step", () => {
    document.body.innerHTML = `<main><button>Cash Flow</button><button>Run</button></main>`;
    render(<RecordController tour={{ id: "demo", name: "Demo" }} currentRoute={() => "/dash"} />);
    fireEvent.click(byText("Cash Flow"));
    fireEvent.click(byText("Run"), { altKey: true });
    fireEvent.change(screen.getByPlaceholderText(/label/i), { target: { value: "Run" } });
    fireEvent.click(screen.getByRole("button", { name: /save step/i }));
    expect(savedSteps()[0].reveal).toHaveLength(1);
    expect(savedSteps()[0].reveal[0].role.name).toBe("Cash Flow");
  });

  it("a removed reveal chip is not saved", () => {
    document.body.innerHTML = `<main><button>Cash Flow</button><button>Run</button></main>`;
    render(<RecordController tour={{ id: "demo", name: "Demo" }} currentRoute={() => "/dash"} />);
    fireEvent.click(byText("Cash Flow"));
    fireEvent.click(byText("Run"), { altKey: true });
    const card = screen.getByRole("dialog", { name: /label this element/i });
    fireEvent.click(within(card).getByRole("button", { name: /remove reveal 1/i }));
    fireEvent.change(screen.getByPlaceholderText(/label/i), { target: { value: "Run" } });
    fireEvent.click(screen.getByRole("button", { name: /save step/i }));
    expect(savedSteps()[0].reveal).toBeUndefined();
  });

  it("saving a step adds it to the list and persists to localStorage", () => {
    setup();
    fireEvent.click(document.getElementById("run")!, { altKey: true });
    fireEvent.change(screen.getByPlaceholderText(/label/i), { target: { value: "Run" } });
    fireEvent.change(screen.getByPlaceholderText(/description/i), { target: { value: "Runs the model." } });
    fireEvent.click(screen.getByRole("button", { name: /save step/i }));
    expect(screen.getByText("Run")).toBeTruthy();
    expect(localStorage.getItem("lm:recording:demo")).toContain("Run");
  });
});
