import type { TreatmentFileType } from "stagebook";

/**
 * Whether the overview/picker screen is needed before viewing a treatment.
 *
 * True when there's a choice to make: 2+ intro sequences or 2+ treatments.
 *
 * Both `introSequences` and `treatments` are optional in the schema — a
 * treatments-only file (no intro yet) and an intro-only file (the structure
 * you preview while still building the intro, before any treatment exists)
 * are both valid mid-development states, not errors. Neither completeness
 * check belongs in static validation: "is there a treatment to assign people
 * to?" is a launch-time concern the host enforces, not an authoring error.
 * Critically, `altTemplateContext` types both fields as `any` in the built
 * `.d.ts`, so tsc will NOT flag a bare `.length` here. The `?? 0` guards are
 * load-bearing: a treatments-only file previously crashed this exact
 * computation. Kept as a pure, tested function so a regression can't slip past
 * the type checker (it can't see the optionality) AND the test suite.
 */
export function needsOverviewPicker(treatmentFile: TreatmentFileType): boolean {
  return (
    (treatmentFile.introSequences?.length ?? 0) > 1 ||
    (treatmentFile.treatments?.length ?? 0) > 1
  );
}
