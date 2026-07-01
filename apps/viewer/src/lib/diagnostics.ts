import type { Diagnostic } from "stagebook/validate";

/**
 * A validation diagnostic tagged with the display path of the file it
 * belongs to. The viewer surfaces diagnostics for the entry treatment file
 * and, for locale-consistency errors, referenced prompt files — so unlike the
 * library's `Diagnostic` (which is always relative to a single source string),
 * the viewer needs to say *which* file each one refers to.
 */
export interface ViewerDiagnostic extends Diagnostic {
  /** Display path of the file this diagnostic refers to. */
  file: string;
}

export interface DiagnosticSummary {
  errors: number;
  warnings: number;
}

/** Count diagnostics by severity for the drawer header. */
export function summarizeDiagnostics(
  diagnostics: readonly Diagnostic[],
): DiagnosticSummary {
  let errors = 0;
  let warnings = 0;
  for (const d of diagnostics) {
    if (d.severity === "error") errors += 1;
    else warnings += 1;
  }
  return { errors, warnings };
}

const severityRank = (severity: Diagnostic["severity"]): number =>
  severity === "error" ? 0 : 1;

/**
 * Order diagnostics for display: by source position (line, then column),
 * with unpositioned diagnostics (`range === null`) last. Errors sort before
 * warnings when positions tie, so the most severe issue at a location leads.
 *
 * Returns a new array; does not mutate the input.
 */
export function sortDiagnostics<T extends Diagnostic>(
  diagnostics: readonly T[],
): T[] {
  return [...diagnostics].sort((a, b) => {
    if (a.range && b.range) {
      if (a.range.startLine !== b.range.startLine) {
        return a.range.startLine - b.range.startLine;
      }
      if (a.range.startCol !== b.range.startCol) {
        return a.range.startCol - b.range.startCol;
      }
      return severityRank(a.severity) - severityRank(b.severity);
    }
    if (a.range) return -1;
    if (b.range) return 1;
    return severityRank(a.severity) - severityRank(b.severity);
  });
}
