/**
 * Test harness for ElementErrorBoundary CT tests.
 *
 * Wraps children in a StagebookProvider with a minimal mock context so the
 * boundary's `useStagebookContext()` call succeeds, and optionally wires an
 * `onElementError` callback that records structured error payloads to
 * `window.__stagebookElementErrors` for the test to inspect.
 */
import React from "react";
import {
  StagebookProvider,
  type StagebookContext,
} from "../StagebookProvider.js";
import {
  ElementErrorBoundary,
  type ElementErrorInfo,
} from "../ElementErrorBoundary.js";

interface RecordedError {
  elementType: string;
  elementName?: string;
  errorMessage: string;
  errorName: string;
  hasErrorInfo: boolean;
}

declare global {
  interface Window {
    __stagebookElementErrors?: RecordedError[];
  }
}

function recordElementError(info: ElementErrorInfo): void {
  window.__stagebookElementErrors ??= [];
  window.__stagebookElementErrors.push({
    elementType: info.elementType,
    elementName: info.elementName,
    errorMessage: info.error.message,
    errorName: info.error.name,
    hasErrorInfo: typeof info.errorInfo.componentStack === "string",
  });
}

export interface BoundaryTestHarnessProps {
  elementType: string;
  elementName?: string;
  withCallback?: boolean;
  children: React.ReactNode;
}

export function BoundaryTestHarness({
  elementType,
  elementName,
  withCallback = false,
  children,
}: BoundaryTestHarnessProps) {
  const ctx: StagebookContext = {
    get: () => [],
    save: () => {},
    getElapsedTime: () => 0,
    submit: () => {},
    getAssetURL: (p: string) => p,
    getTextContent: () => Promise.resolve(""),
    progressLabel: "test",
    playerId: "p1",
    position: 0,
    playerCount: 1,
    isSubmitted: false,
    onElementError: withCallback ? recordElementError : undefined,
  };

  return (
    <StagebookProvider value={ctx}>
      <ElementErrorBoundary elementType={elementType} elementName={elementName}>
        {children}
      </ElementErrorBoundary>
    </StagebookProvider>
  );
}

export function CrashingChild({ message }: { message: string }) {
  throw new Error(message);
}

export function SiblingLayout({
  leftText,
  rightText,
  crashMessage,
  elementNames,
}: {
  leftText: string;
  rightText: string;
  crashMessage: string;
  elementNames: [string, string, string];
}) {
  const ctx: StagebookContext = {
    get: () => [],
    save: () => {},
    getElapsedTime: () => 0,
    submit: () => {},
    getAssetURL: (p: string) => p,
    getTextContent: () => Promise.resolve(""),
    progressLabel: "test",
    playerId: "p1",
    position: 0,
    playerCount: 1,
    isSubmitted: false,
  };
  return (
    <StagebookProvider value={ctx}>
      <ElementErrorBoundary
        elementType="markdown"
        elementName={elementNames[0]}
      >
        <div data-testid="sibling-left">{leftText}</div>
      </ElementErrorBoundary>
      <ElementErrorBoundary
        elementType="markdown"
        elementName={elementNames[1]}
      >
        <CrashingChild message={crashMessage} />
      </ElementErrorBoundary>
      <ElementErrorBoundary
        elementType="markdown"
        elementName={elementNames[2]}
      >
        <div data-testid="sibling-right">{rightText}</div>
      </ElementErrorBoundary>
    </StagebookProvider>
  );
}
