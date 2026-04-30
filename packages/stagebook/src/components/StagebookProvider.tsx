/* eslint-disable @typescript-eslint/unbound-method */
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
} from "react";
import type { DiscussionType } from "../schemas/treatment.js";
import {
  getReferenceKeyAndPath,
  getNestedValueByPath,
} from "../utils/reference.js";

// --------------- StagebookContext Interface ---------------

export interface StagebookContext {
  // Look up raw stored values by storage key.
  // scope: "player" (default), "shared", or a numeric string for a
  // specific slot index. After #238, `position` on a condition leaf
  // is a pure read selector and these are the only values stagebook
  // forwards. Hosts may still accept legacy aggregator scopes
  // (`"all"`, `"any"`, `"percentAgreement"`) for backward compat with
  // pre-#238 callers, but stagebook itself never sends them.
  get(key: string, scope?: string): unknown[];

  // Write state under a DSL-derived key
  save(key: string, value: unknown, scope?: "player" | "shared"): void;

  // Seconds since current step started
  getElapsedTime(): number;

  // Advance to next step
  submit(): void;

  /**
   * Called by stagebook when stage-level conditions (#183) evaluate to
   * false and the stage should end — either at mount (skip-at-load) or
   * mid-stage (early termination). Hosts implement the advancement
   * policy: single-participant hosts typically wrap `submit()`;
   * multi-participant hosts submit for every player so dropouts don't
   * hang the stage. Distinct from `submit()` so the host can
   * differentiate "this player finished" from "the stage should end
   * for everyone." Optional — when absent, stagebook falls back to
   * `submit()` and logs a dev-mode warning.
   */
  advanceStage?: () => void;

  /**
   * Opaque host-provided identifier for the current stage instance.
   * Stagebook uses it as the identity key for `StageConditionGate`'s
   * advance latch: when `stageId` changes the latch resets, so a host
   * that reuses the provider across stages doesn't need to key-remount
   * the subtree between stages. Hosts that already remount per stage,
   * or that never change stage mid-mount, can omit it — the conditions
   * array reference is used as a fallback identity. Cross-client
   * staleness checks (e.g. "is this advance still for the stage we
   * thought it was?") belong inside the host's `advanceStage`
   * implementation, not here.
   */
  stageId?: string;

  // Content resolution — platform handles fetching, caching, retries
  getAssetURL(path: string): string;
  getTextContent(path: string): Promise<string>;

  /**
   * Monotonically increasing counter that signals cached content is stale.
   * When bumped, useTextContent re-fetches all paths. Optional — hosts that
   * never change content (production experiments) can omit it entirely.
   */
  contentVersion?: number;

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
  renderSharedNotepad?: (config: {
    padName: string;
    defaultText?: string;
    rows?: number;
  }) => React.ReactNode;
  renderTalkMeter?: () => React.ReactNode;
  renderSurvey?: (config: {
    surveyName: string;
    onComplete: (results: unknown) => void;
  }) => React.ReactNode;

  // Optional crash-reporting hook — called once per element render crash
  // caught by ElementErrorBoundary, with a structured payload. This is a
  // notification only; console.error and window.onerror still fire
  // regardless of whether this is provided.
  onElementError?: (info: {
    elementType: string;
    elementName?: string;
    error: Error;
    errorInfo: React.ErrorInfo;
  }) => void;
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
      // After #238 `position` on a condition leaf is a pure read
      // selector — `"shared"`, `"player"`, or a numeric slot index
      // (passed as a string). The cross-player aggregator values
      // (`"any"`, `"percentAgreement"`) are gone, so the previous
      // normalization to `"all"` is no longer needed: the position is
      // forwarded to the host's `get()` verbatim.
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
  const { getTextContent, contentVersion } = useStagebookContext();
  const [data, setData] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | undefined>(undefined);

  // Ref `getTextContent` so a rebuilt StagebookContext (fresh function
  // identity each render) doesn't cause the fetch effect to re-fire on
  // every parent re-render (#105). Intentional cache busts are signaled
  // via `contentVersion` instead of function identity.
  const getTextContentRef = useRef(getTextContent);
  getTextContentRef.current = getTextContent;

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

    getTextContentRef
      .current(path)
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
    // contentVersion is bumped by the host when cached content should be
    // re-fetched (e.g. VS Code preview refresh). getTextContent is ref'd
    // to avoid re-fetches from unstable context identity (#105).
  }, [path, contentVersion ?? 0]);

  return { data, isLoading, error };
}
