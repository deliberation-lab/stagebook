import { describe, it, expect } from "vitest";
import { formatTime } from "./formatTime.js";
import { zoomDecimals } from "../components/elements/timeline/timelineStyles.js";

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

  it("shows tenths when decimals=1", () => {
    expect(formatTime(65.3, 1)).toBe("1:05.3");
    expect(formatTime(0, 1)).toBe("0:00.0");
    expect(formatTime(3661.7, 1)).toBe("1:01:01.7");
  });

  it("shows hundredths when decimals=2", () => {
    expect(formatTime(65.34, 2)).toBe("1:05.34");
    expect(formatTime(8.158, 2)).toBe("0:08.16");
    expect(formatTime(0, 2)).toBe("0:00.00");
  });

  it("truncates fractional digits (no carry into seconds)", () => {
    // 1.999 → ":01.9" not ":01.0" (which would happen if 0.999 rounded to 1.0)
    expect(formatTime(1.999, 1)).toBe("0:01.9");
    expect(formatTime(1.999, 2)).toBe("0:01.99");
    expect(formatTime(59.999, 1)).toBe("0:59.9");
  });
});

describe("zoomDecimals", () => {
  it("returns 1 (tenths) at zoom level 1", () => {
    expect(zoomDecimals(1)).toBe(1);
  });

  it("returns 1 (tenths) below zoom 2", () => {
    expect(zoomDecimals(1.5)).toBe(1);
  });

  it("returns 2 (hundredths) at zoom 2 and above", () => {
    expect(zoomDecimals(2)).toBe(2);
    expect(zoomDecimals(4)).toBe(2);
    expect(zoomDecimals(10)).toBe(2);
  });
});
