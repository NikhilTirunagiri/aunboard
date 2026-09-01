import { describe, it, expect } from "vitest";
import { parseCliArgs, parseHeaders, parseVars, applyRouteVars } from "./args";

const base = ["verify", "--url", "http://localhost:3000"];

describe("--storage-state", () => {
  it("is parsed and passed through", () => {
    const r = parseCliArgs([...base, "--storage-state", ".auth/state.json"]);
    expect(r.kind === "verify" && r.options.storageState).toBe(".auth/state.json");
  });
  it("is undefined when absent", () => {
    const r = parseCliArgs(base);
    expect(r.kind === "verify" && r.options.storageState).toBeUndefined();
  });
});

describe("--header", () => {
  it("parses colon and equals forms, and repeats", () => {
    expect(parseHeaders(["Authorization: Bearer abc", "X-Env=staging"]).headers).toEqual({
      Authorization: "Bearer abc",
      "X-Env": "staging",
    });
  });
  it("keeps colons inside the value (bearer tokens, URLs)", () => {
    expect(parseHeaders(["X-Return: https://a.test/x"]).headers).toEqual({
      "X-Return": "https://a.test/x",
    });
  });
  it("rejects a header with no separator", () => {
    expect(parseHeaders(["nonsense"]).error).toMatch(/must look like/);
    const r = parseCliArgs([...base, "--header", "nonsense"]);
    expect(r.kind).toBe("error");
  });
});

describe("--var and route substitution", () => {
  it("substitutes :name tokens", () => {
    expect(applyRouteVars("/workspace/:ws/project/:proj/pipeline", { ws: "w1", proj: "p2" }))
      .toBe("/workspace/w1/project/p2/pipeline");
  });
  it("substitutes {name} tokens too", () => {
    expect(applyRouteVars("/workspace/{ws}/settings", { ws: "w1" })).toBe("/workspace/w1/settings");
  });
  it("substitutes every occurrence of the same token", () => {
    expect(applyRouteVars("/a/:id/b/:id", { id: "x" })).toBe("/a/x/b/x");
  });
  it("leaves an unknown token in place rather than blanking it", () => {
    // A silently blanked segment produces a plausible-looking wrong URL. Leaving the token
    // makes the resulting 404 name the variable that was never supplied.
    expect(applyRouteVars("/workspace/:ws/x", {})).toBe("/workspace/:ws/x");
  });
  it("passes an undefined route through untouched", () => {
    expect(applyRouteVars(undefined, { ws: "w1" })).toBeUndefined();
  });
  it("does not treat a value as a further template", () => {
    expect(applyRouteVars("/a/:x", { x: ":y", y: "no" })).toBe("/a/:y");
  });
  it("rejects a var with no '='", () => {
    expect(parseVars(["oops"]).error).toMatch(/must look like/);
    expect(parseCliArgs([...base, "--var", "oops"]).kind).toBe("error");
  });
  it("parses repeated vars end to end", () => {
    const r = parseCliArgs([...base, "--var", "ws=abc", "--var", "proj=xyz"]);
    expect(r.kind === "verify" && r.options.vars).toEqual({ ws: "abc", proj: "xyz" });
  });
});
