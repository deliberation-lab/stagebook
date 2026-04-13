import React from "react";
import { PlaybackProvider } from "./PlaybackProvider.js";

/**
 * Thin wrapper used in component tests to avoid Playwright CT's Vite bundler
 * generating a duplicate identifier when a named export is aliased in a test
 * file that shares a base name with the source file.
 */
export function TestProvider({ children }: { children: React.ReactNode }) {
  return <PlaybackProvider>{children}</PlaybackProvider>;
}
