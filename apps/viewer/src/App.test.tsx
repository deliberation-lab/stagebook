// @vitest-environment jsdom
//
// Routing coverage for the #440 load outcomes: the split between a file that
// loaded-but-can't-render (→ diagnostics placeholder) and a hard failure like a
// network/import error (→ plain error screen). Uses the same jsdom +
// react-dom/client + act harness as the other viewer .test.tsx files, and mocks
// the loader so the routing is exercised without any network.
import { describe, it, expect, beforeEach, vi } from "vitest";
import React, { type ReactNode } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { LoadResult } from "./lib/loader";

const { mockLoad } = vi.hoisted(() => ({ mockLoad: vi.fn() }));
vi.mock("./lib/loader", () => ({
  loadTreatmentFromUrl: (url: string) => mockLoad(url) as Promise<LoadResult>,
}));

import { App } from "./App";

async function render(node: ReactNode): Promise<{
  container: HTMLElement;
  unmount: () => void;
}> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  let root: Root;
  await act(async () => {
    root = createRoot(container);
    root.render(node);
  });
  // Flush the async auto-load (loading → resolved outcome).
  await act(async () => {});
  await act(async () => {});
  return {
    container,
    unmount: () =>
      act(() => {
        root.unmount();
        container.remove();
      }),
  };
}

beforeEach(() => {
  mockLoad.mockReset();
  // The App auto-loads whatever is in ?url= on mount.
  window.history.replaceState(
    {},
    "",
    "/?url=https://github.com/org/repo/blob/main/study.stagebook.yaml",
  );
});

describe("App load routing (#440)", () => {
  it("routes a null treatmentFile to the diagnostics placeholder", async () => {
    mockLoad.mockResolvedValue({
      treatmentFile: null,
      diagnostics: [
        {
          message: "playerCount must be a number",
          severity: "error",
          range: { startLine: 4, startCol: 2, endLine: 4, endCol: 6 },
          file: "study.stagebook.yaml",
        },
        {
          message: "duplicate key",
          severity: "warning",
          range: null,
          file: "study.stagebook.yaml",
        },
      ],
      unresolvedFields: [],
      rawBaseUrl: "",
    } satisfies LoadResult);

    const { container, unmount } = await render(<App />);
    const text = container.textContent ?? "";
    expect(text).toContain("can’t be previewed");
    expect(text).toContain("2 problems found");
    expect(text).toContain("playerCount must be a number");
    expect(text).toContain("duplicate key");
    unmount();
  });

  it("uses singular 'problem' for a single diagnostic", async () => {
    mockLoad.mockResolvedValue({
      treatmentFile: null,
      diagnostics: [
        {
          message: "only one problem",
          severity: "error",
          range: null,
          file: "study.stagebook.yaml",
        },
      ],
      unresolvedFields: [],
      rawBaseUrl: "",
    } satisfies LoadResult);

    const { container, unmount } = await render(<App />);
    expect(container.textContent ?? "").toContain("1 problem found");
    unmount();
  });

  it("routes a thrown error (network/import failure) to the error screen", async () => {
    mockLoad.mockRejectedValue(new Error("Failed to fetch imported file"));

    const { container, unmount } = await render(<App />);
    const text = container.textContent ?? "";
    expect(text).toContain("Failed to load");
    expect(text).toContain("Failed to fetch imported file");
    // The diagnostics placeholder must NOT be used for hard failures.
    expect(text).not.toContain("can’t be previewed");
    unmount();
  });
});
