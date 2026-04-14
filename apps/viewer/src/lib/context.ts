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
  } = options;

  return {
    resolve(reference: string, positionArg?: string): unknown[] {
      const mapped = mapPosition(positionArg, position);
      if (typeof mapped === "number" || mapped === "shared") {
        return store.resolve(reference, mapped);
      }
      // "all", "any", "percentAgreement" → return from all player positions
      return store.resolve(reference);
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

    getAssetURL,
    getTextContent,

    progressLabel: `game_${stageIndex}`,
    playerId: "viewer",
    position,
    playerCount,

    get isSubmitted() {
      return store.getSubmitted(stageIndex);
    },
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
  if (
    positionArg === "all" ||
    positionArg === "any" ||
    positionArg === "percentAgreement"
  ) {
    return "all";
  }
  const num = Number(positionArg);
  if (!Number.isNaN(num)) {
    return num;
  }
  return currentPosition;
}
