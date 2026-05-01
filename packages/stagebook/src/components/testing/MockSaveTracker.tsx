/**
 * Stage renderer that tracks all save calls, including metadata
 * added by Element.tsx's wrappedSave.
 */
import React, { useState } from "react";
import {
  StagebookProvider,
  type StagebookContext,
} from "../StagebookProvider.js";
import { Stage, type StageConfig } from "../Stage.js";

export interface SaveEntry {
  key: string;
  value: unknown;
  scope?: string;
}

export interface MockSaveTrackerProps {
  stage: StageConfig;
  elapsedTime?: number;
}

export function MockSaveTracker({
  stage,
  elapsedTime = 25.5,
}: MockSaveTrackerProps) {
  const [saves, setSaves] = useState<SaveEntry[]>([]);

  const mockContext: StagebookContext = {
    get: () => [],
    save: (key: string, value: unknown, scope?: "player" | "shared") => {
      setSaves((prev) => [...prev, { key, value, scope }]);
    },
    getElapsedTime: () => elapsedTime,
    submit: () => {},
    getAssetURL: (path: string) => `https://cdn.test/${path}`,
    getTextContent: () =>
      // After #243 noResponse files are two-section.
      Promise.resolve("---\nname: mock\ntype: noResponse\n---\nMock content\n"),
    progressLabel: `game_0_${stage.name}`,
    playerId: "player-1",
    position: 0,
    playerCount: 1,
    isSubmitted: false,
  };

  return (
    <div>
      <StagebookProvider value={mockContext}>
        <Stage stage={stage} onSubmit={() => {}} />
      </StagebookProvider>
      <div data-testid="save-log" style={{ display: "none" }}>
        {JSON.stringify(saves)}
      </div>
    </div>
  );
}
