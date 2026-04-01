/* eslint-disable @typescript-eslint/unbound-method */
import React, { createContext, useContext, useState, useEffect } from "react";
import type { DiscussionType } from "../schemas/treatment.js";

// --------------- ScoreContext Interface ---------------

export interface ScoreContext {
  // Read state via DSL reference strings
  resolve(reference: string, position?: string): unknown[];

  // Write state under a DSL-derived key
  save(key: string, value: unknown, scope?: "player" | "shared"): void;

  // Seconds since current step started
  getElapsedTime(): number;

  // Advance to next step
  submit(): void;

  // Content resolution — platform handles fetching, caching, retries
  getAssetURL(path: string): string;
  getTextContent(path: string): Promise<string>;

  // Identity and progress
  progressLabel: string;
  playerId: string;
  position: number | undefined;
  playerCount: number | undefined;
  isSubmitted: boolean;

  // Idle state — components call this to signal when the participant
  // should be allowed to appear idle (e.g., watching a video, on an
  // external link). Platform handles detection and UI.
  setAllowIdle?: (allow: boolean) => void;

  // Platform-provided renderers for service-coupled elements
  renderDiscussion?: (config: DiscussionType) => React.ReactNode;
  renderSharedNotepad?: (config: { padName: string }) => React.ReactNode;
  renderTalkMeter?: () => React.ReactNode;
  renderSurvey?: (config: {
    surveyName: string;
    onComplete: (results: unknown) => void;
  }) => React.ReactNode;
}

// --------------- Context ---------------

const ScoreReactContext = createContext<ScoreContext | null>(null);

// --------------- Provider ---------------

export function ScoreProvider({
  value,
  children,
}: {
  value: ScoreContext;
  children: React.ReactNode;
}) {
  return (
    <ScoreReactContext.Provider value={value}>
      {children}
    </ScoreReactContext.Provider>
  );
}

// --------------- Hooks ---------------

export function useScoreContext(): ScoreContext {
  const ctx = useContext(ScoreReactContext);
  if (!ctx) {
    throw new Error(
      "useScoreContext must be used within a <ScoreProvider>. " +
        "Wrap your component tree with <ScoreProvider value={...}>.",
    );
  }
  return ctx;
}

export function useResolve(reference: string, position?: string): unknown[] {
  const { resolve } = useScoreContext();
  return resolve(reference, position);
}

export function useSave(): ScoreContext["save"] {
  const { save } = useScoreContext();
  return save;
}

export function useElapsedTime(): number {
  const { getElapsedTime } = useScoreContext();
  return getElapsedTime();
}

// --------------- Content hooks ---------------

export interface TextContentResult {
  data: string | undefined;
  isLoading: boolean;
  error: Error | undefined;
}

export function useTextContent(path: string): TextContentResult {
  const { getTextContent } = useScoreContext();
  const [data, setData] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(undefined);

    getTextContent(path)
      .then((text) => {
        if (!cancelled) {
          setData(text);
          setIsLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [path, getTextContent]);

  return { data, isLoading, error };
}
