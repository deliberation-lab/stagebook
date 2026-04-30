import type { StagebookContext } from "stagebook/components";
import { ViewerStateStore } from "./store";

export interface ViewerContextOptions {
  store: ViewerStateStore;
  position: number;
  stageIndex: number;
  playerCount: number;
  onSubmit: () => void;
  getTextContent: (path: string) => Promise<string>;
  getAssetURL: (path: string) => string;
  contentVersion?: number;
  renderers?: Partial<
    Pick<
      StagebookContext,
      | "renderDiscussion"
      | "renderSurvey"
      | "renderSharedNotepad"
      | "renderTalkMeter"
    >
  >;
}

/**
 * Create a mock StagebookContext backed by a ViewerStateStore.
 *
 * This is the bridge between the viewer's state management and
 * the stagebook component rendering contract.
 */
export function createViewerContext(
  options: ViewerContextOptions,
): StagebookContext {
  const {
    store,
    position,
    stageIndex,
    playerCount,
    onSubmit,
    getTextContent,
    getAssetURL,
    contentVersion,
    renderers,
  } = options;

  return {
    get(key: string, scope?: string): unknown[] {
      const mapped = mapPosition(scope, position);
      // Stagebook may pass `"player"` (default) → current position,
      // `"shared"`, a numeric slot index, or `"all"`. After #238, the
      // condition leaves use only the first three; `"all"` still
      // arrives via `display.position: "all"` (and similarly for
      // trackedLink/qualtrics urlParams), and stagebook normalizes
      // `display.position: "any"` to `"all"` before reaching this
      // callback so we only need to handle one aggregator scope.
      if (typeof mapped === "number" || mapped === "shared") {
        return store.lookup(key, mapped);
      }
      // `"all"` (or any unrecognized scope, defensively) reads
      // every participant's value for this key.
      return store.lookup(key);
    },

    save(key: string, value: unknown, scope?: "player" | "shared"): void {
      store.save(key, value, scope ?? "player", position, stageIndex);
    },

    getElapsedTime(): number {
      return store.getElapsedTime(stageIndex);
    },

    submit(): void {
      onSubmit();
    },

    // Single-participant preview: stage-level conditions (#183) end the
    // stage by the same mechanism a submit button does. No cross-client
    // coordination to do — just advance.
    advanceStage(): void {
      onSubmit();
    },

    // Opaque per-stage identity (just the index, which is unique per
    // flattened step). Lets the StageConditionGate's latch reset cleanly
    // when the stage changes.
    stageId: `stage-${String(stageIndex)}`,

    getAssetURL,
    getTextContent,
    contentVersion,

    progressLabel: `game_${stageIndex}`,
    playerId: "viewer",
    position,
    playerCount,

    get isSubmitted() {
      return store.getSubmitted(stageIndex);
    },

    ...renderers,
  };
}

function mapPosition(
  positionArg: string | undefined,
  currentPosition: number,
): number | "shared" | "all" {
  if (positionArg === undefined || positionArg === "player") {
    return currentPosition;
  }
  if (positionArg === "shared") {
    return "shared";
  }
  if (positionArg === "all") {
    return "all";
  }
  const num = Number(positionArg);
  if (Number.isFinite(num) && Number.isInteger(num) && num >= 0) {
    return num;
  }
  return currentPosition;
}
