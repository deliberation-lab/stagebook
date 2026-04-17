// @vitest-environment jsdom
import { describe, test, expect, vi } from "vitest";
import React, { type ReactNode } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Qualtrics } from "./Qualtrics.js";

// Spy on window.addEventListener / removeEventListener for "message"
function installMessageListenerSpy() {
  const addSpy = vi.spyOn(window, "addEventListener");
  const removeSpy = vi.spyOn(window, "removeEventListener");
  return {
    addCalls: () =>
      addSpy.mock.calls.filter(([type]) => type === "message").length,
    removeCalls: () =>
      removeSpy.mock.calls.filter(([type]) => type === "message").length,
    restore: () => {
      addSpy.mockRestore();
      removeSpy.mockRestore();
    },
  };
}

describe("Qualtrics — unstable callback audit (#105)", () => {
  test("does not churn the message listener when save/onComplete are unstable", () => {
    const spy = installMessageListenerSpy();
    const container = document.createElement("div");
    let root: Root;

    // Parent re-renders and always passes fresh inline callbacks —
    // the worst case for effect dependency stability.
    function Parent({ tick }: { tick: number }): ReactNode {
      void tick;
      return (
        <Qualtrics
          url="https://example.qualtrics.com/jfe/form/SV_abc"
          save={(_key, _value) => {}}
          onComplete={() => {}}
        />
      );
    }

    act(() => {
      root = createRoot(container);
      root.render(<Parent tick={0} />);
    });

    // Force several re-renders with fresh callback references
    for (let i = 1; i <= 5; i++) {
      act(() => {
        root.render(<Parent tick={i} />);
      });
    }

    // Effect setup should run once on mount; fresh callback refs must not
    // cause teardown/re-setup of the window "message" listener.
    expect(spy.addCalls()).toBe(1);
    expect(spy.removeCalls()).toBe(0);

    act(() => root.unmount());
    spy.restore();
  });

  test("still reads the latest onComplete / save when the message arrives", () => {
    const container = document.createElement("div");
    let root: Root;
    const saveV1 = vi.fn();
    const saveV2 = vi.fn();
    const onCompleteV1 = vi.fn();
    const onCompleteV2 = vi.fn();

    function Parent({
      save,
      onComplete,
    }: {
      save: typeof saveV1;
      onComplete: typeof onCompleteV1;
    }): ReactNode {
      return (
        <Qualtrics
          url="https://example.qualtrics.com/jfe/form/SV_abc"
          save={save}
          onComplete={onComplete}
        />
      );
    }

    act(() => {
      root = createRoot(container);
      root.render(<Parent save={saveV1} onComplete={onCompleteV1} />);
    });

    // Swap both callbacks on a re-render
    act(() => {
      root.render(<Parent save={saveV2} onComplete={onCompleteV2} />);
    });

    // Dispatch a synthetic Qualtrics EOS message
    act(() => {
      const event = new MessageEvent("message", {
        data: "QualtricsEOS|SV_abc|session123",
        origin: "https://example.qualtrics.com",
      });
      window.dispatchEvent(event);
    });

    // The latest callbacks should have been invoked, not the stale ones
    expect(saveV1).not.toHaveBeenCalled();
    expect(onCompleteV1).not.toHaveBeenCalled();
    expect(saveV2).toHaveBeenCalledWith("qualtricsDataReady", {
      surveyURL: "https://example.qualtrics.com/jfe/form/SV_abc",
      surveyId: "SV_abc",
      sessionId: "session123",
    });
    expect(onCompleteV2).toHaveBeenCalledTimes(1);

    act(() => root.unmount());
  });
});
