import { treatmentFileSchema } from "stagebook";
import { createPositionMapper, extractYamlErrors } from "./yamlPositionMap";
import type { Diagnostic } from "./types";

export type { Diagnostic };

export interface ValidationResult {
  diagnostics: Diagnostic[];
  /** The parsed JS object, or null if YAML parsing failed fatally. */
  parsedObj: unknown;
}

/**
 * Validate a treatment YAML source string.
 *
 * Returns diagnostics with source positions and the parsed object.
 * This is a pure function — no VS Code dependency.
 *
 * The schema validates the original (unexpanded) object directly,
 * since treatmentFileSchema uses altTemplateContext() and accepts
 * both concrete objects and template contexts at every level.
 */
export function validateTreatmentSource(source: string): ValidationResult {
  const diagnostics: Diagnostic[] = [];

  // Step 1: Check for YAML syntax errors and duplicate keys
  const yamlErrors = extractYamlErrors(source);
  for (const err of yamlErrors) {
    diagnostics.push({
      message: err.message,
      severity: err.message.match(/unique|duplicate/i) ? "warning" : "error",
      range: {
        startLine: err.line,
        startCol: err.col,
        endLine: err.line,
        endCol: err.col + 1,
      },
    });
  }

  // Step 2: Parse into AST (for position mapping) and JS object (for Zod)
  const mapper = createPositionMapper(source);
  const parsedObj = mapper.toJSON();

  // Step 3: Validate with stagebook's treatmentFileSchema
  // Pass whatever was parsed (even null/scalar) — Zod produces clear
  // "Expected object, received ..." messages for non-object input.
  const result = treatmentFileSchema.safeParse(parsedObj);

  if (!result.success) {
    for (const issue of result.error.issues) {
      // Try to resolve the exact path; if it doesn't exist in the source
      // (e.g., "Required" errors on missing fields), walk up to the nearest
      // ancestor that does exist so the squiggly lands somewhere meaningful.
      let range = mapper.resolve(issue.path);
      let ancestorPath = issue.path;
      while (!range && ancestorPath.length > 0) {
        ancestorPath = ancestorPath.slice(0, -1);
        range = mapper.resolve(ancestorPath);
      }

      // Append the field path to every diagnostic so the user always knows
      // which field the error refers to. Zod messages often omit the field
      // name (e.g., "Required", "Expected number, received string"), and
      // even when they include it, the full path gives hierarchical context.
      // Skipped only when the path is already present verbatim in the message.
      const pathStr = formatPath(issue.path);
      const message =
        pathStr && !issue.message.toLowerCase().includes(pathStr.toLowerCase())
          ? `${issue.message} (${pathStr})`
          : issue.message;

      diagnostics.push({
        message,
        severity: "error",
        range,
      });
    }
  }

  return { diagnostics, parsedObj };
}

/**
 * Format a Zod issue path as a readable dotted string.
 * Array indices are shown in brackets: ["treatments", 0, "gameStages", 1] → "treatments[0].gameStages[1]"
 */
function formatPath(path: (string | number)[]): string {
  if (path.length === 0) return "";
  let result = "";
  for (const segment of path) {
    if (typeof segment === "number") {
      result += `[${segment}]`;
    } else {
      result += result ? `.${segment}` : segment;
    }
  }
  return result;
}
