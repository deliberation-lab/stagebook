import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { PlaybackHandle } from "./PlaybackHandle.js";

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface PlaybackRegistry {
  handles: Map<string, PlaybackHandle>;
  register: (name: string, handle: PlaybackHandle) => void;
  unregister: (name: string) => void;
}

const PlaybackContext = createContext<PlaybackRegistry | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function PlaybackProvider({ children }: { children: React.ReactNode }) {
  const [handles, setHandles] = useState<Map<string, PlaybackHandle>>(
    () => new Map(),
  );

  const register = useCallback((name: string, handle: PlaybackHandle) => {
    setHandles((prev) => {
      if (prev.get(name) === handle) return prev;
      return new Map(prev).set(name, handle);
    });
  }, []);

  const unregister = useCallback((name: string) => {
    setHandles((prev) => {
      if (!prev.has(name)) return prev;
      const next = new Map(prev);
      next.delete(name);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ handles, register, unregister }),
    [handles, register, unregister],
  );

  return (
    <PlaybackContext.Provider value={value}>
      {children}
    </PlaybackContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * Register a PlaybackHandle under `name` for the duration of the component's
 * life. Safe to call without a PlaybackProvider — silently no-ops.
 */
export function useRegisterPlayback(
  name: string,
  handle: PlaybackHandle,
): void {
  const ctx = useContext(PlaybackContext);
  // Extract the stable callbacks so the effect depends on them directly
  // rather than on the full context object (which changes whenever handles
  // state updates). register/unregister are useCallback([]) so they only
  // change if a different PlaybackProvider instance is mounted.
  const register = ctx?.register;
  const unregister = ctx?.unregister;

  useEffect(() => {
    if (!register || !unregister) return; // no PlaybackProvider — no-op
    register(name, handle);
    return () => unregister(name);
  }, [name, handle, register, unregister]);
}

/**
 * Look up a PlaybackHandle by the name registered by a sibling MediaPlayer.
 * Returns `undefined` if no player with that name is mounted yet.
 * Must be called inside a PlaybackProvider.
 */
export function usePlayback(source: string): PlaybackHandle | undefined {
  const ctx = useContext(PlaybackContext);
  return ctx?.handles.get(source);
}
