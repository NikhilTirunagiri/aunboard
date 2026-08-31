import { describe, expect, it } from "vitest";

import {
  computeSig,
  discoverElements,
  fallbackComponentName,
  findIdCollisions,
} from "../src/discover";

const ids = (code: string, file = "src/Pricing.tsx") =>
  discoverElements(code, file).map((el) => el.id);

describe("id generation", () => {
  it("names an element <Component>.<tagInitial><ordinal>", () => {
    const code = `
      export function PricingCard() {
        return <div><button>Buy</button></div>;
      }
    `;
    expect(ids(code)).toEqual(["PricingCard.d1", "PricingCard.b1"]);
  });

  it("numbers ordinals per component in JSX source order, 1-based", () => {
    const code = `
      function PricingCard() {
        return (
          <div>
            <button>One</button>
            <span>x</span>
            <button>Two</button>
            <button>Three</button>
          </div>
        );
      }
    `;
    expect(ids(code)).toEqual([
      "PricingCard.d1",
      "PricingCard.b1",
      "PricingCard.s1",
      "PricingCard.b2",
      "PricingCard.b3",
    ]);
  });

  it("restarts ordinals in each component", () => {
    const code = `
      function A() { return <button>a</button>; }
      function B() { return <button>b</button>; }
    `;
    expect(ids(code)).toEqual(["A.b1", "B.b1"]);
  });

  it("keeps ids unique when two tags share an initial", () => {
    const code = `function A() { return <div><button>x</button><br /></div>; }`;
    const list = ids(code);
    expect(list).toEqual(["A.d1", "A.b1", "A.b2"]);
    expect(new Set(list).size).toBe(list.length);
  });

  it("skips components, fragments and member/namespaced element names", () => {
    const code = `
      function A() {
        return (
          <>
            <Card><button>x</button></Card>
            <Menu.Item />
            <svg:rect />
          </>
        );
      }
    `;
    expect(ids(code)).toEqual(["A.b1"]);
  });
});

describe("component name resolution", () => {
  it("uses an arrow component assigned to a const", () => {
    expect(ids(`const PricingCard = () => <button>x</button>;`)).toEqual(["PricingCard.b1"]);
  });

  it("uses the class name for a class component", () => {
    const code = `
      class PricingCard extends React.Component {
        render() { return <button>x</button>; }
      }
    `;
    expect(ids(code)).toEqual(["PricingCard.b1"]);
  });

  it("looks through anonymous callbacks to the enclosing component", () => {
    const code = `
      function List({ items }) {
        return <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul>;
      }
    `;
    expect(ids(code)).toEqual(["List.u1", "List.l1"]);
  });

  it("does not mistake a const holding a mapped array for the component", () => {
    const code = `
      function List({ items }) {
        const rows = items.map((item) => <li key={item}>{item}</li>);
        return <ul>{rows}</ul>;
      }
    `;
    expect(ids(code)).toEqual(["List.l1", "List.u1"]);
  });

  it("looks through forwardRef/memo wrappers to the component name", () => {
    const code = `const PricingCard = forwardRef((props, ref) => <button ref={ref}>x</button>);`;
    expect(ids(code)).toEqual(["PricingCard.b1"]);
  });

  it("falls back to the file name for an anonymous default export", () => {
    const code = `export default function () { return <button>x</button>; }`;
    expect(ids(code, "src/pricing-card.tsx")).toEqual(["PricingCard.b1"]);
  });

  it("falls back to the directory name for index files", () => {
    expect(fallbackComponentName("src/pricing-card/index.tsx")).toBe("PricingCard");
    expect(fallbackComponentName("src/Header.jsx")).toBe("Header");
  });
});

describe("fuzzy signature", () => {
  const sigOf = (code: string, index = 0) => discoverElements(code, "src/Pricing.tsx")[index].sig;

  it("is stable across reformatting and attribute reordering", () => {
    const compact = `function Card(){return <button className="x" onClick={go}>Buy now</button>;}`;
    const pretty = `
      function Card() {
        return (
          <button
            onClick={go}
            className="x"
          >
            Buy
            now
          </button>
        );
      }
    `;
    expect(sigOf(pretty)).toBe(sigOf(compact));
  });

  it("is unchanged when lines are inserted above the element", () => {
    const before = `function Card(){ return <button>Buy</button>; }`;
    const after = `
      // a new comment
      const helper = 1;
      const other = 2;

      function Card(){ return <button>Buy</button>; }
    `;
    expect(sigOf(after)).toBe(sigOf(before));
  });

  it("is unchanged when the element is reordered within its component", () => {
    const first = `function Card(){ return <div><button>Buy</button><a href="/x">Go</a></div>; }`;
    const second = `function Card(){ return <div><a href="/x">Go</a><button>Buy</button></div>; }`;
    const buy = (code: string) =>
      discoverElements(code, "src/Pricing.tsx").find((el) => el.tag === "button")!.sig;
    expect(buy(second)).toBe(buy(first));
  });

  it("ignores an existing data-aun attribute so stamping is signature-neutral", () => {
    const plain = `function Card(){ return <button className="x">Buy</button>; }`;
    const stamped = `function Card(){ return <button className="x" data-aun="Card.b1">Buy</button>; }`;
    expect(sigOf(stamped)).toBe(sigOf(plain));
  });

  it("changes when the tag, attributes or text change", () => {
    const base = `function Card(){ return <button className="x">Buy</button>; }`;
    const otherTag = `function Card(){ return <a className="x">Buy</a>; }`;
    const otherAttrs = `function Card(){ return <button className="x" disabled>Buy</button>; }`;
    const otherText = `function Card(){ return <button className="x">Sell</button>; }`;
    const unique = new Set([base, otherTag, otherAttrs, otherText].map((c) => sigOf(c)));
    expect(unique.size).toBe(4);
  });

  it("is a short hex digest", () => {
    expect(computeSig({ tag: "button", attrNames: [], text: "" })).toMatch(/^[0-9a-f]{6}$/);
  });

  it("does not depend on the file the element lives in", () => {
    const code = `function Card(){ return <button>Buy</button>; }`;
    expect(discoverElements(code, "src/a.tsx")[0].sig).toBe(
      discoverElements(code, "src/deeply/nested/b.tsx")[0].sig,
    );
  });

  it("does not depend on the enclosing component, so a rename stays recoverable", () => {
    const before = `function PricingCard(){ return <button className="x">Buy</button>; }`;
    const after = `function PlanCard(){ return <button className="x">Buy</button>; }`;
    expect(sigOf(after)).toBe(sigOf(before));
  });

  it("reads static text out of expression containers", () => {
    const literal = `function Card(){ return <button>{"Buy"}</button>; }`;
    const text = `function Card(){ return <button>Buy</button>; }`;
    expect(sigOf(literal)).toBe(sigOf(text));
  });
});

describe("discovered metadata", () => {
  it("records the existing stamp value", () => {
    const code = `function Card(){ return <button data-aun="Legacy.b9">Buy</button>; }`;
    const [el] = discoverElements(code, "src/Pricing.tsx");
    expect(el.hasStamp).toBe(true);
    expect(el.existingStamp).toBe("Legacy.b9");
  });

  it("records the file, tag and ordinal", () => {
    const code = `function Card(){ return <div><button>a</button><button>b</button></div>; }`;
    const els = discoverElements(code, "src/Pricing.tsx");
    expect(els[2]).toMatchObject({ file: "src/Pricing.tsx", tag: "button", ordinal: 2, initial: "b" });
  });

  it("parses TypeScript syntax", () => {
    const code = `
      type Props = { label: string };
      export function Card({ label }: Props): JSX.Element {
        return <button aria-label={label as string}>Buy</button>;
      }
    `;
    expect(ids(code)).toEqual(["Card.b1"]);
  });
});

describe("findIdCollisions", () => {
  it("reports an id claimed by two files", () => {
    const a = discoverElements(`function Card(){ return <button>a</button>; }`, "src/a.tsx");
    const b = discoverElements(`function Card(){ return <button>b</button>; }`, "src/b.tsx");
    expect(findIdCollisions([...a, ...b])).toEqual([
      { id: "Card.b1", files: ["src/a.tsx", "src/b.tsx"] },
    ]);
  });

  it("is empty when every id is unique", () => {
    const a = discoverElements(`function Card(){ return <button>a</button>; }`, "src/a.tsx");
    const b = discoverElements(`function Panel(){ return <button>b</button>; }`, "src/b.tsx");
    expect(findIdCollisions([...a, ...b])).toEqual([]);
  });
});
