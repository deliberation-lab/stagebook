/**
 * Test wrapper for rendering Stage with a mock StagebookProvider.
 * Used by Playwright CT tests where function props can't be serialized.
 *
 * The mock provider returns static data — no real state management.
 * This is sufficient for testing layout, conditional rendering, and styling.
 */
import React from "react";
import {
  StagebookProvider,
  type StagebookContext,
} from "../StagebookProvider.js";
import { Stage, type StageConfig } from "../Stage.js";
import { getReferenceKeyAndPath } from "../../utils/reference.js";

export interface MockStageRendererProps {
  stage: StageConfig;
  position?: number;
  playerCount?: number;
  isSubmitted?: boolean;
  elapsedTime?: number;
  /** Key-value map of DSL reference string → extracted value (e.g., "prompt.answer" → "yes") */
  stateValues?: Record<string, unknown>;
}

/** Set a value at a nested path within an object, mutating in place. */
function setAtPath(
  obj: Record<string, unknown>,
  path: string[],
  value: unknown,
): void {
  let cursor = obj;
  for (let i = 0; i < path.length - 1; i++) {
    const seg = path[i];
    if (typeof cursor[seg] !== "object" || cursor[seg] === null) {
      cursor[seg] = {};
    }
    cursor = cursor[seg] as Record<string, unknown>;
  }
  cursor[path[path.length - 1]] = value;
}

/**
 * Convert DSL-reference-keyed stateValues to flat-key → raw-record map.
 * Multiple references sharing a storage key (e.g., "survey.TIPI.result.score"
 * and "survey.TIPI.result.other") are deep-merged into a single record.
 */
function buildFlatValues(
  stateValues: Record<string, unknown>,
): Map<string, unknown> {
  const flat = new Map<string, unknown>();
  for (const [ref, val] of Object.entries(stateValues)) {
    const { referenceKey, path } = getReferenceKeyAndPath(ref);
    if (path.length === 0) {
      flat.set(referenceKey, val);
    } else {
      let record = flat.get(referenceKey);
      if (typeof record !== "object" || record === null) {
        record = {};
        flat.set(referenceKey, record);
      }
      setAtPath(record as Record<string, unknown>, path, val);
    }
  }
  return flat;
}

export function MockStageRenderer({
  stage,
  position = 0,
  playerCount = 2,
  isSubmitted = false,
  elapsedTime = 0,
  stateValues = {},
}: MockStageRendererProps) {
  const flatValues = buildFlatValues(stateValues);

  const mockContext: StagebookContext = {
    get: (key: string) => {
      const val = flatValues.get(key);
      return val !== undefined ? [val] : [];
    },
    save: () => {},
    getElapsedTime: () => elapsedTime,
    submit: () => {},
    getAssetURL: (path: string) => `https://mock-cdn.test/${path}`,
    getTextContent: (path: string) =>
      Promise.resolve(
        `---\nname: ${path}\ntype: noResponse\n---\nMock content for ${path}\n---\n`,
      ),
    progressLabel: `game_0_${stage.name}`,
    playerId: "test-player-1",
    position,
    playerCount,
    isSubmitted,
    renderDiscussion: stage.discussion
      ? () => (
          <div
            data-testid="mock-discussion"
            style={{
              width: "100%",
              height: "100%",
              minHeight: "200px",
              backgroundColor: "#f0f4f8",
              border: "2px dashed #94a3b8",
              borderRadius: "8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#64748b",
              fontSize: "0.875rem",
            }}
          >
            Mock {stage.discussion?.chatType} discussion
          </div>
        )
      : undefined,
  };

  return (
    <StagebookProvider value={mockContext}>
      <Stage stage={stage} onSubmit={() => {}} />
    </StagebookProvider>
  );
}
