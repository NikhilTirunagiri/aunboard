import { describe, it, expect } from "vitest";
import { act, renderHook } from "@testing-library/react";
import React from "react";
import { useAunboard, AunboardContext, type AunboardValue } from "./context";

describe("useAunboard", () => {
  it("throws when used outside the provider", () => {
    expect(() => renderHook(() => useAunboard())).toThrow(/inside <AunboardProvider>/);
  });
});

describe('"record" is a valid AunboardMode value', () => {
  it("setMode('record') is accepted and reflected via the context", () => {
    let externalSetMode: (m: AunboardValue["mode"]) => void = () => {};
    const { result } = renderHook(() => useAunboard(), {
      wrapper: ({ children }: { children: React.ReactNode }) => {
        const [mode, setMode] = React.useState<AunboardValue["mode"]>("off");
        externalSetMode = setMode;
        const value: AunboardValue = {
          mode,
          setMode,
          tours: {},
          activeTourId: null,
          setActiveTourId: () => {},
        };
        return (
          <AunboardContext.Provider value={value}>
            {children}
          </AunboardContext.Provider>
        );
      },
    });

    expect(result.current.mode).toBe("off");

    act(() => {
      externalSetMode("record");
    });

    expect(result.current.mode).toBe("record");
  });
});
