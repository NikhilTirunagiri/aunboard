import { describe, expect, it } from "vitest";

import { discoverElements } from "../src/discover";
import { isCleanReport, rematchIds, summarizeReport } from "../src/rematch";
import { elementKey, type ElementInfo, type IdMap } from "../src/types";

/** Build an id map straight from a first "build" of the given files. */
function seed(files: Record<string, string>): { map: IdMap; discovered: ElementInfo[] } {
  const discovered = discover(files);
  const { map } = rematchIds({ version: 1, ids: {} }, discovered);
  return { map, discovered };
}

function discover(files: Record<string, string>): ElementInfo[] {
  return Object.entries(files).flatMap(([file, code]) => discoverElements(code, file));
}

const CARD = `
  export function PricingCard() {
    return (
      <div className="card">
        <button onClick={buy}>Buy now</button>
      </div>
    );
  }
`;

describe("rematchIds: first run", () => {
  it("mints an id for every discovered element", () => {
    const { map } = seed({ "src/Pricing.tsx": CARD });
    expect(Object.keys(map.ids).sort()).toEqual(["PricingCard.b1", "PricingCard.d1"]);
    expect(map.ids["PricingCard.b1"]).toMatchObject({
      file: "src/Pricing.tsx",
      component: "PricingCard",
      tag: "button",
    });
    expect(map.ids["PricingCard.b1"].sig).toMatch(/^[0-9a-f]{6}$/);
  });

  it("reports them as added", () => {
    const { report } = rematchIds({ version: 1, ids: {} }, discover({ "src/Pricing.tsx": CARD }));
    expect(report.added).toEqual(["PricingCard.b1", "PricingCard.d1"]);
    expect(report.kept).toEqual([]);
    expect(isCleanReport(report)).toBe(false);
  });

  it("can be told not to add new ids", () => {
    const { map, report } = rematchIds(
      { version: 1, ids: {} },
      discover({ "src/Pricing.tsx": CARD }),
      { addNew: false },
    );
    expect(map.ids).toEqual({});
    expect(report.added).toEqual([]);
  });

  it("writes a sorted, versioned map", () => {
    const { map } = seed({ "src/Pricing.tsx": CARD });
    expect(map.version).toBe(1);
    expect(Object.keys(map.ids)).toEqual([...Object.keys(map.ids)].sort());
  });
});

describe("rematchIds: kept", () => {
  it("keeps every id when nothing changed", () => {
    const { map } = seed({ "src/Pricing.tsx": CARD });
    const { report, map: next } = rematchIds(map, discover({ "src/Pricing.tsx": CARD }));
    expect(report.kept).toEqual(["PricingCard.b1", "PricingCard.d1"]);
    expect(report.missing).toEqual([]);
    expect(report.added).toEqual([]);
    expect(isCleanReport(report)).toBe(true);
    expect(next.ids).toEqual(map.ids);
  });

  it("keeps ids across reformatting", () => {
    const { map } = seed({ "src/Pricing.tsx": CARD });
    const reformatted = `
      // a new comment
      const unrelated = 1;

      export function PricingCard() {
        return <div className="card"><button onClick={buy}>Buy   now</button></div>;
      }
    `;
    const { report } = rematchIds(map, discover({ "src/Pricing.tsx": reformatted }));
    expect(report.kept).toEqual(["PricingCard.b1", "PricingCard.d1"]);
    expect(report.missing).toEqual([]);
  });

  it("keeps ids after the element is already stamped", () => {
    const { map } = seed({ "src/Pricing.tsx": CARD });
    const stamped = CARD.replace("<button", '<button data-aun="PricingCard.b1"');
    const { report } = rematchIds(map, discover({ "src/Pricing.tsx": stamped }));
    expect(report.kept).toContain("PricingCard.b1");
    expect(report.missing).toEqual([]);
  });
});

describe("rematchIds: moved file", () => {
  it("keeps the id and updates the file", () => {
    const { map } = seed({ "src/Pricing.tsx": CARD });
    const { map: next, report } = rematchIds(map, discover({ "src/billing/Card.tsx": CARD }));

    expect(report.moved).toEqual([
      { id: "PricingCard.b1", from: "src/Pricing.tsx", to: "src/billing/Card.tsx" },
      { id: "PricingCard.d1", from: "src/Pricing.tsx", to: "src/billing/Card.tsx" },
    ]);
    expect(report.missing).toEqual([]);
    expect(report.added).toEqual([]);
    expect(next.ids["PricingCard.b1"].file).toBe("src/billing/Card.tsx");
    expect(next.ids["PricingCard.b1"].sig).toBe(map.ids["PricingCard.b1"].sig);
  });

  it("prefers an untouched copy in the original file over a moved one", () => {
    const { map } = seed({ "src/Pricing.tsx": CARD });
    const { report } = rematchIds(
      map,
      discover({ "src/Pricing.tsx": CARD, "src/Copy.tsx": CARD }),
    );
    expect(report.kept).toEqual(["PricingCard.b1", "PricingCard.d1"]);
    expect(report.moved).toEqual([]);
    // the copy becomes new ids rather than stealing the existing ones
    expect(report.added).toHaveLength(2);
  });
});

describe("rematchIds: renamed component", () => {
  it("keeps the id and updates the component", () => {
    const { map } = seed({ "src/Pricing.tsx": CARD });
    const renamed = CARD.replace("PricingCard", "PlanCard");
    const { map: next, report } = rematchIds(map, discover({ "src/Pricing.tsx": renamed }));

    expect(report.renamed).toEqual([
      { id: "PricingCard.b1", from: "PricingCard", to: "PlanCard" },
      { id: "PricingCard.d1", from: "PricingCard", to: "PlanCard" },
    ]);
    expect(report.missing).toEqual([]);
    expect(report.added).toEqual([]);
    expect(next.ids["PricingCard.b1"].component).toBe("PlanCard");
    // the id keeps its original name; only the entry moves
    expect(next.ids["PlanCard.b1"]).toBeUndefined();
  });

  it("does not fire when both the file and the component changed", () => {
    const { map } = seed({ "src/Pricing.tsx": CARD });
    const renamed = CARD.replace("PricingCard", "PlanCard");
    const { report } = rematchIds(map, discover({ "src/Plans.tsx": renamed }));
    expect(report.missing).toEqual(["PricingCard.b1", "PricingCard.d1"]);
    expect(report.renamed).toEqual([]);
    expect(report.moved).toEqual([]);
  });
});

describe("rematchIds: reordered", () => {
  const TWO = `
    function Card() {
      return (
        <div>
          <button onClick={buy}>Buy</button>
          <button onClick={cancel}>Cancel</button>
        </div>
      );
    }
  `;
  const SWAPPED = `
    function Card() {
      return (
        <div>
          <button onClick={cancel}>Cancel</button>
          <button onClick={buy}>Buy</button>
        </div>
      );
    }
  `;

  it("keeps ids attached to their signature, not their position", () => {
    const { map } = seed({ "src/Card.tsx": TWO });
    const buySig = map.ids["Card.b1"].sig;
    const cancelSig = map.ids["Card.b2"].sig;

    const { map: next, report } = rematchIds(map, discover({ "src/Card.tsx": SWAPPED }));

    expect(report.missing).toEqual([]);
    expect(report.added).toEqual([]);
    expect(next.ids["Card.b1"].sig).toBe(buySig);
    expect(next.ids["Card.b2"].sig).toBe(cancelSig);
    expect(report.reordered.map((r) => r.id).sort()).toEqual(["Card.b1", "Card.b2"]);
  });

  it("assigns the original id to the element that now sits elsewhere", () => {
    const { map } = seed({ "src/Card.tsx": TWO });
    const swapped = discover({ "src/Card.tsx": SWAPPED });
    const { assignments } = rematchIds(map, swapped);

    const buy = swapped.find((el) => el.sig === map.ids["Card.b1"].sig)!;
    expect(buy.id).toBe("Card.b2"); // its positional name changed
    expect(assignments["src/Card.tsx"][elementKey(buy)]).toBe("Card.b1"); // its identity did not
  });

  it("survives a new element being inserted above", () => {
    const withNew = `
      function Card() {
        return (
          <div>
            <button onClick={help}>Help</button>
            <button onClick={buy}>Buy</button>
            <button onClick={cancel}>Cancel</button>
          </div>
        );
      }
    `;
    const { map } = seed({ "src/Card.tsx": TWO });
    const { report } = rematchIds(map, discover({ "src/Card.tsx": withNew }));
    expect(report.missing).toEqual([]);
    expect(report.reordered.map((r) => r.id).sort()).toEqual(["Card.b1", "Card.b2"]);
    expect(report.added).toHaveLength(1);
  });
});

describe("rematchIds: missing", () => {
  it("reports a deleted element and keeps its entry untouched", () => {
    const { map } = seed({ "src/Pricing.tsx": CARD });
    const deleted = `export function PricingCard() { return <div className="card" />; }`;
    const { map: next, report } = rematchIds(map, discover({ "src/Pricing.tsx": deleted }));

    expect(report.missing).toEqual(["PricingCard.b1"]);
    expect(next.ids["PricingCard.b1"]).toEqual(map.ids["PricingCard.b1"]);
  });

  it("never reassigns a missing id to a different element", () => {
    const { map } = seed({ "src/Pricing.tsx": CARD });
    const replaced = `
      export function PricingCard() {
        return (
          <div className="card">
            <button onClick={somethingElse}>Totally different</button>
          </div>
        );
      }
    `;
    const discovered = discover({ "src/Pricing.tsx": replaced });
    const { map: next, report, assignments } = rematchIds(map, discovered);

    expect(report.missing).toEqual(["PricingCard.b1"]);
    expect(next.ids["PricingCard.b1"].sig).toBe(map.ids["PricingCard.b1"].sig);

    const newButton = discovered.find((el) => el.tag === "button")!;
    expect(assignments["src/Pricing.tsx"][elementKey(newButton)]).not.toBe("PricingCard.b1");
  });

  it("reports the whole map as missing when every file is gone", () => {
    const { map } = seed({ "src/Pricing.tsx": CARD });
    const { report, map: next } = rematchIds(map, []);
    expect(report.missing).toEqual(["PricingCard.b1", "PricingCard.d1"]);
    expect(next.ids).toEqual(map.ids);
  });

  it("does not let a second id steal the element a first id already claimed", () => {
    const map: IdMap = {
      version: 1,
      ids: {
        "Card.b1": { file: "src/Card.tsx", component: "Card", tag: "button", sig: "" },
        "Card.b9": { file: "src/Card.tsx", component: "Card", tag: "button", sig: "" },
      },
    };
    const code = `function Card(){ return <button onClick={buy}>Buy</button>; }`;
    const discovered = discover({ "src/Card.tsx": code });
    map.ids["Card.b1"].sig = discovered[0].sig;
    map.ids["Card.b9"].sig = discovered[0].sig;

    const { report } = rematchIds(map, discovered);
    expect(report.kept).toEqual(["Card.b1"]);
    expect(report.missing).toEqual(["Card.b9"]);
  });
});

describe("rematchIds: added ids never collide", () => {
  it("disambiguates a new element whose positional name is already taken", () => {
    const TWO = `
      function Card() {
        return (
          <div>
            <button onClick={buy}>Buy</button>
            <button onClick={cancel}>Cancel</button>
          </div>
        );
      }
    `;
    const { map } = seed({ "src/Card.tsx": TWO });
    // Delete "Buy" and add a brand new first button: its positional name would
    // be Card.b1, which the reordered "Cancel" now owns.
    const changed = `
      function Card() {
        return (
          <div>
            <button onClick={fresh}>Fresh</button>
            <button onClick={cancel}>Cancel</button>
          </div>
        );
      }
    `;
    const discovered = discover({ "src/Card.tsx": changed });
    const { map: next, assignments, report } = rematchIds(map, discovered);

    const assigned = Object.values(assignments["src/Card.tsx"]);
    expect(new Set(assigned).size).toBe(assigned.length);
    expect(report.missing).toEqual(["Card.b1"]);
    expect(Object.keys(next.ids)).toHaveLength(4);
  });
});

describe("summarizeReport", () => {
  it("renders a one-line summary", () => {
    const { report } = rematchIds({ version: 1, ids: {} }, discover({ "src/Pricing.tsx": CARD }));
    expect(summarizeReport(report)).toBe(
      "0 kept, 0 moved, 0 renamed, 0 reordered, 2 added, 0 missing",
    );
  });
});
