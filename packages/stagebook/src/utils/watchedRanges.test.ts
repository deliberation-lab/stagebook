import { describe, it, expect } from "vitest";
import { computeWatchedRanges } from "./watchedRanges.js";
import type { VideoEvent } from "../components/elements/MediaPlayer.js";

function ev(type: VideoEvent["type"], videoTime: number): VideoEvent {
  return { type, videoTime, stageTimeElapsed: 0 };
}

describe("computeWatchedRanges", () => {
  it("returns empty array for no events", () => {
    expect(computeWatchedRanges([])).toEqual([]);
  });

  it("returns empty array for a lone play with no closing event", () => {
    expect(computeWatchedRanges([ev("play", 0)])).toEqual([]);
  });

  it("returns empty array for pause with no preceding play", () => {
    expect(computeWatchedRanges([ev("pause", 10)])).toEqual([]);
  });

  it("returns one interval for play → pause", () => {
    expect(computeWatchedRanges([ev("play", 5), ev("pause", 15)])).toEqual([
      [5, 15],
    ]);
  });

  it("returns one interval for play → ended", () => {
    expect(computeWatchedRanges([ev("play", 0), ev("ended", 30)])).toEqual([
      [0, 30],
    ]);
  });

  it("returns multiple disjoint intervals", () => {
    expect(
      computeWatchedRanges([
        ev("play", 0),
        ev("pause", 10),
        ev("play", 20),
        ev("pause", 30),
      ]),
    ).toEqual([
      [0, 10],
      [20, 30],
    ]);
  });

  it("merges overlapping intervals", () => {
    // Watched 0-15 and 10-25 → merged to 0-25
    expect(
      computeWatchedRanges([
        ev("play", 0),
        ev("pause", 15),
        ev("play", 10),
        ev("pause", 25),
      ]),
    ).toEqual([[0, 25]]);
  });

  it("merges adjacent intervals (touching endpoints)", () => {
    expect(
      computeWatchedRanges([
        ev("play", 0),
        ev("pause", 10),
        ev("play", 10),
        ev("pause", 20),
      ]),
    ).toEqual([[0, 20]]);
  });

  it("merges three overlapping intervals into one", () => {
    expect(
      computeWatchedRanges([
        ev("play", 0),
        ev("pause", 20),
        ev("play", 5),
        ev("pause", 30),
        ev("play", 15),
        ev("pause", 40),
      ]),
    ).toEqual([[0, 40]]);
  });

  it("excludes an open play (no closing pause/ended) at the end", () => {
    // Disconnected mid-playback — open interval not included
    expect(
      computeWatchedRanges([
        ev("play", 0),
        ev("pause", 10),
        ev("play", 20), // never closed
      ]),
    ).toEqual([[0, 10]]);
  });

  it("ignores stopAt events (not play/pause/ended)", () => {
    expect(
      computeWatchedRanges([ev("play", 0), ev("stopAt", 15), ev("pause", 15)]),
    ).toEqual([[0, 15]]);
  });

  it("handles play → ended followed by another play → pause", () => {
    expect(
      computeWatchedRanges([
        ev("play", 0),
        ev("ended", 30),
        ev("play", 0),
        ev("pause", 20),
      ]),
    ).toEqual([[0, 30]]);
  });

  it("returns intervals sorted by start time", () => {
    // Events arrive out of order (e.g. after scrub)
    expect(
      computeWatchedRanges([
        ev("play", 50),
        ev("pause", 60),
        ev("play", 10),
        ev("pause", 20),
      ]),
    ).toEqual([
      [10, 20],
      [50, 60],
    ]);
  });
});
