import type { StagebookContext } from "stagebook/components";
import { ViewerStateStore } from "./store";

export interface ViewerContextOptions {
  store: ViewerStateStore;
  position: number;
  stageIndex: number;
  playerCount: number;
  rawBaseUrl: string;
  onSubmit: () => void;
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
  const { store, position, stageIndex, playerCount, rawBaseUrl, onSubmit } =
    options;

  const textContentCache = new Map<string, Promise<string>>();

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

    getAssetURL(path: string): string {
      return rawBaseUrl + path;
    },

    getTextContent(path: string): Promise<string> {
      const cached = textContentCache.get(path);
      if (cached) return cached;

      const promise = fetch(rawBaseUrl + path).then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to fetch ${path} (HTTP ${res.status})`);
        }
        return res.text();
      });

      textContentCache.set(path, promise);
      return promise;
    },

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
