import { describe, it, expect } from "vitest";
import { computeBadgeRect } from "./position";

describe("computeBadgeRect", () => {
  const target = { top: 100, left: 200, width: 50, height: 20 } as DOMRect;

  it("places the badge at the top-left corner, offset out by half its size", () => {
    const b = computeBadgeRect(target, 18);
    expect(b).toEqual({ top: 100 - 9, left: 200 - 9, size: 18 });
  });

  it("never returns negative coordinates (clamps to viewport edge)", () => {
    const b = computeBadgeRect({ top: 2, left: 3, width: 10, height: 10 } as DOMRect, 18);
    expect(b.top).toBe(0);
    expect(b.left).toBe(0);
  });
});
