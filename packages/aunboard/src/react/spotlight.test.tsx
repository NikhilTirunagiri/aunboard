import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { Spotlight } from "./spotlight";

afterEach(cleanup);

const baseProps = {
  rect: { top: 100, left: 100, width: 200, height: 50 },
  title: "Cash-on-Cash table",
  narration: "Year-by-year returns.",
  index: 0,
  total: 3,
  isLast: false,
  canPrev: false,
  onPrev: () => {},
  onNext: () => {},
  onClose: () => {},
};

describe("Spotlight", () => {
  it("shows the title, narration and step counter", () => {
    render(<Spotlight {...baseProps} />);
    expect(screen.getByText("Cash-on-Cash table")).toBeTruthy();
    expect(screen.getByText("Year-by-year returns.")).toBeTruthy();
    expect(screen.getByText("Step 1 of 3")).toBeTruthy();
  });

  it("disables Back on the first step", () => {
    render(<Spotlight {...baseProps} canPrev={false} />);
    expect((screen.getByRole("button", { name: "Back" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("labels the final step's primary action Finish", () => {
    render(<Spotlight {...baseProps} isLast index={2} canPrev />);
    expect(screen.getByRole("button", { name: "Finish" })).toBeTruthy();
  });

  it("wires Next and Close", () => {
    const onNext = vi.fn();
    const onClose = vi.fn();
    render(<Spotlight {...baseProps} onNext={onNext} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Close walkthrough" }));
    expect(onNext).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("wires Back when canPrev is true", () => {
    const onPrev = vi.fn();
    render(<Spotlight {...baseProps} canPrev onPrev={onPrev} />);
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(onPrev).toHaveBeenCalled();
  });
});
