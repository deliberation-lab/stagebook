/* eslint-disable @typescript-eslint/unbound-method */
import React, { createContext, useContext, useState, useEffect } from "react";
import type { DiscussionType } from "../schemas/treatment.js";
import {
  getReferenceKeyAndPath,
  getNestedValueByPath,
} from "../utils/reference.js";

// --------------- StagebookContext Interface ---------------

export interface StagebookContext {
  // Look up raw stored values by storage key.
  // scope: "player" (default), "shared", "all", "any", "percentAgreement",
  // or a numeric string for a specific position.
  get(key: string, scope?: string): unknown[];

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

// --------------- Internal context ---------------

interface InternalStagebookContext extends StagebookContext {
  resolve(reference: string, position?: string): unknown[];
}

const StagebookReactContext = createContext<InternalStagebookContext | null>(
  null,
);

// --------------- Provider ---------------

export function StagebookProvider({
  value,
  children,
}: {
  value: StagebookContext;
  children: React.ReactNode;
}) {
  const resolve = React.useCallback(
    (reference: string, position?: string): unknown[] => {
      let referenceKey: string;
      let path: string[];
      try {
        ({ referenceKey, path } = getReferenceKeyAndPath(reference));
      } catch {
        console.error(`Invalid reference: "${reference}"`);
        return [];
      }
      const rawValues = value.get(referenceKey, position);
      return rawValues
        .map((v) => getNestedValueByPath(v, path))
        .filter((v) => v !== undefined);
    },
    [value],
  );

  const internal: InternalStagebookContext = React.useMemo(
    () => ({ ...value, resolve }),
    [value, resolve],
  );

  return (
    <StagebookReactContext.Provider value={internal}>
      {children}
    </StagebookReactContext.Provider>
  );
}

// --------------- Hooks ---------------

export function useStagebookContext(): InternalStagebookContext {
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
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | undefined>(undefined);

  useEffect(() => {
    if (!path) {
      setData(undefined);
      setError(undefined);
      setIsLoading(false);
      return;
    }

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
