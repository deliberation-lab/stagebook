// @vitest-environment jsdom
//
// Runtime render coverage for the load-time diagnostics UI (#440). Uses the
// production-ish react-dom/client + act harness (matching the other viewer
// .test.tsx files) so hook/render regressions surface here rather than in the
// browser.
import { describe, it, expect } from "vitest";
import React, { type ReactNode } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { DiagnosticsDrawer, DiagnosticsList } from "./DiagnosticsPanel";
import type { ViewerDiagnostic } from "../lib/diagnostics";

function render(node: ReactNode): {
  container: HTMLElement;
  unmount: () => void;
} {
  const container = document.createElement("div");
  document.body.appendChild(container);
  let root: Root;
  act(() => {
    root = createRoot(container);
    root.render(node);
  });
  return {
    container,
    unmount: () =>
      act(() => {
        root.unmount();
        container.remove();
      }),
  };
}

function clickHeader(container: HTMLElement): void {
  const button = container.querySelector("button");
  if (!button) throw new Error("drawer header button not found");
  act(() => {
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

const err = (
  message: string,
  file = "study.stagebook.yaml",
): ViewerDiagnostic => ({
  message,
  severity: "error",
  range: { startLine: 4, startCol: 2, endLine: 4, endCol: 6 },
  file,
});

const warn = (
  message: string,
  file = "study.stagebook.yaml",
): ViewerDiagnostic => ({
  message,
  severity: "warning",
  range: null,
  file,
});

describe("DiagnosticsDrawer", () => {
  it("renders nothing when there are no diagnostics", () => {
    const { container, unmount } = render(
      <DiagnosticsDrawer diagnostics={[]} />,
    );
    expect(container.textContent).toBe("");
    expect(container.querySelector("button")).toBeNull();
    unmount();
  });

  it("summarizes counts with correct pluralization", () => {
    const { container, unmount } = render(
      <DiagnosticsDrawer diagnostics={[err("a"), err("b"), warn("c")]} />,
    );
    expect(container.querySelector("button")!.textContent).toContain(
      "2 errors, 1 warning",
    );
    unmount();
  });

  it("shows a single warning label when there are no errors", () => {
    const { container, unmount } = render(
      <DiagnosticsDrawer diagnostics={[warn("only a warning")]} />,
    );
    expect(container.querySelector("button")!.textContent).toContain(
      "1 warning",
    );
    expect(container.querySelector("button")!.textContent).not.toContain(
      "error",
    );
    unmount();
  });

  it("collapses and expands the list when the header is toggled", () => {
    const { container, unmount } = render(
      <DiagnosticsDrawer diagnostics={[err("boom message")]} />,
    );
    // Expanded by default — the message is visible.
    expect(container.textContent).toContain("boom message");
    clickHeader(container); // collapse
    expect(container.querySelectorAll("li")).toHaveLength(0);
    clickHeader(container); // expand again
    expect(container.textContent).toContain("boom message");
    unmount();
  });
});

describe("DiagnosticsList", () => {
  it("renders message, file, and a 1-based position for ranged diagnostics", () => {
    const { container, unmount } = render(
      <DiagnosticsList diagnostics={[err("bad value", "a.stagebook.yaml")]} />,
    );
    const text = container.textContent ?? "";
    expect(text).toContain("bad value");
    // 0-based range (4,2) → 1-based display (5:3).
    expect(text).toContain("a.stagebook.yaml:5:3");
    unmount();
  });

  it("omits the position for unpositioned diagnostics", () => {
    const { container, unmount } = render(
      <DiagnosticsList
        diagnostics={[warn("locale mismatch", "prompts/q.prompt.md")]}
      />,
    );
    const text = container.textContent ?? "";
    expect(text).toContain("prompts/q.prompt.md");
    expect(text).not.toContain("prompts/q.prompt.md:");
    unmount();
  });

  it("orders errors ahead of warnings and positioned ahead of unpositioned", () => {
    const { container, unmount } = render(
      <DiagnosticsList
        diagnostics={[warn("second unpositioned"), err("first positioned")]}
      />,
    );
    const items = Array.from(container.querySelectorAll("li")).map(
      (li) => li.textContent ?? "",
    );
    expect(items[0]).toContain("first positioned");
    expect(items[1]).toContain("second unpositioned");
    unmount();
  });
});
