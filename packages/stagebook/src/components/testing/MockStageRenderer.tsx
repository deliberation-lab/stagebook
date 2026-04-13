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

export interface MockStageRendererProps {
  stage: StageConfig;
  position?: number;
  playerCount?: number;
  isSubmitted?: boolean;
  elapsedTime?: number;
  /** Key-value map of reference string → value for resolve() */
  stateValues?: Record<string, unknown>;
}

export function MockStageRenderer({
  stage,
  position = 0,
  playerCount = 2,
  isSubmitted = false,
  elapsedTime = 0,
  stateValues = {},
}: MockStageRendererProps) {
  const mockContext: StagebookContext = {
    resolve: (reference: string) => {
      const val = stateValues[reference];
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
