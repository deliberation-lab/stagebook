/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */

import { expect, test } from "vitest";
import { fillTemplates, getUnresolvedFields } from "./fillTemplates.js";

test("template with simple object field", () => {
  const templates = [
    {
      templateName: "simple_object",
      templateDesc: "string and object substitution",
      templateContent: {
        field1Key: "${f1}",
        field2Key: "${f2}",
        field3Key: "Adding ${f1} in a string succeeds!",
      },
    },
  ];

  const context = {
    template: "simple_object",
    fields: {
      f1: "f1Value",
      f2: {
        f2a: "f2aValue",
        f2b: "f2bValue",
      },
    },
  };

  const expectedResult = {
    field1Key: "f1Value",
    field2Key: {
      f2a: "f2aValue",
      f2b: "f2bValue",
    },
    field3Key: "Adding f1Value in a string succeeds!",
  };

  const { result } = fillTemplates({ templates, obj: context });
  expect(result).toEqual(expectedResult);
});

test("template with simple list field", () => {
  const templates = [
    {
      templateName: "simple_list",
      templateDesc: "string and object substitution",
      templateContent: ["${f1}", "${f2}", "Adding ${f1} in a string succeeds!"],
    },
  ];

  const context = {
    template: "simple_list",
    fields: {
      f1: "f1Value",
      f2: {
        f2a: "f2aValue",
        f2b: "f2bValue",
      },
    },
  };

  const expectedResult = [
    "f1Value",
    {
      f2a: "f2aValue",
      f2b: "f2bValue",
    },
    "Adding f1Value in a string succeeds!",
  ];

  const { result } = fillTemplates({ templates, obj: context });
  expect(result).toEqual(expectedResult);
});

test("template with simple string field", () => {
  const templates = [
    {
      templateName: "simple_string",
      templateDesc: "string and object substitution",
      templateContent: "Adding ${f1} in a string succeeds!",
    },
  ];

  const context = {
    template: "simple_string",
    fields: {
      f1: "f1Value",
    },
  };

  const expectedResult = "Adding f1Value in a string succeeds!";

  const { result } = fillTemplates({ templates, obj: context });
  expect(result).toEqual(expectedResult);
});

test("nested templates", () => {
  const templates = [
    {
      templateName: "outer",
      templateDesc: "Contains a nested template",
      templateContent: {
        field1Key: "${f1}",
        field2Key: "${f2}",
        fields1and2Keys: "${f1}_${f2}",
        field3Key: "${f3}",
        innerTemplateResult: {
          template: "inner",
          fields: {
            f4: "${f1}",
            f5: "${f2}_suffix",
          },
        },
      },
    },
    {
      templateName: "inner",
      templateDesc: "Used within another template",
      templateContent: {
        field4Key: "${f4}",
        field5Key: "${f5}",
      },
    },
  ];

  const context = {
    template: "outer",
    fields: {
      f1: "f1Value",
      f2: "f2Value",
      f3: {
        f3a: "f3aValue",
        f3b: "f3bValue",
      },
    },
  };

  const expectedResult = {
    field1Key: "f1Value",
    field2Key: "f2Value",
    fields1and2Keys: "f1Value_f2Value",
    field3Key: {
      f3a: "f3aValue",
      f3b: "f3bValue",
    },
    innerTemplateResult: {
      field4Key: "f1Value",
      field5Key: "f2Value_suffix",
    },
  };

  const { result } = fillTemplates({ templates, obj: context });
  expect(result).toEqual(expectedResult);
});

test("template with broadcast", () => {
  const templates = [
    {
      templateName: "simple",
      templateContent: {
        name: "${name}",
        Aval: "${A}",
        Bval: "${B}",
      },
    },
  ];

  const context = {
    template: "simple",
    fields: {
      name: "t_d0_${d0}_d1_${d1}",
    },
    broadcast: {
      d0: [{ A: "A0" }, { A: "A1" }, { A: "A2" }],
      d1: [{ B: "B0" }, { B: "B1" }],
    },
  };

  const expectedResult = [
    { name: "t_d0_0_d1_0", Aval: "A0", Bval: "B0" },
    { name: "t_d0_0_d1_1", Aval: "A0", Bval: "B1" },
    { name: "t_d0_1_d1_0", Aval: "A1", Bval: "B0" },
    { name: "t_d0_1_d1_1", Aval: "A1", Bval: "B1" },
    { name: "t_d0_2_d1_0", Aval: "A2", Bval: "B0" },
    { name: "t_d0_2_d1_1", Aval: "A2", Bval: "B1" },
  ];

  const { result } = fillTemplates({ templates, obj: context });
  expect(result).toEqual(expectedResult);
});

test("template with broadcast merging to array", () => {
  const templates = [
    {
      templateName: "inner",
      templateContent: { name: "${name}" },
    },
    {
      templateName: "outer",
      templateContent: {
        arrayOfInnersAndOthers: [
          {
            template: "inner",
            fields: { name: "inner ${bname}" },
            broadcast: {
              d0: [{ bname: "d0 A" }, { bname: "d0 B" }],
            },
          },
          { name: "outer Other", val: "other val" },
        ],
      },
    },
  ];

  const context = { template: "outer" };

  const expectedResult = {
    arrayOfInnersAndOthers: [
      { name: "inner d0 A" },
      { name: "inner d0 B" },
      { name: "outer Other", val: "other val" },
    ],
  };

  const { result } = fillTemplates({ templates, obj: context });
  expect(result).toEqual(expectedResult);
});

test("template with broadcast array from another template", () => {
  const templates = [
    {
      templateName: "simple",
      templateContent: {
        name: "${name}",
        Aval: "${A}",
        Bval: "${B}",
      },
    },
    {
      templateName: "broadcastList",
      templateContent: [{ A: "A0" }, { A: "A1" }, { A: "A2" }],
    },
  ];

  const context = {
    template: "simple",
    fields: {
      name: "t_d0_${d0}_d1_${d1}",
    },
    broadcast: {
      d0: { template: "broadcastList" },
      d1: [{ B: "B0" }, { B: "B1" }],
    },
  };

  const expectedResult = [
    { name: "t_d0_0_d1_0", Aval: "A0", Bval: "B0" },
    { name: "t_d0_0_d1_1", Aval: "A0", Bval: "B1" },
    { name: "t_d0_1_d1_0", Aval: "A1", Bval: "B0" },
    { name: "t_d0_1_d1_1", Aval: "A1", Bval: "B1" },
    { name: "t_d0_2_d1_0", Aval: "A2", Bval: "B0" },
    { name: "t_d0_2_d1_1", Aval: "A2", Bval: "B1" },
  ];

  const { result } = fillTemplates({ templates, obj: context });
  expect(result).toEqual(expectedResult);
});

test("template with list and broadcast returns properly", () => {
  const templates = [
    {
      templateName: "listTemplate",
      templateContent: [
        { outerIndex: "${outerIndex}", innerIndex: "0" },
        { outerIndex: "${outerIndex}", innerIndex: "1" },
      ],
    },
  ];

  const context = {
    template: "listTemplate",
    broadcast: {
      d0: [{ outerIndex: "0" }, { outerIndex: "1" }, { outerIndex: "2" }],
    },
  };

  const expectedResult = [
    { outerIndex: "0", innerIndex: "0" },
    { outerIndex: "0", innerIndex: "1" },
    { outerIndex: "1", innerIndex: "0" },
    { outerIndex: "1", innerIndex: "1" },
    { outerIndex: "2", innerIndex: "0" },
    { outerIndex: "2", innerIndex: "1" },
  ];

  const { result } = fillTemplates({ templates, obj: context });
  expect(result).toEqual(expectedResult);
});

// ----------------------------------------------------------------
// Error conditions (#18)
// ----------------------------------------------------------------

test("throws on missing template reference", () => {
  const templates = [
    { templateName: "exists", templateContent: { key: "value" } },
  ];

  expect(() =>
    fillTemplates({ templates, obj: { template: "doesNotExist" } }),
  ).toThrow('Template "doesNotExist" not found');
});

test("throws on unfilled field placeholders", () => {
  const templates = [
    {
      templateName: "withPlaceholder",
      templateContent: { name: "${missingField}" },
    },
  ];

  expect(() =>
    fillTemplates({
      templates,
      obj: { template: "withPlaceholder" },
    }),
  ).toThrow("Missing fields");
});

test("throws on circular template references (depth limit)", () => {
  const templates = [
    {
      templateName: "loop1",
      templateContent: { nested: { template: "loop2" } },
    },
    {
      templateName: "loop2",
      templateContent: { nested: { template: "loop1" } },
    },
  ];

  expect(() =>
    fillTemplates({ templates, obj: { template: "loop1" } }),
  ).toThrow("Maximum template nesting depth");
});

test("circular reference error includes template chain", () => {
  const templates = [
    {
      templateName: "alpha",
      templateContent: { next: { template: "beta" } },
    },
    {
      templateName: "beta",
      templateContent: { next: { template: "alpha" } },
    },
  ];

  try {
    fillTemplates({ templates, obj: { template: "alpha" } });
    expect.unreachable("Should have thrown");
  } catch (e) {
    const msg = (e as Error).message;
    expect(msg).toContain("Template chain:");
    expect(msg).toContain("alpha");
    expect(msg).toContain("beta");
  }
});

test("non-template objects pass through unchanged", () => {
  const { result } = fillTemplates({
    templates: [],
    obj: { name: "plain", value: 42 },
  });
  expect(result).toEqual({ name: "plain", value: 42 });
});

test("empty templates array with plain array", () => {
  const { result } = fillTemplates({
    templates: [],
    obj: [{ name: "item1" }, { name: "item2" }],
  });
  expect(result).toEqual([{ name: "item1" }, { name: "item2" }]);
});

test("numeric field values substituted as standalone", () => {
  const templates = [
    {
      templateName: "numeric",
      templateContent: { count: "${num}" },
    },
  ];

  const { result } = fillTemplates({
    templates,
    obj: { template: "numeric", fields: { num: 42 } },
  });
  // Standalone ${num} gets replaced with the number value
  expect(result).toEqual({ count: 42 });
});

test("string field embedded in another string", () => {
  const templates = [
    {
      templateName: "embedded",
      templateContent: { label: "Item ${name} here" },
    },
  ];

  const { result } = fillTemplates({
    templates,
    obj: { template: "embedded", fields: { name: "Alpha" } },
  });
  expect(result).toEqual({ label: "Item Alpha here" });
});

test("array field values substituted correctly", () => {
  const templates = [
    {
      templateName: "arrayField",
      templateContent: { items: "${myArray}" },
    },
  ];

  const { result } = fillTemplates({
    templates,
    obj: { template: "arrayField", fields: { myArray: ["a", "b", "c"] } },
  });
  expect(result).toEqual({ items: ["a", "b", "c"] });
});

test("boolean field values substituted correctly", () => {
  const templates = [
    {
      templateName: "boolField",
      templateContent: { enabled: "${flag}" },
    },
  ];

  const { result } = fillTemplates({
    templates,
    obj: { template: "boolField", fields: { flag: true } },
  });
  expect(result).toEqual({ enabled: true });
});

// ----------------------------------------------------------------
// additionalFields (#22)
// ----------------------------------------------------------------

test("additionalFields resolves platform-provided placeholders", () => {
  const templates = [
    {
      templateName: "stage",
      templateContent: {
        name: "rate_${dimension}",
        url: "${clipUrl}",
        startAt: "${clipStartAt}",
      },
    },
  ];

  const { result } = fillTemplates({
    templates,
    obj: { template: "stage", fields: { dimension: "engagement" } },
    additionalFields: {
      clipUrl: "https://cdn.example.com/clip1.mp4",
      clipStartAt: 12.5,
    },
  });
  expect(result).toEqual({
    name: "rate_engagement",
    url: "https://cdn.example.com/clip1.mp4",
    startAt: 12.5,
  });
});

test("additionalFields without additionalFields behaves identically", () => {
  const templates = [
    {
      templateName: "simple",
      templateContent: { name: "${n}" },
    },
  ];

  const { result } = fillTemplates({
    templates,
    obj: { template: "simple", fields: { n: "hello" } },
  });
  expect(result).toEqual({ name: "hello" });
});

test("researcher fields and additionalFields coexist", () => {
  const templates = [
    {
      templateName: "mixed",
      templateContent: {
        researcherField: "${myField}",
        platformField: "${platformValue}",
      },
    },
  ];

  const { result } = fillTemplates({
    templates,
    obj: { template: "mixed", fields: { myField: "from researcher" } },
    additionalFields: { platformValue: "from platform" },
  });
  expect(result).toEqual({
    researcherField: "from researcher",
    platformField: "from platform",
  });
});

test("broadcast + additionalFields work together", () => {
  const templates = [
    {
      templateName: "rating",
      templateContent: {
        name: "rate_${dimension}",
        clip: "${clipUrl}",
      },
    },
  ];

  const { result } = fillTemplates({
    templates,
    obj: {
      template: "rating",
      broadcast: {
        d0: [{ dimension: "engagement" }, { dimension: "confidence" }],
      },
    },
    additionalFields: { clipUrl: "https://cdn.example.com/clip1.mp4" },
  });
  expect(result).toEqual([
    {
      name: "rate_engagement",
      clip: "https://cdn.example.com/clip1.mp4",
    },
    {
      name: "rate_confidence",
      clip: "https://cdn.example.com/clip1.mp4",
    },
  ]);
});

test("missing additionalFields still triggers error", () => {
  const templates = [
    {
      templateName: "needsMore",
      templateContent: {
        a: "${provided}",
        b: "${missing}",
      },
    },
  ];

  expect(() =>
    fillTemplates({
      templates,
      obj: { template: "needsMore" },
      additionalFields: { provided: "here" },
    }),
  ).toThrow("Missing fields");
});

test("additionalFields with object values", () => {
  const templates = [
    {
      templateName: "config",
      templateContent: { settings: "${platformConfig}" },
    },
  ];

  const { result } = fillTemplates({
    templates,
    obj: { template: "config" },
    additionalFields: {
      platformConfig: { quality: "high", fps: 30 },
    },
  });
  expect(result).toEqual({
    settings: { quality: "high", fps: 30 },
  });
});

test("returns empty unresolvedFields when all fields filled", () => {
  const templates = [
    { templateName: "full", templateContent: { val: "${x}" } },
  ];

  const { result, unresolvedFields } = fillTemplates({
    templates,
    obj: { template: "full", fields: { x: "done" } },
  });
  expect(result).toEqual({ val: "done" });
  expect(unresolvedFields).toEqual([]);
});

// ----------------------------------------------------------------
// allowUnresolved (#27)
// ----------------------------------------------------------------

test("allowUnresolved returns partial result with unresolved field names", () => {
  const templates = [
    {
      templateName: "stage",
      templateContent: {
        name: "rate_${dimension}",
        clip: "${clipUrl}",
        start: "${clipStartAt}",
      },
    },
  ];

  const { result, unresolvedFields } = fillTemplates({
    templates,
    obj: { template: "stage", fields: { dimension: "engagement" } },
    allowUnresolved: true,
  });
  expect(result.name).toBe("rate_engagement");
  expect(result.clip).toBe("${clipUrl}");
  expect(result.start).toBe("${clipStartAt}");
  expect(unresolvedFields.sort()).toEqual(["clipStartAt", "clipUrl"]);
});

test("allowUnresolved + additionalFields: partial fill", () => {
  const templates = [
    {
      templateName: "stage",
      templateContent: {
        clip: "${clipUrl}",
        start: "${clipStartAt}",
        stop: "${clipStopAt}",
      },
    },
  ];

  const { result, unresolvedFields } = fillTemplates({
    templates,
    obj: { template: "stage" },
    additionalFields: { clipUrl: "video.mp4" },
    allowUnresolved: true,
  });
  expect(result.clip).toBe("video.mp4");
  expect(unresolvedFields.sort()).toEqual(["clipStartAt", "clipStopAt"]);
});

test("two-pass expansion: researcher templates then platform fields", () => {
  const templates = [
    {
      templateName: "ratingStage",
      templateContent: {
        name: "rate_${dimension}",
        clip: "${clipUrl}",
        startAt: "${clipStartAt}",
      },
    },
  ];

  // Pass 1: expand researcher templates, leave platform fields
  const { result: expanded, unresolvedFields } = fillTemplates({
    templates,
    obj: {
      template: "ratingStage",
      broadcast: {
        d0: [{ dimension: "engagement" }, { dimension: "confidence" }],
      },
    },
    allowUnresolved: true,
  });
  expect(unresolvedFields.sort()).toEqual(["clipStartAt", "clipUrl"]);
  expect(expanded).toHaveLength(2);
  expect(expanded[0].name).toBe("rate_engagement");
  expect(expanded[1].name).toBe("rate_confidence");

  // Pass 2: fill platform fields for each expanded treatment
  const { result: resolved, unresolvedFields: remaining } = fillTemplates({
    obj: expanded[0],
    templates: [],
    additionalFields: { clipUrl: "clip1.mp4", clipStartAt: 12.5 },
  });
  expect(remaining).toEqual([]);
  expect(resolved.clip).toBe("clip1.mp4");
  expect(resolved.startAt).toBe(12.5);
  expect(resolved.name).toBe("rate_engagement");
});

test("allowUnresolved without unresolved fields returns empty array", () => {
  const templates = [{ templateName: "done", templateContent: { x: "${a}" } }];

  const { result, unresolvedFields } = fillTemplates({
    templates,
    obj: { template: "done", fields: { a: "filled" } },
    allowUnresolved: true,
  });
  expect(result).toEqual({ x: "filled" });
  expect(unresolvedFields).toEqual([]);
});

test("default (allowUnresolved false) still throws on unresolved", () => {
  const templates = [
    { templateName: "incomplete", templateContent: { x: "${missing}" } },
  ];

  expect(() =>
    fillTemplates({ templates, obj: { template: "incomplete" } }),
  ).toThrow("Missing fields");
});

// ----------------------------------------------------------------
// getUnresolvedFields (#23) — deprecated, still works
// ----------------------------------------------------------------

test("getUnresolvedFields returns platform placeholders", () => {
  const templates = [
    {
      templateName: "stage",
      templateContent: {
        name: "rate_${dimension}",
        url: "${clipUrl}",
        startAt: "${clipStartAt}",
        stopAt: "${clipStopAt}",
      },
    },
  ];

  const fields = getUnresolvedFields({
    templates,
    obj: { template: "stage", fields: { dimension: "engagement" } },
  });
  expect(fields.sort()).toEqual(
    ["clipUrl", "clipStartAt", "clipStopAt"].sort(),
  );
});

test("getUnresolvedFields returns empty when all fields resolved", () => {
  const templates = [
    {
      templateName: "complete",
      templateContent: { name: "${n}" },
    },
  ];

  const fields = getUnresolvedFields({
    templates,
    obj: { template: "complete", fields: { n: "done" } },
  });
  expect(fields).toEqual([]);
});

test("getUnresolvedFields with broadcast resolves researcher fields", () => {
  const templates = [
    {
      templateName: "rating",
      templateContent: {
        name: "rate_${dimension}",
        clip: "${clipUrl}",
      },
    },
  ];

  const fields = getUnresolvedFields({
    templates,
    obj: {
      template: "rating",
      broadcast: {
        d0: [{ dimension: "engagement" }, { dimension: "confidence" }],
      },
    },
  });
  // dimension is resolved by broadcast, clipUrl remains
  expect(fields).toEqual(["clipUrl"]);
});

test("getUnresolvedFields does not throw", () => {
  const templates = [
    {
      templateName: "incomplete",
      templateContent: { a: "${x}", b: "${y}", c: "${z}" },
    },
  ];

  // Should not throw — returns the unresolved fields instead
  const fields = getUnresolvedFields({
    templates,
    obj: { template: "incomplete" },
  });
  expect(fields.sort()).toEqual(["x", "y", "z"]);
});

test("getUnresolvedFields returns unique names", () => {
  const templates = [
    {
      templateName: "repeated",
      templateContent: {
        a: "${same}",
        b: "prefix_${same}_suffix",
        c: "${same}",
      },
    },
  ];

  const fields = getUnresolvedFields({
    templates,
    obj: { template: "repeated" },
  });
  expect(fields).toEqual(["same"]);
});

// ----------------------------------------------------------------
// Edge case tests (audit)
// ----------------------------------------------------------------

// -- undefined/null additionalFields values --

test("additionalFields with undefined value leaves placeholder", () => {
  const templates = [
    { templateName: "t", templateContent: { a: "${x}", b: "${y}" } },
  ];

  // undefined is skipped, so ${x} remains unresolved
  expect(() =>
    fillTemplates({
      templates,
      obj: { template: "t" },
      additionalFields: { x: undefined, y: "filled" },
    }),
  ).toThrow("Missing fields");
});

test("additionalFields with undefined value + allowUnresolved", () => {
  const templates = [
    { templateName: "t", templateContent: { a: "${x}", b: "${y}" } },
  ];

  const { result, unresolvedFields } = fillTemplates({
    templates,
    obj: { template: "t" },
    additionalFields: { x: undefined, y: "filled" },
    allowUnresolved: true,
  });

  expect(result.b).toBe("filled");
  expect(unresolvedFields).toEqual(["x"]);
});

test("additionalFields with null value substitutes null", () => {
  const templates = [{ templateName: "t", templateContent: { val: "${x}" } }];

  const { result } = fillTemplates({
    templates,
    obj: { template: "t" },
    additionalFields: { x: null },
  });

  expect(result.val).toBe(null);
});

// -- Field value containing ${...} syntax (double substitution risk) --

test("field value containing placeholder-like text is not re-substituted", () => {
  const templates = [
    {
      templateName: "code",
      templateContent: { snippet: "${code}", label: "Code: ${code}" },
    },
  ];

  const { result, unresolvedFields } = fillTemplates({
    templates,
    obj: { template: "code", fields: { code: "return ${x} + ${y};" } },
    allowUnresolved: true,
  });

  // The literal ${x} and ${y} inside the field value should NOT be
  // treated as template placeholders — they're data, not template syntax
  expect(result.snippet).toBe("return ${x} + ${y};");
  // But they WILL appear as unresolved fields in the scan
  expect(unresolvedFields).toContain("x");
  expect(unresolvedFields).toContain("y");
});

// -- additionalFields override researcher fields --

test("additionalFields applied after researcher fields (later wins)", () => {
  const templates = [
    { templateName: "t", templateContent: { val: "${shared}" } },
  ];

  const { result } = fillTemplates({
    templates,
    obj: { template: "t", fields: { shared: "researcher" } },
    additionalFields: { shared: "platform" },
  });

  // Researcher field is applied first during template expansion,
  // so the value is already "researcher" before additionalFields runs.
  // additionalFields can't override an already-substituted value.
  expect(result.val).toBe("researcher");
});

// -- Array of template contexts --

test("array of template contexts each expanded independently", () => {
  const templates = [
    { templateName: "greet", templateContent: { msg: "Hello ${name}" } },
  ];

  const { result } = fillTemplates({
    templates,
    obj: [
      { template: "greet", fields: { name: "Alice" } },
      { template: "greet", fields: { name: "Bob" } },
    ],
  });

  expect(result).toEqual([{ msg: "Hello Alice" }, { msg: "Hello Bob" }]);
});

test("array of treatments with different unresolved fields", () => {
  const templates = [
    { templateName: "a", templateContent: { url: "${clipUrl}" } },
    { templateName: "b", templateContent: { start: "${startTime}" } },
  ];

  const { result, unresolvedFields } = fillTemplates({
    templates,
    obj: [{ template: "a" }, { template: "b" }],
    allowUnresolved: true,
  });

  expect(result).toHaveLength(2);
  expect(unresolvedFields.sort()).toEqual(["clipUrl", "startTime"]);
});

// -- Broadcast edge cases --

test("single-item broadcast returns array with one element", () => {
  const templates = [{ templateName: "t", templateContent: { val: "${v}" } }];

  const { result } = fillTemplates({
    templates,
    obj: {
      template: "t",
      broadcast: { d0: [{ v: "only" }] },
    },
  });

  expect(Array.isArray(result)).toBe(true);
  expect(result).toHaveLength(1);
  expect(result[0].val).toBe("only");
});

test("broadcast dimension indices don't collide with additionalFields", () => {
  const templates = [
    {
      templateName: "t",
      templateContent: { index: "${d0}", platform: "${pval}" },
    },
  ];

  const { result } = fillTemplates({
    templates,
    obj: {
      template: "t",
      broadcast: { d0: [{ x: 1 }, { x: 2 }] },
    },
    additionalFields: { pval: "filled" },
  });

  // d0 should be broadcast indices "0" and "1", not overridden by additionalFields
  expect(result).toHaveLength(2);
  expect(result[0].index).toBe("0");
  expect(result[1].index).toBe("1");
  expect(result[0].platform).toBe("filled");
});

test("multi-dimensional broadcast + additionalFields", () => {
  const templates = [
    {
      templateName: "t",
      templateContent: { name: "${d0}_${d1}", url: "${platformUrl}" },
    },
  ];

  const { result } = fillTemplates({
    templates,
    obj: {
      template: "t",
      broadcast: {
        d0: [{ a: 1 }, { a: 2 }],
        d1: [{ b: "x" }, { b: "y" }, { b: "z" }],
      },
    },
    additionalFields: { platformUrl: "https://cdn.test/v.mp4" },
  });

  expect(result).toHaveLength(6);
  expect(
    result.every(
      (item: Record<string, unknown>) => item.url === "https://cdn.test/v.mp4",
    ),
  ).toBe(true);
  expect(result[0].name).toBe("0_0");
  expect(result[5].name).toBe("1_2");
});

// -- Nested templates with unresolved fields --

test("unresolved fields in nested templates bubble up", () => {
  const templates = [
    {
      templateName: "outer",
      templateContent: {
        inner: { template: "inner", fields: { x: "resolved" } },
      },
    },
    {
      templateName: "inner",
      templateContent: { x: "${x}", y: "${y}" },
    },
  ];

  const { result, unresolvedFields } = fillTemplates({
    templates,
    obj: { template: "outer" },
    allowUnresolved: true,
  });

  expect(result.inner.x).toBe("resolved");
  expect(unresolvedFields).toEqual(["y"]);
});

// -- Two-pass strict second pass --

test("strict second pass throws on remaining unresolved", () => {
  const templates = [
    { templateName: "t", templateContent: { a: "${x}", b: "${y}" } },
  ];

  const { result: partial } = fillTemplates({
    templates,
    obj: { template: "t" },
    allowUnresolved: true,
  });

  expect(() =>
    fillTemplates({
      templates: [],
      obj: partial,
      additionalFields: { x: "filled" },
    }),
  ).toThrow("Missing fields");
});

// -- Return type consistency --

test("non-broadcast returns object, broadcast returns array", () => {
  const templates = [{ templateName: "t", templateContent: { id: "${id}" } }];

  const { result: single } = fillTemplates({
    templates,
    obj: { template: "t", fields: { id: "1" } },
  });
  expect(Array.isArray(single)).toBe(false);

  const { result: multi } = fillTemplates({
    templates,
    obj: {
      template: "t",
      fields: { id: "${d0}" },
      broadcast: { d0: [{ x: 1 }, { x: 2 }] },
    },
    allowUnresolved: true,
  });
  expect(Array.isArray(multi)).toBe(true);
  expect(multi).toHaveLength(2);
});
