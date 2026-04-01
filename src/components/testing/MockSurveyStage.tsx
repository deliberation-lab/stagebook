/**
 * Test wrapper that renders a Stage with a survey element and a mock
 * renderSurvey slot. The mock survey has a "Complete Survey" button
 * that calls onComplete with test results.
 */
import React, { useState } from "react";
import { ScoreProvider, type ScoreContext } from "../ScoreProvider.js";
import { Stage, type StageConfig } from "../Stage.js";

const mockSurveyResults = {
  result: { normAgreeableness: 0.82, normExtraversion: 0.65 },
  responses: { q1: "agree", q2: "neutral" },
};

export function MockSurveyStage() {
  const [savedEntries, setSavedEntries] = useState<
    Array<{ key: string; value: unknown }>
  >([]);

  const stage: StageConfig = {
    name: "SurveyStage",
    duration: 120,
    elements: [
      { type: "survey", surveyName: "TIPI", name: "preTIPI" },
      { type: "submitButton" },
    ],
  };

  const mockContext: ScoreContext = {
    resolve: () => [],
    save: (key: string, value: unknown) => {
      setSavedEntries((prev) => [...prev, { key, value }]);
    },
    getElapsedTime: () => 0,
    submit: () => {},
    getAssetURL: (path: string) => `https://mock-cdn.test/${path}`,
    getTextContent: () =>
      Promise.resolve("---\nname: mock\ntype: noResponse\n---\nMock\n---\n"),
    progressLabel: "game_0_SurveyStage",
    playerId: "test-player",
    position: 0,
    playerCount: 1,
    isSubmitted: false,
    renderSurvey: ({ surveyName, onComplete }) => (
      <div
        data-testid="mock-survey"
        style={{
          padding: "1rem",
          border: "2px dashed var(--score-border, #d1d5db)",
          borderRadius: "0.5rem",
        }}
      >
        <p style={{ marginBottom: "0.5rem" }}>
          Mock Survey: <strong>{surveyName}</strong>
        </p>
        <button
          data-testid="complete-survey-btn"
          onClick={() => onComplete(mockSurveyResults)}
          style={{
            padding: "0.5rem 1rem",
            backgroundColor: "var(--score-primary, #3b82f6)",
            color: "#fff",
            border: "none",
            borderRadius: "0.375rem",
            cursor: "pointer",
          }}
        >
          Complete Survey
        </button>
      </div>
    ),
  };

  return (
    <div>
      <ScoreProvider value={mockContext}>
        <Stage stage={stage} onSubmit={() => {}} />
      </ScoreProvider>
      {/* Hidden elements for test assertions */}
      <div data-testid="saved-entries" style={{ display: "none" }}>
        {JSON.stringify(savedEntries)}
      </div>
    </div>
  );
}
