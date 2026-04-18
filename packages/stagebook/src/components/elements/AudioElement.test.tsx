// @vitest-environment jsdom
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import React, { type ReactNode } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { AudioElement } from "./AudioElement.js";

// Track addEventListener / removeEventListener calls on Audio instances.
let audioAddSpy: ReturnType<typeof vi.spyOn>;
let audioRemoveSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  // jsdom provides window.Audio but no real decoding — the "canplaythrough"
  // event is never fired, which is fine for this test: we only care about
  // effect churn (setup/teardown of listeners), not playback itself.
  audioAddSpy = vi.spyOn(window.HTMLMediaElement.prototype, "addEventListener");
  audioRemoveSpy = vi.spyOn(
    window.HTMLMediaElement.prototype,
    "removeEventListener",
  );
});

afterEach(() => {
  audioAddSpy.mockRestore();
  audioRemoveSpy.mockRestore();
});

describe("AudioElement — unstable callback audit (#105)", () => {
  test("does not churn canplaythrough listener when save is unstable", () => {
    const container = document.createElement("div");
    let root: Root;

    function Parent({ tick }: { tick: number }): ReactNode {
      void tick;
      // Fresh inline callback every render — worst case for effect dep stability
      return (
        <AudioElement
          src="https://example.com/chime.mp3"
          save={(_k, _v) => {}}
          name="chime"
        />
      );
    }

    act(() => {
      root = createRoot(container);
      root.render(<Parent tick={0} />);
    });

    const addCallsAfterMount = audioAddSpy.mock.calls.filter(
      ([type]) => type === "canplaythrough",
    ).length;
    const removeCallsAfterMount = audioRemoveSpy.mock.calls.filter(
      ([type]) => type === "canplaythrough",
    ).length;

    // Re-render several times with fresh save references
    for (let i = 1; i <= 5; i++) {
      act(() => {
        root.render(<Parent tick={i} />);
      });
    }

    const addCallsAfterReRender = audioAddSpy.mock.calls.filter(
      ([type]) => type === "canplaythrough",
    ).length;
    const removeCallsAfterReRender = audioRemoveSpy.mock.calls.filter(
      ([type]) => type === "canplaythrough",
    ).length;

    // The listener should not be torn down and re-added on every re-render
    expect(addCallsAfterReRender).toBe(addCallsAfterMount);
    expect(removeCallsAfterReRender).toBe(removeCallsAfterMount);

    act(() => root.unmount());
  });
});
