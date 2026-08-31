import { TraceMap, originalPositionFor } from "@jridgewell/trace-mapping";
import { describe, expect, it } from "vitest";

import { discoverElements } from "../src/discover";
import { transform } from "../src/transform";
import { elementKey } from "../src/types";

const FILE = "src/Pricing.tsx";

const run = (code: string, options: Parameters<typeof transform>[2]) =>
  transform(code, FILE, options);

describe("transform: what gets stamped", () => {
  const code = `
    export function PricingCard() {
      return (
        <div>
          <button>Buy</button>
          <button>Cancel</button>
        </div>
      );
    }
  `;

  it("stamps only the ids in stampIds", () => {
    const out = run(code, { stampIds: ["PricingCard.b1"] })!;
    expect(out.code).toContain('<button data-aun="PricingCard.b1">Buy</button>');
    expect(out.code).toContain("<button>Cancel</button>");
    expect(out.code.match(/data-aun/g)).toHaveLength(1);
  });

  it("stamps nothing when stampIds is undefined", () => {
    expect(run(code, {})).toBeNull();
    expect(transform(code, FILE)).toBeNull();
  });

  it("stamps nothing when stampIds is empty", () => {
    expect(run(code, { stampIds: [] })).toBeNull();
  });

  it("stamps nothing when no id in stampIds is in this file", () => {
    expect(run(code, { stampIds: ["Other.b1"] })).toBeNull();
  });

  it("stamps every host element with stampAll", () => {
    const out = run(code, { stampAll: true })!;
    expect(out.code).toContain('data-aun="PricingCard.d1"');
    expect(out.code).toContain('data-aun="PricingCard.b1"');
    expect(out.code).toContain('data-aun="PricingCard.b2"');
    expect(out.code.match(/data-aun/g)).toHaveLength(3);
  });

  it("never stamps components, fragments or member expressions", () => {
    const jsx = `
      function App() {
        return (
          <>
            <Card title="x">
              <Menu.Item />
              <span>hi</span>
            </Card>
          </>
        );
      }
    `;
    const out = run(jsx, { stampAll: true })!;
    expect(out.code).toContain('<span data-aun="App.s1">');
    expect(out.code).toContain('<Card title="x">');
    expect(out.code).toContain("<Menu.Item />");
    expect(out.code.match(/data-aun/g)).toHaveLength(1);
  });

  it("returns null for a file with no JSX", () => {
    expect(transform(`export const x = 1;`, "src/x.ts", { stampAll: true })).toBeNull();
  });
});

describe("transform: idempotency and existing attributes", () => {
  it("is idempotent", () => {
    const code = `function Card(){ return <button className="a">Buy</button>; }`;
    const once = run(code, { stampAll: true })!.code;
    const twice = run(once, { stampAll: true });
    expect(twice).toBeNull();
    expect(once).toContain('data-aun="Card.b1"');
  });

  it("never overwrites an existing data-aun, even a hand-written one", () => {
    const code = `function Card(){ return <button data-aun="hand.written">Buy</button>; }`;
    expect(run(code, { stampAll: true })).toBeNull();
    expect(run(code, { stampIds: ["Card.b1"] })).toBeNull();
  });

  it("does not overwrite a dynamic data-aun expression", () => {
    const code = `function Card(){ return <button data-aun={dynamic}>Buy</button>; }`;
    expect(run(code, { stampAll: true })).toBeNull();
  });

  it("preserves existing attributes verbatim", () => {
    const code = `function Card(){ return <button className="a b" onClick={go} disabled aria-label='Buy now'>Buy</button>; }`;
    const out = run(code, { stampAll: true })!;
    expect(out.code).toContain(`className="a b" onClick={go} disabled aria-label='Buy now'`);
    expect(out.code.replace(' data-aun="Card.b1"', "")).toBe(code);
  });

  it("places the stamp after a spread so the spread cannot clobber it", () => {
    const code = `function Card(){ return <button {...props}>Buy</button>; }`;
    const out = run(code, { stampAll: true })!;
    expect(out.code).toContain(`<button {...props} data-aun="Card.b1">`);
  });

  it("handles spreads mixed with attributes and self-closing tags", () => {
    const code = `function Card(){ return <div><input type="text" {...rest} /><br/></div>; }`;
    const out = run(code, { stampAll: true })!;
    expect(out.code).toContain(`<input type="text" {...rest} data-aun="Card.i1" />`);
    expect(out.code).toContain(`<br data-aun="Card.b1"/>`);
    expect(out.code.replace(/ data-aun="[^"]+"/g, "")).toBe(code);
  });

  it("handles a bare self-closing element with no attributes", () => {
    const code = `function Card(){ return <hr/>; }`;
    expect(run(code, { stampAll: true })!.code).toBe(
      `function Card(){ return <hr data-aun="Card.h1"/>; }`,
    );
  });

  it("only inserts the attribute, leaving everything else byte-identical", () => {
    const code = `
      // keep this comment
      export function Card({ items }: { items: string[] }) {
        return (
          <ul className="list">
            {items.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        );
      }
    `;
    const out = run(code, { stampAll: true })!;
    expect(out.code.replace(/ data-aun="[^"]+"/g, "")).toBe(code);
  });

  it("escapes quotes in an id it is asked to stamp", () => {
    const code = `function Card(){ return <button>Buy</button>; }`;
    const el = discoverElements(code, FILE)[0];
    const out = run(code, {
      stampIds: [`weird"id`],
      idOverrides: { [elementKey(el)]: `weird"id` },
    })!;
    expect(out.code).toContain(`data-aun="weird&quot;id"`);
  });
});

describe("transform: id overrides", () => {
  const code = `
    function Card() {
      return (
        <div>
          <a href="/x">Go</a>
          <button>Buy</button>
        </div>
      );
    }
  `;

  it("stamps the mapped id rather than the positional one", () => {
    const button = discoverElements(code, FILE).find((el) => el.tag === "button")!;
    expect(button.id).toBe("Card.b1");
    const out = run(code, {
      stampIds: ["Card.b7"],
      idOverrides: { [elementKey(button)]: "Card.b7" },
    })!;
    expect(out.code).toContain('<button data-aun="Card.b7">');
    expect(out.code).not.toContain("Card.b1");
  });

  it("does not stamp the positional id when it has been reassigned away", () => {
    const button = discoverElements(code, FILE).find((el) => el.tag === "button")!;
    const out = run(code, {
      stampIds: ["Card.b1"],
      idOverrides: { [elementKey(button)]: "Card.b7" },
    });
    expect(out).toBeNull();
  });
});

describe("transform: sourcemap", () => {
  const code = [
    "export function Card() {",
    "  return (",
    "    <div>",
    "      <button onClick={go}>Buy</button>",
    "    </div>",
    "  );",
    "}",
    "",
  ].join("\n");

  it("produces a v3 map carrying the original source", () => {
    const out = run(code, { stampAll: true })!;
    expect(out.map).not.toBeNull();
    expect(out.map!.version).toBe(3);
    expect(out.map!.sources).toEqual([FILE]);
    expect(out.map!.sourcesContent).toEqual([code]);
    expect(out.map!.mappings.length).toBeGreaterThan(0);
  });

  it("maps generated positions back to the right original line", () => {
    const out = run(code, { stampAll: true })!;
    const trace = new TraceMap(out.map as never);
    const lines = out.code.split("\n");

    const generatedLine = lines.findIndex((line) => line.includes("<button")) + 1;
    const column = lines[generatedLine - 1].indexOf("onClick");
    const original = originalPositionFor(trace, { line: generatedLine, column });

    expect(original.source).toBe(FILE);
    expect(original.line).toBe(4);
    expect(original.column).toBe(code.split("\n")[3].indexOf("onClick"));
  });

  it("does not shift positions on lines before the first edit", () => {
    const out = run(code, { stampAll: true })!;
    const trace = new TraceMap(out.map as never);
    expect(originalPositionFor(trace, { line: 1, column: 16 })).toMatchObject({
      line: 1,
      column: 16,
    });
  });

  it("can be asked to skip the map", () => {
    const out = run(code, { stampAll: true, sourcemap: false })!;
    expect(out.map).toBeNull();
    expect(out.code).toContain("data-aun");
  });
});

describe("transform: custom attribute", () => {
  it("stamps and detects a non-default attribute", () => {
    const code = `function Card(){ return <button>Buy</button>; }`;
    const out = run(code, { stampAll: true, attr: "data-tour" })!;
    expect(out.code).toContain('data-tour="Card.b1"');
    expect(transform(out.code, FILE, { stampAll: true, attr: "data-tour" })).toBeNull();
  });
});
