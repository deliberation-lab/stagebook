import type { ElementType, DiscussionType } from "stagebook";

export type Phase = "intro" | "game" | "exit";

export interface ViewerStep {
  index: number;
  phase: Phase;
  name: string;
  elements: ElementType[];
  duration?: number;
  discussion?: DiscussionType;
  /** Researcher-facing notes on the stage (never shown to participants). */
  notes?: string;
}

interface IntroSequence {
  name: string;
  introSteps: { name: string; notes?: string; elements: ElementType[] }[];
}

interface Treatment {
  name: string;
  playerCount: number;
  gameStages: {
    name: string;
    notes?: string;
    duration?: number;
    elements: ElementType[];
    discussion?: DiscussionType;
  }[];
  exitSequence?: { name: string; notes?: string; elements: ElementType[] }[];
}

/**
 * Flatten a selected intro sequence and treatment into a single
 * ordered list of steps the viewer can navigate.
 */
export function flattenSteps(
  introSequence: IntroSequence,
  treatment: Treatment,
): ViewerStep[] {
  let index = 0;
  const steps: ViewerStep[] = [];

  for (const step of introSequence.introSteps) {
    steps.push({
      index: index++,
      phase: "intro",
      name: step.name,
      elements: step.elements,
      notes: step.notes,
    });
  }

  for (const stage of treatment.gameStages) {
    steps.push({
      index: index++,
      phase: "game",
      name: stage.name,
      elements: stage.elements,
      duration: stage.duration,
      discussion: stage.discussion,
      notes: stage.notes,
    });
  }

  if (treatment.exitSequence) {
    for (const step of treatment.exitSequence) {
      steps.push({
        index: index++,
        phase: "exit",
        name: step.name,
        elements: step.elements,
        notes: step.notes,
      });
    }
  }

  return steps;
}
