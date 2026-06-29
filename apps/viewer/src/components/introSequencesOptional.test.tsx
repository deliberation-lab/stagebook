// @vitest-environment jsdom
//
// Regression guard for the crash that shipped twice (#479): a treatments-only
// treatment file (no `introSequences:`) must render in every host component
// that reads `introSequences`. `altTemplateContext` types that field as `any`
// in the built .d.ts, so tsc can't catch a `.length`/`.map`/`[idx]`-on-
// undefined regression — these render tests are the guard. Also pins the
// viewer's per-phase locale (intro sequence vs treatment).
import { describe, it, expect, beforeAll } from "vitest";
import React, { type ReactNode } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { TreatmentFileType } from "stagebook";
import { OverviewPage } from "./OverviewPage";
import { TreatmentPicker } from "./TreatmentPicker";
import { Viewer } from "./Viewer";

beforeAll(() => {
  // jsdom lacks these; Viewer's scroll-awareness + Stage touch them.
  if (!("ResizeObserver" in globalThis)) {
    (globalThis as { ResizeObserver?: unknown }).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  if (!window.matchMedia) {
    window.matchMedia = (() => ({
      matches: false,
      addEventListener() {},
      removeEventListener() {},
    })) as unknown as typeof window.matchMedia;
  }
});

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

const noop = () => {};
const getText = () => Promise.resolve("# x");
const getAsset = (p: string) => p;

/** A valid treatments-only file: no `introSequences:` key at all. */
function treatmentsOnlyFile(locale?: string): TreatmentFileType {
  return {
    treatments: [
      {
        name: "study1",
        ...(locale ? { locale } : {}),
        playerCount: 1,
        gameStages: [
          { name: "s1", duration: 60, elements: [{ type: "submitButton" }] },
        ],
      },
    ],
  } as unknown as TreatmentFileType;
}

/** he intro sequence + en treatment, to exercise per-phase locale. */
function introHeTreatmentEnFile(): TreatmentFileType {
  return {
    introSequences: [
      {
        name: "intro1",
        locale: "he",
        introSteps: [{ name: "consent", elements: [{ type: "submitButton" }] }],
      },
    ],
    treatments: [
      {
        name: "study1",
        locale: "en",
        playerCount: 1,
        gameStages: [
          { name: "s1", duration: 60, elements: [{ type: "submitButton" }] },
        ],
      },
    ],
  } as unknown as TreatmentFileType;
}

describe("treatments-only file renders (no introSequences)", () => {
  it("OverviewPage does not crash", () => {
    const { container, unmount } = render(
      <OverviewPage
        treatmentFile={treatmentsOnlyFile()}
        readmeContent={null}
        onSelect={noop}
      />,
    );
    expect(container.textContent).toBeTruthy();
    unmount();
  });

  it("TreatmentPicker does not crash", () => {
    const { container, unmount } = render(
      <TreatmentPicker treatmentFile={treatmentsOnlyFile()} onSelect={noop} />,
    );
    expect(container.textContent).toBeTruthy();
    unmount();
  });

  it("Viewer does not crash and starts at the first game stage", () => {
    const { container, unmount } = render(
      <Viewer
        treatmentFile={treatmentsOnlyFile("he")}
        getTextContent={getText}
        getAssetURL={getAsset}
        selectedIntroIndex={0}
        selectedTreatmentIndex={0}
      />,
    );
    // Renders, and the locale badge shows the treatment's declared locale
    // (no intro phase to override it).
    const badge = container.querySelector(
      '[data-testid="viewer-locale-badge"]',
    );
    expect(badge?.textContent).toBe("he");
    unmount();
  });
});

describe("viewer unit selection (one unit at a time)", () => {
  it("the locale badge follows the SELECTED unit (intro vs treatment)", () => {
    const { container, unmount } = render(
      <Viewer
        treatmentFile={introHeTreatmentEnFile()}
        getTextContent={getText}
        getAssetURL={getAsset}
        selectedIntroIndex={0}
        selectedTreatmentIndex={0}
      />,
    );
    const badge = () =>
      container.querySelector('[data-testid="viewer-locale-badge"]')
        ?.textContent;
    // Starts on the treatment unit (en).
    expect(badge()).toBe("en");

    // Switch to the intro-sequence unit via the part picker → badge flips to he
    // (each unit declares its own locale; the catalog re-resolves).
    const picker = container.querySelector(
      'select[aria-label="Part to preview"]',
    ) as HTMLSelectElement | null;
    expect(picker).not.toBeNull();
    act(() => {
      picker!.value = "intro:0";
      picker!.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(badge()).toBe("he");
    unmount();
  });

  it("ends a unit with a transition screen, not a stage", () => {
    const { container, unmount } = render(
      <Viewer
        treatmentFile={introHeTreatmentEnFile()}
        getTextContent={getText}
        getAssetURL={getAsset}
        selectedIntroIndex={0}
        selectedTreatmentIndex={0}
      />,
    );
    // The treatment unit here is one stage + a transition. Navigate to the
    // last step (the transition) via StageNav's stage <select>.
    const stageSelect = container.querySelector(
      'select[aria-label="Stage"], select[title="Stage"]',
    ) as HTMLSelectElement | null;
    // Fallback: the stage selector is the one whose options are stage indices.
    const selects = Array.from(container.querySelectorAll("select"));
    const nav =
      stageSelect ??
      (selects.find((sel) =>
        Array.from(sel.options).some((o) => o.value === "1"),
      ) as HTMLSelectElement | undefined);
    expect(nav).toBeTruthy();
    act(() => {
      nav!.value = "1";
      nav!.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(
      container.querySelector('[data-testid="viewer-transition"]'),
    ).not.toBeNull();
    unmount();
  });
});
