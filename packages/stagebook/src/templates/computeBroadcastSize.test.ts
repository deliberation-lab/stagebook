/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import { expect, test } from "vitest";
import { computeBroadcastSize, fillTemplates } from "./fillTemplates.js";

// ----------------------------------------------------------------
// Basic cases
// ----------------------------------------------------------------

test("template context without broadcast returns 1", () => {
  const templates = [
    { templateName: "simple", templateContent: { val: "${x}" } },
  ];

  const size = computeBroadcastSize({
    obj: { template: "simple", fields: { x: "hello" } },
    templates,
  });
  expect(size).toBe(1);
});

test("single broadcast dimension returns its length", () => {
  const templates = [{ templateName: "t", templateContent: { val: "${v}" } }];

  const size = computeBroadcastSize({
    obj: {
      template: "t",
      broadcast: { d0: [{ v: "a" }, { v: "b" }, { v: "c" }] },
    },
    templates,
  });
  expect(size).toBe(3);
});

test("multiple broadcast dimensions returns cartesian product", () => {
  const templates = [
    { templateName: "t", templateContent: { A: "${A}", B: "${B}" } },
  ];

  const size = computeBroadcastSize({
    obj: {
      template: "t",
      broadcast: {
        d0: [{ A: "A0" }, { A: "A1" }, { A: "A2" }],
        d1: [{ B: "B0" }, { B: "B1" }],
      },
    },
    templates,
  });
  expect(size).toBe(6);
});

test("three broadcast dimensions multiplies all", () => {
  const templates = [
    { templateName: "t", templateContent: { a: "${a}", b: "${b}", c: "${c}" } },
  ];

  const size = computeBroadcastSize({
    obj: {
      template: "t",
      broadcast: {
        d0: [{ a: 1 }, { a: 2 }],
        d1: [{ b: 1 }, { b: 2 }, { b: 3 }],
        d2: [{ c: 1 }, { c: 2 }, { c: 3 }, { c: 4 }],
      },
    },
    templates,
  });
  expect(size).toBe(24);
});

// ----------------------------------------------------------------
// Array of template contexts
// ----------------------------------------------------------------

test("array of template contexts sums broadcast sizes", () => {
  const templates = [{ templateName: "t", templateContent: { val: "${v}" } }];

  const size = computeBroadcastSize({
    obj: [
      {
        template: "t",
        broadcast: { d0: [{ v: "a" }, { v: "b" }] },
      },
      {
        template: "t",
        broadcast: { d0: [{ v: "x" }, { v: "y" }, { v: "z" }] },
      },
    ],
    templates,
  });
  expect(size).toBe(5);
});

test("array mixing broadcast and non-broadcast contexts", () => {
  const templates = [{ templateName: "t", templateContent: { val: "${v}" } }];

  const size = computeBroadcastSize({
    obj: [
      { template: "t", fields: { v: "plain" } },
      {
        template: "t",
        broadcast: { d0: [{ v: "a" }, { v: "b" }, { v: "c" }] },
      },
    ],
    templates,
  });
  expect(size).toBe(4);
});

// ----------------------------------------------------------------
// Broadcast dimensions from template references
// ----------------------------------------------------------------

test("broadcast dimension from template reference counts correctly", () => {
  const templates = [
    { templateName: "t", templateContent: { A: "${A}", B: "${B}" } },
    {
      templateName: "broadcastList",
      templateContent: [{ A: "A0" }, { A: "A1" }, { A: "A2" }],
    },
  ];

  const size = computeBroadcastSize({
    obj: {
      template: "t",
      broadcast: {
        d0: { template: "broadcastList" },
        d1: [{ B: "B0" }, { B: "B1" }],
      },
    },
    templates,
  });
  expect(size).toBe(6);
});

// ----------------------------------------------------------------
// Edge cases
// ----------------------------------------------------------------

test("plain object without template returns 1", () => {
  const size = computeBroadcastSize({
    obj: { name: "plain", value: 42 },
    templates: [],
  });
  expect(size).toBe(1);
});

test("single-item broadcast dimension returns 1", () => {
  const templates = [{ templateName: "t", templateContent: { val: "${v}" } }];

  const size = computeBroadcastSize({
    obj: {
      template: "t",
      broadcast: { d0: [{ v: "only" }] },
    },
    templates,
  });
  expect(size).toBe(1);
});

test("matches fillTemplates output length", () => {
  const templates = [
    {
      templateName: "rating",
      templateContent: {
        name: "rate_${dimension}",
        A: "${A}",
      },
    },
  ];

  const obj = {
    template: "rating",
    broadcast: {
      d0: [{ A: "A0" }, { A: "A1" }, { A: "A2" }],
      d1: [
        { dimension: "engagement" },
        { dimension: "confidence" },
        { dimension: "clarity" },
        { dimension: "relevance" },
      ],
    },
  };

  const size = computeBroadcastSize({ obj, templates });
  const { result } = fillTemplates({ obj, templates });
  expect(size).toBe((result as unknown[]).length);
});

test("throws when broadcast dimension resolves to non-array", () => {
  const templates = [
    { templateName: "t", templateContent: { val: "${v}" } },
    { templateName: "notAnArray", templateContent: { v: "oops" } },
  ];

  expect(() =>
    computeBroadcastSize({
      obj: {
        template: "t",
        broadcast: { d0: { template: "notAnArray" } },
      },
      templates,
    }),
  ).toThrow('Broadcast dimension "d0" resolved to object, expected an array');
});
