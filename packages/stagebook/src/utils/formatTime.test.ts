import { describe, it, expect } from "vitest";
import { formatTime } from "./formatTime.js";

describe("formatTime", () => {
  it("formats zero as 0:00", () => {
    expect(formatTime(0)).toBe("0:00");
  });

  it("formats seconds under a minute", () => {
    expect(formatTime(5)).toBe("0:05");
    expect(formatTime(59)).toBe("0:59");
  });

  it("formats exactly one minute", () => {
    expect(formatTime(60)).toBe("1:00");
  });

  it("formats minutes and seconds", () => {
    expect(formatTime(65)).toBe("1:05");
    expect(formatTime(125)).toBe("2:05");
  });

  it("formats exactly one hour", () => {
    expect(formatTime(3600)).toBe("1:00:00");
  });

  it("formats hours, minutes, and seconds", () => {
    expect(formatTime(3661)).toBe("1:01:01");
    expect(formatTime(7384)).toBe("2:03:04");
  });

  it("pads minutes to two digits when hours are present", () => {
    expect(formatTime(3605)).toBe("1:00:05");
  });

  it("handles non-finite input as 0:00", () => {
    expect(formatTime(NaN)).toBe("0:00");
    expect(formatTime(Infinity)).toBe("0:00");
  });

  it("handles fractional seconds by flooring", () => {
    expect(formatTime(65.9)).toBe("1:05");
  });
});
