import { describe, expect, it } from "vitest";
import { DEFAULT_TIMEOUT_MS, DEFAULT_TOURS_GLOB, parseCliArgs } from "./args";

function verifyOptions(argv: string[]) {
  const parsed = parseCliArgs(argv);
  if (parsed.kind !== "verify") throw new Error(`expected verify, got ${parsed.kind}: ${JSON.stringify(parsed)}`);
  return parsed.options;
}

describe("parseCliArgs", () => {
  it("parses the minimal verify invocation with defaults", () => {
    expect(verifyOptions(["verify", "--url", "http://localhost:3000"])).toEqual({
      url: "http://localhost:3000",
      tours: [DEFAULT_TOURS_GLOB],
      timeout: DEFAULT_TIMEOUT_MS,
      reporter: "pretty",
    });
  });

  it("accepts --tours repeatedly", () => {
    const options = verifyOptions([
      "verify",
      "--url",
      "http://x.test",
      "--tours",
      "src/**/*.tour.json",
      "--tours",
      "extra/*.tour.json",
    ]);
    expect(options.tours).toEqual(["src/**/*.tour.json", "extra/*.tour.json"]);
  });

  it("accepts --key=value form and a numeric timeout", () => {
    const options = verifyOptions(["verify", "--url=http://x.test", "--timeout=1500"]);
    expect(options.timeout).toBe(1500);
  });

  it("accepts every reporter", () => {
    for (const reporter of ["pretty", "json", "github"] as const) {
      expect(verifyOptions(["verify", "--url", "http://x.test", "--reporter", reporter]).reporter).toBe(reporter);
    }
  });

  it("treats --json as --reporter json, and lets it win over --reporter", () => {
    expect(verifyOptions(["verify", "--url", "http://x.test", "--json"]).reporter).toBe("json");
    expect(verifyOptions(["verify", "--url", "http://x.test", "--reporter", "pretty", "--json"]).reporter).toBe("json");
  });

  it("returns help for --help and -h, before and after the command", () => {
    expect(parseCliArgs(["--help"]).kind).toBe("help");
    expect(parseCliArgs(["-h"]).kind).toBe("help");
    expect(parseCliArgs(["verify", "--help"]).kind).toBe("help");
  });

  it("returns version for --version and -v", () => {
    expect(parseCliArgs(["--version"]).kind).toBe("version");
    expect(parseCliArgs(["-v"]).kind).toBe("version");
  });

  it("errors with no command", () => {
    const parsed = parseCliArgs([]);
    expect(parsed).toMatchObject({ kind: "error" });
    expect(parsed.kind === "error" && parsed.message).toMatch(/missing command/);
  });

  it("errors on an unknown command", () => {
    const parsed = parseCliArgs(["record", "--url", "http://x.test"]);
    expect(parsed.kind === "error" && parsed.message).toMatch(/unknown command "record"/);
  });

  it("errors on an extra positional", () => {
    const parsed = parseCliArgs(["verify", "oops", "--url", "http://x.test"]);
    expect(parsed.kind === "error" && parsed.message).toMatch(/unexpected argument "oops"/);
  });

  it("errors when --url is missing", () => {
    const parsed = parseCliArgs(["verify"]);
    expect(parsed.kind === "error" && parsed.message).toMatch(/--url is required/);
  });

  it("errors when --url is not a URL", () => {
    const parsed = parseCliArgs(["verify", "--url", "not a url"]);
    expect(parsed.kind === "error" && parsed.message).toMatch(/not a valid absolute URL/);
  });

  it("errors when --url is not http(s)", () => {
    const parsed = parseCliArgs(["verify", "--url", "localhost:3000"]);
    expect(parsed.kind === "error" && parsed.message).toMatch(/must be an http\(s\) URL/);
  });

  it("errors on a non-numeric or non-positive timeout", () => {
    expect(parseCliArgs(["verify", "--url", "http://x.test", "--timeout", "soon"]).kind).toBe("error");
    expect(parseCliArgs(["verify", "--url", "http://x.test", "--timeout", "0"]).kind).toBe("error");
    expect(parseCliArgs(["verify", "--url", "http://x.test", "--timeout", "-5"]).kind).toBe("error");
  });

  it("errors on an unknown reporter", () => {
    const parsed = parseCliArgs(["verify", "--url", "http://x.test", "--reporter", "teamcity"]);
    expect(parsed.kind === "error" && parsed.message).toMatch(/unknown --reporter "teamcity"/);
  });

  it("errors on an unknown flag instead of throwing", () => {
    const parsed = parseCliArgs(["verify", "--url", "http://x.test", "--headed"]);
    expect(parsed.kind).toBe("error");
  });
});
