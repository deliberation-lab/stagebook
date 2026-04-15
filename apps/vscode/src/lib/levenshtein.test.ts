import { describe, it, expect } from "vitest";
import { levenshtein, findClosestMatch } from "./levenshtein";

describe("levenshtein", () => {
  it("returns 0 for identical strings", () => {
    expect(levenshtein("abc", "abc")).toBe(0);
  });

  it("returns the length of the other string when one is empty", () => {
    expect(levenshtein("", "abc")).toBe(3);
    expect(levenshtein("abc", "")).toBe(3);
  });

  it("returns 1 for a single substitution", () => {
    expect(levenshtein("cat", "car")).toBe(1);
  });

  it("returns 1 for a single insertion", () => {
    expect(levenshtein("cat", "cats")).toBe(1);
  });

  it("returns 1 for a single deletion", () => {
    expect(levenshtein("cats", "cat")).toBe(1);
  });

  it("returns 0 for both empty strings", () => {
    expect(levenshtein("", "")).toBe(0);
  });

  it("is symmetric", () => {
    expect(levenshtein("kitten", "sitting")).toBe(
      levenshtein("sitting", "kitten"),
    );
  });

  it("handles multi-operation edits", () => {
    expect(levenshtein("kitten", "sitting")).toBe(3);
  });

  it("handles a realistic file path typo", () => {
    expect(
      levenshtein(
        "prompts/icebreaker.prompt.md",
        "prompts/ice_breaker.prompt.md",
      ),
    ).toBe(1);
  });
});

describe("findClosestMatch", () => {
  const candidates = [
    "prompts/ice_breaker.prompt.md",
    "prompts/consent.prompt.md",
    "prompts/debrief.prompt.md",
    "projects/config.yaml",
  ];

  it("finds the closest match within the distance threshold", () => {
    const result = findClosestMatch("prompts/icebreaker.prompt.md", candidates);
    expect(result).toBe("prompts/ice_breaker.prompt.md");
  });

  it("returns null when no match is within the threshold", () => {
    const result = findClosestMatch("totally/different/path.md", candidates);
    expect(result).toBeNull();
  });

  it("returns the closest when multiple are within threshold", () => {
    const result = findClosestMatch("prompts/consnt.prompt.md", candidates);
    expect(result).toBe("prompts/consent.prompt.md");
  });

  it("returns null for an empty candidates list", () => {
    const result = findClosestMatch("anything", []);
    expect(result).toBeNull();
  });

  it("returns exact match (distance 0)", () => {
    const result = findClosestMatch("prompts/consent.prompt.md", candidates);
    expect(result).toBe("prompts/consent.prompt.md");
  });

  it("rejects match at exactly the threshold (distance < maxDistance)", () => {
    // "abcde" vs "fghij" has distance 5 — should be rejected with maxDistance=5
    const result = findClosestMatch("abcde", ["fghij"], 5);
    expect(result).toBeNull();
  });

  it("accepts match just under the threshold", () => {
    // "abcd" vs "abce" has distance 1 — should be accepted with maxDistance=2
    const result = findClosestMatch("abcd", ["abce"], 2);
    expect(result).toBe("abce");
  });
});
