import { load as loadYaml } from "js-yaml";
import {
  fillTemplates,
  treatmentFileSchema,
  type TreatmentFileType,
} from "stagebook";

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

/**
 * Expand templates in a parsed treatment file and detect unresolved fields.
 * Optionally provide additionalFields to resolve remaining placeholders.
 */
export function expandTreatmentFile(
  treatmentFile: TreatmentFileType,
  additionalFields?: Record<string, unknown>,
): { result: TreatmentFileType; unresolvedFields: string[] } {
  // Strip template definitions before expansion — they contain
  // placeholder syntax that would be falsely flagged as unresolved.
  const { templates, ...withoutTemplates } = treatmentFile;
  const { result, unresolvedFields } = fillTemplates({
    obj: withoutTemplates,
    templates: templates ?? [],
    additionalFields,
    allowUnresolved: true,
  });
  return { result: result as TreatmentFileType, unresolvedFields };
}
