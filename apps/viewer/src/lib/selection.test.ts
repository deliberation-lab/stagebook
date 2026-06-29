import { describe, it, expect } from "vitest";
import { needsOverviewPicker } from "./selection";
import type { TreatmentFileType } from "stagebook";

// Both arrays are `any`-typed in the built .d.ts (altTemplateContext), so tsc
// can't catch a `.length`-on-undefined regression here — these tests are the
// guard. A treatments-only file (no `introSequences:`) AND an intro-only file
// (no `treatments:`) are both valid mid-development states and must not throw.
// (This computation crashed on treatments-only files; see #476/#479.)

function file(parts: Partial<TreatmentFileType>): TreatmentFileType {
  return parts as TreatmentFileType;
}

describe("needsOverviewPicker", () => {
  it("does not throw on a treatments-only file (no introSequences)", () => {
    expect(() =>
      needsOverviewPicker(file({ treatments: [{ name: "t1" }] as never })),
    ).not.toThrow();
  });

  it("is false for a single treatment and no intro sequences", () => {
    expect(
      needsOverviewPicker(file({ treatments: [{ name: "t1" }] as never })),
    ).toBe(false);
  });

  it("is true with 2+ treatments (even with no intro sequences)", () => {
    expect(
      needsOverviewPicker(
        file({ treatments: [{ name: "a" }, { name: "b" }] as never }),
      ),
    ).toBe(true);
  });

  it("does not throw on an intro-only file (no treatments)", () => {
    // The structure you preview while still building the intro, before any
    // treatment exists. Valid; symmetric to the treatments-only case.
    expect(() =>
      needsOverviewPicker(file({ introSequences: [{ name: "i1" }] as never })),
    ).not.toThrow();
  });

  it("is false for a single intro and no treatments", () => {
    expect(
      needsOverviewPicker(file({ introSequences: [{ name: "i1" }] as never })),
    ).toBe(false);
  });

  it("does not throw on an empty file (no intros, no treatments)", () => {
    expect(() => needsOverviewPicker(file({}))).not.toThrow();
    expect(needsOverviewPicker(file({}))).toBe(false);
  });

  it("is true with 2+ intro sequences", () => {
    expect(
      needsOverviewPicker(
        file({
          introSequences: [{ name: "i1" }, { name: "i2" }] as never,
          treatments: [{ name: "t1" }] as never,
        }),
      ),
    ).toBe(true);
  });
});
