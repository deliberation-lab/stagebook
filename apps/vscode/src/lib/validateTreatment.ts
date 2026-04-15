import { treatmentFileSchema } from "stagebook";
import {
  createPositionMapper,
  extractYamlErrors,
  type SourceRange,
} from "./yamlPositionMap";

export interface Diagnostic {
  message: string;
  severity: "error" | "warning";
  range: SourceRange | null;
}

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

  if (
    parsedObj === null ||
    parsedObj === undefined ||
    typeof parsedObj !== "object"
  ) {
    if (diagnostics.length === 0) {
      diagnostics.push({
        message: "Failed to parse YAML",
        severity: "error",
        range: null,
      });
    }
    return { diagnostics, parsedObj: null };
  }

  // Step 3: Validate with stagebook's treatmentFileSchema
  // The schema accepts template contexts natively (via altTemplateContext),
  // so we validate the original object without expanding templates.
  const result = treatmentFileSchema.safeParse(parsedObj);

  if (!result.success) {
    for (const issue of result.error.issues) {
      const range = mapper.resolve(issue.path);

      diagnostics.push({
        message: issue.message,
        severity: "error",
        range,
      });
    }
  }

  return { diagnostics, parsedObj };
}
