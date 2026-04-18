import { describe, it, expect } from "vitest";
import {
  applyMuteState,
  setChannelGain,
  type GainLike,
} from "./muteChannels.js";

function makeGains(count: number): GainLike[] {
  return Array.from({ length: count }, () => ({ gain: { value: 1 } }));
}

describe("setChannelGain", () => {
  it("sets gain to 0 when muting a channel", () => {
    const gains = makeGains(2);
    setChannelGain(gains, 0, true);
    expect(gains[0].gain.value).toBe(0);
    expect(gains[1].gain.value).toBe(1);
  });

  it("sets gain to 1 when unmuting a channel", () => {
    const gains = makeGains(2);
    gains[1].gain.value = 0;
    setChannelGain(gains, 1, false);
    expect(gains[1].gain.value).toBe(1);
  });

  it("is a no-op for out-of-range channels", () => {
    const gains = makeGains(2);
    expect(() => setChannelGain(gains, 99, true)).not.toThrow();
    expect(gains[0].gain.value).toBe(1);
    expect(gains[1].gain.value).toBe(1);
  });

  it("is a no-op when the gainNodes array is empty", () => {
    const gains: GainLike[] = [];
    expect(() => setChannelGain(gains, 0, true)).not.toThrow();
  });
});

describe("applyMuteState", () => {
  it("mutes channels whose mute-state entry is true", () => {
    const gains = makeGains(3);
    applyMuteState(gains, [true, false, true]);
    expect(gains[0].gain.value).toBe(0);
    expect(gains[1].gain.value).toBe(1);
    expect(gains[2].gain.value).toBe(0);
  });

  it("treats missing entries in muteState as unmuted", () => {
    const gains = makeGains(3);
    gains[2].gain.value = 0;
    applyMuteState(gains, [true]);
    expect(gains[0].gain.value).toBe(0);
    expect(gains[1].gain.value).toBe(1);
    // ch2 had been muted but the fresh application restores to unmuted
    expect(gains[2].gain.value).toBe(1);
  });

  it("ignores extra mute-state entries beyond the gainNodes length", () => {
    const gains = makeGains(1);
    expect(() => applyMuteState(gains, [false, true, true])).not.toThrow();
    expect(gains[0].gain.value).toBe(1);
  });

  it("does nothing when both arrays are empty", () => {
    const gains: GainLike[] = [];
    expect(() => applyMuteState(gains, [])).not.toThrow();
  });
});
