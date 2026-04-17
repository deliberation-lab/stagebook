import { describe, test, expect } from "vitest";
import { getReferenceKeyAndPath, getNestedValueByPath } from "./reference.js";

// ----------- getReferenceKeyAndPath ------------

describe("getReferenceKeyAndPath", () => {
  test("survey reference", () => {
    const result = getReferenceKeyAndPath("survey.bigFive.result.score");
    expect(result.referenceKey).toBe("survey_bigFive");
    expect(result.path).toEqual(["result", "score"]);
  });

  test("submitButton reference", () => {
    const result = getReferenceKeyAndPath("submitButton.continue.time");
    expect(result.referenceKey).toBe("submitButton_continue");
    expect(result.path).toEqual(["time"]);
  });

  test("qualtrics reference", () => {
    const result = getReferenceKeyAndPath("qualtrics.mySurvey.responses.Q1");
    expect(result.referenceKey).toBe("qualtrics_mySurvey");
    expect(result.path).toEqual(["responses", "Q1"]);
  });

  test("prompt reference defaults path to ['value']", () => {
    const result = getReferenceKeyAndPath("prompt.myQuestion");
    expect(result.referenceKey).toBe("prompt_myQuestion");
    expect(result.path).toEqual(["value"]);
  });

  test("trackedLink reference", () => {
    const result = getReferenceKeyAndPath("trackedLink.followUp.events");
    expect(result.referenceKey).toBe("trackedLink_followUp");
    expect(result.path).toEqual(["events"]);
  });

  test("urlParams reference", () => {
    const result = getReferenceKeyAndPath("urlParams.condition");
    expect(result.referenceKey).toBe("urlParams");
    expect(result.path).toEqual(["condition"]);
  });

  test("connectionInfo reference", () => {
    const result = getReferenceKeyAndPath("connectionInfo.country");
    expect(result.referenceKey).toBe("connectionInfo");
    expect(result.path).toEqual(["country"]);
  });

  test("browserInfo reference", () => {
    const result = getReferenceKeyAndPath("browserInfo.name");
    expect(result.referenceKey).toBe("browserInfo");
    expect(result.path).toEqual(["name"]);
  });

  test("participantInfo reference", () => {
    // participantInfo uses the same flat-namespace pattern as connectionInfo
    // and browserInfo — stored under a single `participantInfo` key with
    // the field addressed via the nested path.
    const result = getReferenceKeyAndPath("participantInfo.name");
    expect(result.referenceKey).toBe("participantInfo");
    expect(result.path).toEqual(["name"]);
  });

  test("participantInfo reference with deep path", () => {
    const result = getReferenceKeyAndPath("participantInfo.sampleId.raw");
    expect(result.referenceKey).toBe("participantInfo");
    expect(result.path).toEqual(["sampleId", "raw"]);
  });

  test("timeline reference", () => {
    const result = getReferenceKeyAndPath("timeline.myAnnotations");
    expect(result.referenceKey).toBe("timeline_myAnnotations");
    expect(result.path).toEqual([]);
  });

  test("discussion reference", () => {
    const result = getReferenceKeyAndPath("discussion.main.messageCount");
    expect(result.referenceKey).toBe("main");
    expect(result.path).toEqual(["messageCount"]);
  });

  test("throws on invalid reference type", () => {
    expect(() => getReferenceKeyAndPath("duck.quack")).toThrow(
      "Invalid reference type: duck",
    );
  });

  test("throws on missing name segment", () => {
    expect(() => getReferenceKeyAndPath("survey")).toThrow();
  });
});

// ----------- getNestedValueByPath ------------

describe("getNestedValueByPath", () => {
  test("traverses nested object", () => {
    const obj = { a: { b: { c: 42 } } };
    expect(getNestedValueByPath(obj, ["a", "b", "c"])).toBe(42);
  });

  test("returns undefined for missing path", () => {
    const obj = { a: { b: 1 } };
    expect(getNestedValueByPath(obj, ["a", "x", "y"])).toBeUndefined();
  });

  test("empty path returns the object itself", () => {
    const obj = { a: 1 };
    expect(getNestedValueByPath(obj, [])).toEqual({ a: 1 });
  });

  test("default path is empty array", () => {
    const obj = { a: 1 };
    expect(getNestedValueByPath(obj)).toEqual({ a: 1 });
  });

  test("rejects prototype-polluting path segments", () => {
    // Arbitrary reference paths must not be able to traverse into
    // Object.prototype — these segments are denied even if present.
    const obj = {};
    expect(getNestedValueByPath(obj, ["__proto__"])).toBeUndefined();
    expect(getNestedValueByPath(obj, ["constructor"])).toBeUndefined();
    expect(getNestedValueByPath(obj, ["prototype"])).toBeUndefined();
    expect(
      getNestedValueByPath(obj, ["__proto__", "polluted"]),
    ).toBeUndefined();
  });
});
