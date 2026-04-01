/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return */

import { expect, test } from "vitest";
import { fillTemplates } from "./fillTemplates.js";

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

  const result = fillTemplates({ templates, obj: context });
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

  const result = fillTemplates({ templates, obj: context });
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

  const result = fillTemplates({ templates, obj: context });
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

  const result = fillTemplates({ templates, obj: context });
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

  const result = fillTemplates({ templates, obj: context });
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

  const result = fillTemplates({ templates, obj: context });
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

  const result = fillTemplates({ templates, obj: context });
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

  const result = fillTemplates({ templates, obj: context });
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
  const result = fillTemplates({
    templates: [],
    obj: { name: "plain", value: 42 },
  });
  expect(result).toEqual({ name: "plain", value: 42 });
});

test("empty templates array with plain array", () => {
  const result = fillTemplates({
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

  const result = fillTemplates({
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

  const result = fillTemplates({
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

  const result = fillTemplates({
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

  const result = fillTemplates({
    templates,
    obj: { template: "boolField", fields: { flag: true } },
  });
  expect(result).toEqual({ enabled: true });
});
