import { load as loadYaml } from "js-yaml";
import { treatmentFileSchema, type TreatmentFileType } from "stagebook";

export { expandTreatmentFile } from "./expandTreatmentFile";

export interface ValidationIssue {
  path: string;
  message: string;
}

export class TreatmentValidationError extends Error {
  issues: ValidationIssue[];

  constructor(issues: ValidationIssue[]) {
    const summary = issues.map((i) => `  ${i.path}: ${i.message}`).join("\n");
    super(`Treatment file validation failed:\n${summary}`);
    this.name = "TreatmentValidationError";
    this.issues = issues;
  }
}

/**
 * Parse a YAML string as a treatment file, validating against the schema.
 * Throws TreatmentValidationError with structured issues on failure.
 */
export function parseTreatmentYaml(yaml: string): TreatmentFileType {
  const raw = loadYaml(yaml);
  const result = treatmentFileSchema.safeParse(raw);
  if (!result.success) {
    const issues: ValidationIssue[] = result.error.issues.map((issue) => ({
      path: issue.path.join(".") || "(root)",
      message: issue.message,
    }));
    throw new TreatmentValidationError(issues);
  }
  return result.data;
}
