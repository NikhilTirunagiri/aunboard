import { describe, it, expect } from "vitest";
import { act, renderHook } from "@testing-library/react";
import React from "react";
import { useLabelMode, LabelModeContext, type LabelModeValue } from "./context";

describe("useLabelMode", () => {
  it("throws when used outside the provider", () => {
    expect(() => renderHook(() => useLabelMode())).toThrow(/inside <LabelModeProvider>/);
  });
});

describe('"record" is a valid LabelMode value', () => {
  it("setMode('record') is accepted and reflected via the context", () => {
    let externalSetMode: (m: LabelModeValue["mode"]) => void = () => {};
    const { result } = renderHook(() => useLabelMode(), {
      wrapper: ({ children }: { children: React.ReactNode }) => {
        const [mode, setMode] = React.useState<LabelModeValue["mode"]>("off");
        externalSetMode = setMode;
        const value: LabelModeValue = {
          mode,
          setMode,
          tours: {},
          activeTourId: null,
          setActiveTourId: () => {},
        };
        return (
          <LabelModeContext.Provider value={value}>
            {children}
          </LabelModeContext.Provider>
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
