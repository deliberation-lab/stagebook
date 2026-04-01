/**
 * Test wrapper for Qualtrics that tracks save calls and completion.
 */
import React, { useState } from "react";
import { Qualtrics } from "../elements/Qualtrics.js";

export interface MockQualtricsProps {
  url: string;
  resolvedParams?: Array<{ key: string; value: string }>;
  participantId?: string;
  groupId?: string;
}

export function MockQualtrics({
  url,
  resolvedParams = [],
  participantId,
  groupId,
}: MockQualtricsProps) {
  const [savedData, setSavedData] = useState<{
    key: string;
    value: unknown;
  } | null>(null);
  const [completed, setCompleted] = useState(false);

  return (
    <div>
      <Qualtrics
        url={url}
        resolvedParams={resolvedParams}
        participantId={participantId}
        groupId={groupId}
        progressLabel="game_0_qualtrics"
        save={(key, value) => setSavedData({ key, value })}
        onComplete={() => setCompleted(true)}
      />
      {/* Hidden elements for test assertions */}
      <div data-testid="qualtrics-completed" style={{ display: "none" }}>
        {completed ? "true" : "false"}
      </div>
      <div data-testid="qualtrics-saved-key" style={{ display: "none" }}>
        {savedData?.key ?? ""}
      </div>
      <div data-testid="qualtrics-saved-value" style={{ display: "none" }}>
        {savedData ? JSON.stringify(savedData.value) : ""}
      </div>
    </div>
  );
}
