/* eslint-disable @typescript-eslint/unbound-method */
import React, { createContext, useContext, useState, useEffect } from "react";
import type { DiscussionType } from "../schemas/treatment.js";

// --------------- StagebookContext Interface ---------------

export interface StagebookContext {
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

const StagebookReactContext = createContext<StagebookContext | null>(null);

// --------------- Provider ---------------

export function StagebookProvider({
  value,
  children,
}: {
  value: StagebookContext;
  children: React.ReactNode;
}) {
  return (
    <StagebookReactContext.Provider value={value}>
      {children}
    </StagebookReactContext.Provider>
  );
}

// --------------- Hooks ---------------

export function useStagebookContext(): StagebookContext {
  const ctx = useContext(StagebookReactContext);
  if (!ctx) {
    throw new Error(
      "useStagebookContext must be used within a <StagebookProvider>. " +
        "Wrap your component tree with <StagebookProvider value={...}>.",
    );
  }
  return ctx;
}

export function useResolve(reference: string, position?: string): unknown[] {
  const { resolve } = useStagebookContext();
  return resolve(reference, position);
}

export function useSave(): StagebookContext["save"] {
  const { save } = useStagebookContext();
  return save;
}

export function useElapsedTime(): number {
  const { getElapsedTime } = useStagebookContext();
  return getElapsedTime();
}

// --------------- Content hooks ---------------

export interface TextContentResult {
  data: string | undefined;
  isLoading: boolean;
  error: Error | undefined;
}

export function useTextContent(path: string): TextContentResult {
  const { getTextContent } = useStagebookContext();
  const [data, setData] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(!path ? false : true);
  const [error, setError] = useState<Error | undefined>(undefined);

  useEffect(() => {
    if (!path) return;

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
