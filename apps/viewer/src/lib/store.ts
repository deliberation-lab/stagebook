import { getReferenceKeyAndPath, getNestedValueByPath } from "stagebook";

export type PositionKey = number | "shared";

export interface StoreEntry {
  value: unknown;
  setOnStageIndex: number;
}

export interface StoreRecord {
  positionKey: PositionKey;
  storeKey: string;
  entry: StoreEntry;
}

type Listener = () => void;

export class ViewerStateStore {
  private data = new Map<PositionKey, Map<string, StoreEntry>>();
  private submitted = new Map<number, boolean>();
  private elapsed = new Map<number, number>();
  private listeners = new Set<Listener>();

  /** Write a value via the save() contract (position-scoped or shared). */
  save(
    key: string,
    value: unknown,
    scope: "player" | "shared",
    position: number,
    stageIndex: number,
  ): void {
    const posKey: PositionKey = scope === "shared" ? "shared" : position;
    this.set(posKey, key, value, stageIndex);
  }

  /** Direct write — used by the state inspector to inject values. */
  set(
    positionKey: PositionKey,
    storeKey: string,
    value: unknown,
    stageIndex: number,
  ): void {
    let bucket = this.data.get(positionKey);
    if (!bucket) {
      bucket = new Map();
      this.data.set(positionKey, bucket);
    }
    bucket.set(storeKey, { value, setOnStageIndex: stageIndex });
    this.notify();
  }

  /** Read a single entry by position and key. */
  get(positionKey: PositionKey, storeKey: string): StoreEntry | undefined {
    return this.data.get(positionKey)?.get(storeKey);
  }

  /** Return all entries across all positions. */
  getAll(): StoreRecord[] {
    const records: StoreRecord[] = [];
    for (const [positionKey, bucket] of this.data) {
      for (const [storeKey, entry] of bucket) {
        records.push({ positionKey, storeKey, entry });
      }
    }
    return records;
  }

  /**
   * Resolve a DSL reference (e.g. "prompt.q1") against the store.
   * If position is a number, returns that position's value.
   * If position is "shared", returns the shared value.
   * If position is undefined, returns values from all player positions.
   */
  resolve(reference: string, position?: number | "shared"): unknown[] {
    const { referenceKey, path } = getReferenceKeyAndPath(reference);

    if (position === "shared") {
      return this.resolveOne("shared", referenceKey, path);
    }

    if (position !== undefined) {
      return this.resolveOne(position, referenceKey, path);
    }

    // No position specified — collect from all player positions
    const values: unknown[] = [];
    for (const [posKey, bucket] of this.data) {
      if (posKey === "shared") continue;
      const entry = bucket.get(referenceKey);
      if (entry !== undefined) {
        const resolved = getNestedValueByPath(entry.value, path);
        if (resolved !== undefined) {
          values.push(resolved);
        }
      }
    }
    return values;
  }

  private resolveOne(
    posKey: PositionKey,
    referenceKey: string,
    path: string[],
  ): unknown[] {
    const entry = this.data.get(posKey)?.get(referenceKey);
    if (entry === undefined) return [];
    const resolved = getNestedValueByPath(entry.value, path);
    return resolved !== undefined ? [resolved] : [];
  }

  // --- Submitted ---

  getSubmitted(stageIndex: number): boolean {
    return this.submitted.get(stageIndex) ?? false;
  }

  setSubmitted(stageIndex: number, value: boolean): void {
    this.submitted.set(stageIndex, value);
    this.notify();
  }

  // --- Elapsed time ---

  getElapsedTime(stageIndex: number): number {
    return this.elapsed.get(stageIndex) ?? 0;
  }

  setElapsedTime(stageIndex: number, seconds: number): void {
    this.elapsed.set(stageIndex, seconds);
    this.notify();
  }

  // --- Change notification ---

  onChange(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}
