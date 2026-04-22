/* eslint-disable @typescript-eslint/unbound-method */
import React, { useEffect, useRef } from "react";
import { useStagebookContext } from "../StagebookProvider.js";
import { evaluateConditions } from "../../utils/evaluateConditions.js";
import { Loading } from "../form/Loading.js";
import type { Condition } from "./ConditionsConditionalRender.js";

export interface StageConditionGateProps {
  /**
   * Stage-level conditions from the treatment DSL (#183). When all
   * conditions evaluate to `true`, children render normally. When any
   * condition is `false`, stagebook asks the host to advance the stage
   * via `context.advanceStage` (falling back to `submit`).
   */
  conditions?: Condition[];
  children: React.ReactNode;
}

/**
 * Wraps a stage's render body and evaluates stage-level conditions.
 *
 * Two behaviors, same code path:
 * - **Skip at load.** Conditions reference data produced in *prior*
 *   stages. Evaluated on mount; if false, stagebook immediately asks
 *   the host to advance. Stage body never renders.
 * - **Early termination.** Conditions reference data in the *current*
 *   stage, authored so they evaluate to `true` when the value is
 *   `undefined` (typically `comparator: doesNotExist`). Stage renders
 *   normally; when a value arrives that flips a condition to false,
 *   stagebook asks the host to advance.
 *
 * Advance is fired at most once per stage:
 * - A latch ref prevents double-fire within a stage.
 * - The latch auto-resets when the stage identity changes (via
 *   `stageId` if the host supplies one, or the conditions array
 *   reference otherwise) so the next stage starts clean — hosts that
 *   reuse the provider across stages don't need to key-remount.
 */
export function StageConditionGate({
  conditions,
  children,
}: StageConditionGateProps) {
  const { resolve, advanceStage, submit, stageId } = useStagebookContext();

  // Reset the advance latch whenever the stage changes. Tracks
  // `stageId` when the host supplies one (authoritative identity),
  // otherwise falls back to the conditions array reference (changes
  // each time the stage config changes in a well-behaved host).
  const stageKey = stageId ?? conditions;
  const lastStageKeyRef = useRef<unknown>(null);
  const advanceFiredRef = useRef(false);
  if (lastStageKeyRef.current !== stageKey) {
    lastStageKeyRef.current = stageKey;
    advanceFiredRef.current = false;
  }

  const hasConditions = !!conditions && conditions.length > 0;
  const allMet = hasConditions ? evaluateConditions(conditions, resolve) : true;

  useEffect(() => {
    if (!hasConditions) return;
    if (allMet) return;
    if (advanceFiredRef.current) return;
    advanceFiredRef.current = true;

    if (advanceStage) {
      advanceStage();
    } else {
      warnFallbackOnce();
      submit();
    }
  }, [hasConditions, allMet, advanceStage, submit, stageId]);

  if (!hasConditions || allMet) return <>{children}</>;

  return (
    <div
      data-testid="stage-condition-gate"
      data-state="advancing"
      style={{ textAlign: "center" }}
    >
      <Loading />
    </div>
  );
}

let warned = false;
function warnFallbackOnce(): void {
  if (warned) return;
  warned = true;
  console.warn(
    "[stagebook] StagebookContext.advanceStage is not implemented; " +
      "falling back to submit() for stage-level condition advancement. " +
      "Multi-participant hosts should implement advanceStage to submit " +
      "for every player so dropouts don't hang the stage. See #183.",
  );
}
