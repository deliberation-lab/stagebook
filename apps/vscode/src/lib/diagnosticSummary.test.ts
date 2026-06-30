import { describe, it, expect } from "vitest";
import {
  summarizeDiagnostics,
  formatValidationStatusBar,
} from "./diagnosticSummary";

describe("summarizeDiagnostics", () => {
  it("returns zeros for no files", () => {
    expect(summarizeDiagnostics([])).toEqual({
      errors: 0,
      warnings: 0,
      filesWithDiagnostics: 0,
    });
  });

  it("counts errors and warnings across files", () => {
    expect(
      summarizeDiagnostics([
        ["error", "warning"],
        ["error"],
        ["warning", "warning"],
      ]),
    ).toEqual({ errors: 2, warnings: 3, filesWithDiagnostics: 3 });
  });

  it("ignores files with no diagnostics when counting affected files", () => {
    expect(summarizeDiagnostics([["error"], [], [], ["warning"]])).toEqual({
      errors: 1,
      warnings: 1,
      filesWithDiagnostics: 2,
    });
  });
});

describe("formatValidationStatusBar", () => {
  it("reports a clean run with no issues", () => {
    const { text } = formatValidationStatusBar(
      { errors: 0, warnings: 0, filesWithDiagnostics: 0 },
      12,
    );
    expect(text).toBe("$(check) Stagebook: no issues in 12 files");
  });

  it("pluralizes errors and warnings", () => {
    const { text } = formatValidationStatusBar(
      { errors: 2, warnings: 3, filesWithDiagnostics: 4 },
      30,
    );
    expect(text).toBe(
      "$(warning) Stagebook: 2 errors, 3 warnings across 30 files",
    );
  });

  it("uses singular forms for a single error/warning/file", () => {
    const { text } = formatValidationStatusBar(
      { errors: 1, warnings: 1, filesWithDiagnostics: 1 },
      1,
    );
    expect(text).toBe("$(warning) Stagebook: 1 error, 1 warning across 1 file");
  });

  it("mixes singular and plural nouns within one string", () => {
    const { text } = formatValidationStatusBar(
      { errors: 1, warnings: 2, filesWithDiagnostics: 2 },
      3,
    );
    expect(text).toBe(
      "$(warning) Stagebook: 1 error, 2 warnings across 3 files",
    );
  });

  it("tooltip distinguishes affected files from scanned files", () => {
    // 2 files have diagnostics out of 5 scanned — the tooltip must keep those
    // two counts distinct (the whole reason filesWithDiagnostics exists).
    const { tooltip } = formatValidationStatusBar(
      { errors: 3, warnings: 0, filesWithDiagnostics: 2 },
      5,
    );
    expect(tooltip).toContain("in 2 files");
    expect(tooltip).toContain("of 5 files scanned");
    expect(tooltip.toLowerCase()).toContain("problems");
  });
});
