import type { ElementType } from "stagebook";

export type Phase = "intro" | "game" | "exit";

export interface ViewerStep {
  index: number;
  phase: Phase;
  name: string;
  elements: ElementType[];
  duration?: number;
}

interface IntroSequence {
  name: string;
  introSteps: { name: string; elements: ElementType[] }[];
}

interface Treatment {
  name: string;
  playerCount: number;
  gameStages: { name: string; duration?: number; elements: ElementType[] }[];
  exitSequence?: { name: string; elements: ElementType[] }[];
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
    });
  }

  for (const stage of treatment.gameStages) {
    steps.push({
      index: index++,
      phase: "game",
      name: stage.name,
      elements: stage.elements,
      duration: stage.duration,
    });
  }

  if (treatment.exitSequence) {
    for (const step of treatment.exitSequence) {
      steps.push({
        index: index++,
        phase: "exit",
        name: step.name,
        elements: step.elements,
      });
    }
  }

  return steps;
}
