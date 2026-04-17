/**
 * Test harness for ElementErrorBoundary CT tests.
 *
 * Constructs the full tree (StagebookProvider + ElementErrorBoundary + a
 * controlled child) from simple serializable props so Playwright CT's JSX
 * children transform doesn't affect the DOM under test.
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

function throwingCallback(): never {
  throw new Error("callback-intentionally-throws");
}

function buildMockContext(
  callbackMode: "none" | "record" | "throw",
): StagebookContext {
  const onElementError =
    callbackMode === "record"
      ? recordElementError
      : callbackMode === "throw"
        ? throwingCallback
        : undefined;
  return {
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
    onElementError,
  };
}

function CrashingChild({ message }: { message: string }): React.ReactElement {
  throw new Error(message);
}

export interface BoundaryTestHarnessProps {
  elementType: string;
  elementName?: string;
  callbackMode?: "none" | "record" | "throw";
  /** If provided, the child throws with this message. Otherwise renders a happy child. */
  crashMessage?: string;
  happyText?: string;
}

export function BoundaryTestHarness({
  elementType,
  elementName,
  callbackMode = "none",
  crashMessage,
  happyText = "happy-path-content",
}: BoundaryTestHarnessProps) {
  return (
    <StagebookProvider value={buildMockContext(callbackMode)}>
      <ElementErrorBoundary elementType={elementType} elementName={elementName}>
        {crashMessage !== undefined ? (
          <CrashingChild message={crashMessage} />
        ) : (
          <p data-testid="happy-child">{happyText}</p>
        )}
      </ElementErrorBoundary>
    </StagebookProvider>
  );
}

export interface SiblingLayoutProps {
  leftText: string;
  rightText: string;
  crashMessage: string;
  elementNames: [string, string, string];
}

export function SiblingLayout({
  leftText,
  rightText,
  crashMessage,
  elementNames,
}: SiblingLayoutProps) {
  return (
    <StagebookProvider value={buildMockContext("none")}>
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
