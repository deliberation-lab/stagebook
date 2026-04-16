import { fillTemplates, type TreatmentFileType } from "stagebook";

/**
 * Expand templates in a parsed treatment file and detect unresolved fields.
 * Optionally provide additionalFields to resolve remaining placeholders.
 *
 * Lives in its own module (not `treatment.ts`) so it can be imported by
 * the webview entry point without pulling in js-yaml transitively.
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
