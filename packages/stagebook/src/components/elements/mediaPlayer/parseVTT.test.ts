import { describe, it, expect } from "vitest";
import { parseVTT } from "./parseVTT.js";

describe("parseVTT", () => {
  describe("basic parsing", () => {
    it("parses a single cue", () => {
      const vtt = `WEBVTT

00:00:01.000 --> 00:00:04.000
Hello world`;
      expect(parseVTT(vtt)).toEqual([
        { startTime: 1, endTime: 4, text: "Hello world" },
      ]);
    });

    it("parses multiple cues", () => {
      const vtt = `WEBVTT

00:00:01.000 --> 00:00:04.000
First line

00:00:05.000 --> 00:00:08.000
Second line`;
      expect(parseVTT(vtt)).toEqual([
        { startTime: 1, endTime: 4, text: "First line" },
        { startTime: 5, endTime: 8, text: "Second line" },
      ]);
    });

    it("parses cues with cue identifiers (numeric or text labels)", () => {
      const vtt = `WEBVTT

1
00:00:01.000 --> 00:00:04.000
Cue with identifier

intro
00:00:05.000 --> 00:00:08.000
Named cue`;
      expect(parseVTT(vtt)).toEqual([
        { startTime: 1, endTime: 4, text: "Cue with identifier" },
        { startTime: 5, endTime: 8, text: "Named cue" },
      ]);
    });
  });

  describe("time format handling", () => {
    it("parses timestamps without hours (mm:ss.mmm)", () => {
      const vtt = `WEBVTT

01:23.456 --> 02:34.789
Short format`;
      expect(parseVTT(vtt)).toEqual([
        { startTime: 83.456, endTime: 154.789, text: "Short format" },
      ]);
    });

    it("parses timestamps with hours (hh:mm:ss.mmm)", () => {
      const vtt = `WEBVTT

01:00:00.000 --> 01:00:05.000
One hour in`;
      expect(parseVTT(vtt)).toEqual([
        { startTime: 3600, endTime: 3605, text: "One hour in" },
      ]);
    });
  });

  describe("multiline cues", () => {
    it("joins multiline text with newline", () => {
      const vtt = `WEBVTT

00:00:01.000 --> 00:00:04.000
Line one
Line two
Line three`;
      expect(parseVTT(vtt)).toEqual([
        { startTime: 1, endTime: 4, text: "Line one\nLine two\nLine three" },
      ]);
    });
  });

  describe("edge cases", () => {
    it("returns empty array for empty string", () => {
      expect(parseVTT("")).toEqual([]);
    });

    it("returns empty array for WEBVTT header with no cues", () => {
      expect(parseVTT("WEBVTT\n")).toEqual([]);
    });

    it("strips UTF-8 BOM if present", () => {
      const vtt = `\uFEFFWEBVTT

00:00:01.000 --> 00:00:04.000
BOM test`;
      expect(parseVTT(vtt)).toEqual([
        { startTime: 1, endTime: 4, text: "BOM test" },
      ]);
    });

    it("handles Windows-style CRLF line endings", () => {
      const vtt = "WEBVTT\r\n\r\n00:00:01.000 --> 00:00:04.000\r\nCRLF test";
      expect(parseVTT(vtt)).toEqual([
        { startTime: 1, endTime: 4, text: "CRLF test" },
      ]);
    });

    it("handles overlapping cue timestamps (returns both, no merging)", () => {
      const vtt = `WEBVTT

00:00:01.000 --> 00:00:05.000
First

00:00:03.000 --> 00:00:07.000
Overlapping`;
      expect(parseVTT(vtt)).toEqual([
        { startTime: 1, endTime: 5, text: "First" },
        { startTime: 3, endTime: 7, text: "Overlapping" },
      ]);
    });

    it("skips NOTE blocks", () => {
      const vtt = `WEBVTT

NOTE This is a comment

00:00:01.000 --> 00:00:04.000
After note`;
      expect(parseVTT(vtt)).toEqual([
        { startTime: 1, endTime: 4, text: "After note" },
      ]);
    });

    it("skips STYLE blocks", () => {
      const vtt = `WEBVTT

STYLE
::cue { color: white; }

00:00:01.000 --> 00:00:04.000
After style`;
      expect(parseVTT(vtt)).toEqual([
        { startTime: 1, endTime: 4, text: "After style" },
      ]);
    });

    it("returns empty array for malformed/non-VTT content", () => {
      expect(parseVTT("not a vtt file")).toEqual([]);
    });
  });
});
