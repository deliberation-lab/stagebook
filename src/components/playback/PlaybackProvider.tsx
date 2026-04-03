import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { PlaybackHandle } from "./PlaybackHandle.js";

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface PlaybackRegistry {
  handles: Map<string, PlaybackHandle>;
  register(name: string, handle: PlaybackHandle): void;
  unregister(name: string): void;
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
    setHandles((prev) => new Map(prev).set(name, handle));
  }, []);

  const unregister = useCallback((name: string) => {
    setHandles((prev) => {
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
  // Keep a stable ref to the handle so we don't re-register on every render.
  const handleRef = useRef(handle);
  handleRef.current = handle;

  useEffect(() => {
    if (!ctx) return; // no PlaybackProvider above — intentional no-op
    ctx.register(name, handleRef.current);
    return () => ctx.unregister(name);
  }, [name, ctx]);
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
