import { promptFileSchema } from "stagebook";
import type { SourceRange } from "./yamlPositionMap";

export interface Diagnostic {
  message: string;
  severity: "error" | "warning";
  range: SourceRange | null;
}

export interface PromptValidationResult {
  diagnostics: Diagnostic[];
}

/**
 * Find the 0-based line numbers of all `---` delimiters in the source.
 */
function findDelimiterLines(source: string): number[] {
  const lines = source.split(/\r?\n/);
  const result: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (/^-{3,}$/.test(lines[i].trim())) {
      result.push(i);
    }
  }
  return result;
}

/**
 * Map a Zod issue path from promptFileSchema to a source line range.
 *
 * promptFileSchema produces paths like:
 * - [] — structural errors (missing delimiters)
 * - ["metadata", "type"] — metadata field errors
 * - ["body"] — body section errors
 * - ["responses"] — response format errors
 */
function mapPromptErrorToRange(
  source: string,
  path: (string | number)[],
  delimiters: number[],
): SourceRange | null {
  if (delimiters.length < 3) {
    // Can't map without delimiters — fall back to line 0
    return { startLine: 0, startCol: 0, endLine: 0, endCol: 1 };
  }

  const [metaStart, metaEnd, responseStart] = delimiters;

  if (path.length === 0) {
    return { startLine: 0, startCol: 0, endLine: 0, endCol: 1 };
  }

  const section = path[0];

  if (section === "metadata") {
    // Map to the metadata section (between first and second ---)
    // If we have a specific field name, try to find it
    if (path.length >= 2 && typeof path[1] === "string") {
      const fieldName = path[1];
      const lines = source.split(/\r?\n/);
      for (let i = metaStart + 1; i < metaEnd; i++) {
        if (lines[i] && lines[i].trimStart().startsWith(fieldName + ":")) {
          return {
            startLine: i,
            startCol: 0,
            endLine: i,
            endCol: lines[i].length,
          };
        }
      }
    }
    // Fall back to the metadata section start
    return {
      startLine: metaStart + 1,
      startCol: 0,
      endLine: metaEnd - 1,
      endCol: 0,
    };
  }

  if (section === "body") {
    return {
      startLine: metaEnd + 1,
      startCol: 0,
      endLine: responseStart - 1,
      endCol: 0,
    };
  }

  if (section === "responses") {
    // Map to the response section (after the third ---)
    return {
      startLine: responseStart + 1,
      startCol: 0,
      endLine: responseStart + 1,
      endCol: 1,
    };
  }

  return null;
}

/**
 * Validate a prompt markdown source string.
 *
 * Returns diagnostics with source positions.
 * This is a pure function — no VS Code dependency.
 */
export function validatePromptSource(source: string): PromptValidationResult {
  const diagnostics: Diagnostic[] = [];
  const delimiters = findDelimiterLines(source);

  // Warn about extra delimiters (likely horizontal rule attempts)
  if (delimiters.length > 3) {
    for (let i = 3; i < delimiters.length; i++) {
      diagnostics.push({
        message:
          "Extra --- delimiter found. If you want a horizontal rule, use *** or ___ instead — three dashes are used to separate prompt sections.",
        severity: "warning",
        range: {
          startLine: delimiters[i],
          startCol: 0,
          endLine: delimiters[i],
          endCol: 3,
        },
      });
    }
  }

  // Validate with stagebook's promptFileSchema
  const result = promptFileSchema.safeParse(source);

  if (!result.success) {
    for (const issue of result.error.issues) {
      const range = mapPromptErrorToRange(source, issue.path, delimiters);
      diagnostics.push({
        message: issue.message,
        severity: "error",
        range,
      });
    }
  }

  return { diagnostics };
}
