import { load as loadYaml } from "js-yaml";
import {
  fillTemplates,
  treatmentFileSchema,
  type TreatmentFileType,
} from "stagebook";

/**
 * Parse a YAML string as a treatment file, validating against the schema.
 * Throws on invalid YAML or schema validation failure.
 */
export function parseTreatmentYaml(yaml: string): TreatmentFileType {
  const raw = loadYaml(yaml);
  const result = treatmentFileSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(
      `Treatment file validation failed:\n${result.error.message}`,
    );
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
