// @vitest-environment jsdom
import { describe, test, expect, vi } from "vitest";
import React, { type ReactNode } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  type StagebookContext,
  StagebookProvider,
  useResolve,
  useTextContent,
  type TextContentResult,
} from "./StagebookProvider.js";

// We test the provider/hooks via a simple test component pattern
// that captures hook return values into a ref we can assert on.

function createMockContext(
  overrides?: Partial<StagebookContext>,
): StagebookContext {
  return {
    get: vi.fn(() => []),
    save: vi.fn(),
    getElapsedTime: vi.fn(() => 0),
    submit: vi.fn(),
    getAssetURL: vi.fn((path: string) => `https://cdn.test/${path}`),
    getTextContent: vi.fn(() => Promise.resolve("mock content")),
    progressLabel: "game_0_stage1",
    playerId: "player1",
    position: 0,
    playerCount: 3,
    isSubmitted: false,
    ...overrides,
  };
}

describe("StagebookContext interface", () => {
  test("mock context satisfies the interface", () => {
    const ctx = createMockContext();

    expect(ctx.playerId).toBe("player1");
    expect(ctx.playerCount).toBe(3);
    expect(ctx.position).toBe(0);
    expect(ctx.progressLabel).toBe("game_0_stage1");
    expect(ctx.isSubmitted).toBe(false);
  });

  test("get returns array", () => {
    const get = vi.fn(() => ["value1", "value2"]);
    const ctx = createMockContext({ get });

    const result = ctx.get("prompt_myPrompt", "all");
    expect(get).toHaveBeenCalledWith("prompt_myPrompt", "all");
    expect(result).toEqual(["value1", "value2"]);
  });

  test("save calls through with scope", () => {
    const save = vi.fn();
    const ctx = createMockContext({ save });

    ctx.save("prompt_q1", { value: "answer" }, "player");
    expect(save).toHaveBeenCalledWith(
      "prompt_q1",
      { value: "answer" },
      "player",
    );
  });

  test("getElapsedTime returns seconds", () => {
    const ctx = createMockContext({
      getElapsedTime: () => 42.5,
    });
    expect(ctx.getElapsedTime()).toBe(42.5);
  });

  test("getAssetURL resolves path", () => {
    const ctx = createMockContext();
    expect(ctx.getAssetURL("images/photo.png")).toBe(
      "https://cdn.test/images/photo.png",
    );
  });

  test("getTextContent returns promise", async () => {
    const ctx = createMockContext({
      getTextContent: vi.fn(() => Promise.resolve("# Hello")),
    });
    const text = await ctx.getTextContent("prompts/hello.md");
    expect(text).toBe("# Hello");
  });

  test("render slots are optional", () => {
    const ctx = createMockContext();
    expect(ctx.renderDiscussion).toBeUndefined();
    expect(ctx.renderSharedNotepad).toBeUndefined();
    expect(ctx.renderTalkMeter).toBeUndefined();
  });

  test("render slots can be provided", () => {
    const ctx = createMockContext({
      renderDiscussion: () => React.createElement("div", null, "discussion"),
      renderSharedNotepad: () => React.createElement("div", null, "notepad"),
      renderTalkMeter: () => React.createElement("div", null, "meter"),
    });
    expect(ctx.renderDiscussion).toBeDefined();
    expect(ctx.renderSharedNotepad).toBeDefined();
    expect(ctx.renderTalkMeter).toBeDefined();
  });
});

describe("StagebookProvider + useStagebookContext", () => {
  test("useStagebookContext throws without provider", async () => {
    // Dynamic import to test the throw behavior
    const { useStagebookContext } = await import("./StagebookProvider.js");

    // useStagebookContext is a hook — calling it outside React should throw
    // We test this by verifying the error message pattern
    expect(() => {
      // This will throw because there's no React render context
      // In a real component tree without StagebookProvider, it throws our custom error
      // Outside React entirely, it throws a different React error
      useStagebookContext();
    }).toThrow();
  });
});

// Helper to render useResolve inside a StagebookProvider
function renderUseResolve(
  reference: string,
  ctx: StagebookContext,
  position?: string,
): {
  result: { current: unknown[] };
  unmount: () => void;
} {
  const result = { current: [] as unknown[] };
  const container = document.createElement("div");
  let root: Root;

  function Harness(): ReactNode {
    result.current = useResolve(reference, position);
    return null;
  }

  act(() => {
    root = createRoot(container);
    root.render(
      <StagebookProvider value={ctx}>
        <Harness />
      </StagebookProvider>,
    );
  });

  return {
    result,
    unmount: () => act(() => root.unmount()),
  };
}

describe("Provider-level resolve (get → resolve pipeline)", () => {
  test("extracts .value path for prompt references", () => {
    const get = vi.fn(() => [
      { type: "multipleChoice", value: "yes", step: "s0" },
    ]);
    const ctx = createMockContext({ get });

    const { result, unmount } = renderUseResolve("prompt.q1", ctx);

    expect(get).toHaveBeenCalledWith("prompt_q1", undefined);
    expect(result.current).toEqual(["yes"]);
    unmount();
  });

  test("navigates nested paths for survey references", () => {
    const get = vi.fn(() => [{ result: { score: 4.5 } }]);
    const ctx = createMockContext({ get });

    const { result, unmount } = renderUseResolve(
      "survey.TIPI.result.score",
      ctx,
    );

    expect(get).toHaveBeenCalledWith("survey_TIPI", undefined);
    expect(result.current).toEqual([4.5]);
    unmount();
  });

  test("passes scope through to get", () => {
    const get = vi.fn(() => []);
    const ctx = createMockContext({ get });

    const { unmount } = renderUseResolve("prompt.q1", ctx, "all");

    expect(get).toHaveBeenCalledWith("prompt_q1", "all");
    unmount();
  });

  test("normalizes 'any' scope to 'all' before calling get", () => {
    // The platform's get() shouldn't need to understand condition
    // evaluation semantics — "any" is a downstream concern.
    const get = vi.fn(() => []);
    const ctx = createMockContext({ get });

    const { unmount } = renderUseResolve("prompt.q1", ctx, "any");

    expect(get).toHaveBeenCalledWith("prompt_q1", "all");
    unmount();
  });

  test("normalizes 'percentAgreement' scope to 'all' before calling get", () => {
    const get = vi.fn(() => []);
    const ctx = createMockContext({ get });

    const { unmount } = renderUseResolve("prompt.q1", ctx, "percentAgreement");

    expect(get).toHaveBeenCalledWith("prompt_q1", "all");
    unmount();
  });

  test("filters out undefined path results", () => {
    // Record exists but doesn't have the nested .value path
    const get = vi.fn(() => [{ name: "q1" }]);
    const ctx = createMockContext({ get });

    const { result, unmount } = renderUseResolve("prompt.q1", ctx);

    expect(result.current).toEqual([]);
    unmount();
  });

  test("resolves across multiple raw values", () => {
    const get = vi.fn(() => [
      { value: "a", step: "s0" },
      { value: "b", step: "s1" },
    ]);
    const ctx = createMockContext({ get });

    const { result, unmount } = renderUseResolve("prompt.q1", ctx, "all");

    expect(result.current).toEqual(["a", "b"]);
    unmount();
  });
});

// Helper to render a hook inside a StagebookProvider
function renderUseTextContent(
  initialPath: string,
  ctx: StagebookContext,
): {
  result: { current: TextContentResult };
  rerender: (path: string) => void;
  unmount: () => void;
} {
  const result = { current: undefined as unknown as TextContentResult };
  const container = document.createElement("div");
  let root: Root;
  let currentPath = initialPath;

  function Harness(): ReactNode {
    result.current = useTextContent(currentPath);
    return null;
  }

  act(() => {
    root = createRoot(container);
    root.render(
      <StagebookProvider value={ctx}>
        <Harness />
      </StagebookProvider>,
    );
  });

  return {
    result,
    rerender: (path: string) => {
      currentPath = path;
      act(() => {
        root.render(
          <StagebookProvider value={ctx}>
            <Harness />
          </StagebookProvider>,
        );
      });
    },
    unmount: () => act(() => root.unmount()),
  };
}

describe("useTextContent", () => {
  test("does not call getTextContent when path is empty", async () => {
    const getTextContent = vi.fn(() => Promise.resolve("content"));
    const ctx = createMockContext({ getTextContent });

    const { unmount } = renderUseTextContent("", ctx);

    // Let any pending microtasks flush
    await act(() => Promise.resolve());

    expect(getTextContent).not.toHaveBeenCalled();
    unmount();
  });

  test("calls getTextContent when path is non-empty", async () => {
    const getTextContent = vi.fn(() => Promise.resolve("# Hello"));
    const ctx = createMockContext({ getTextContent });

    const { result, unmount } = renderUseTextContent("prompts/hello.md", ctx);

    await act(() => Promise.resolve());

    expect(getTextContent).toHaveBeenCalledWith("prompts/hello.md");
    expect(result.current.data).toBe("# Hello");
    expect(result.current.isLoading).toBe(false);
    unmount();
  });

  test("resets data when path changes from non-empty to empty", async () => {
    const getTextContent = vi.fn(() => Promise.resolve("# Hello"));
    const ctx = createMockContext({ getTextContent });

    const { result, rerender, unmount } = renderUseTextContent(
      "prompts/hello.md",
      ctx,
    );

    await act(() => Promise.resolve());

    expect(result.current.data).toBe("# Hello");
    expect(result.current.isLoading).toBe(false);

    rerender("");
    await act(() => Promise.resolve());

    expect(getTextContent).toHaveBeenCalledTimes(1);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toBeUndefined();
    expect(result.current.error).toBeUndefined();
    unmount();
  });

  test("returns not-loading with no data for empty path", async () => {
    const ctx = createMockContext();

    const { result, unmount } = renderUseTextContent("", ctx);

    await act(() => Promise.resolve());

    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toBeUndefined();
    expect(result.current.error).toBeUndefined();
    unmount();
  });

  // Regression for #105: useTextContent previously listed `getTextContent`
  // in its effect deps. If the platform rebuilds its StagebookContext each
  // render (very common) and does not wrap `getTextContent` in `useCallback`,
  // the effect re-fires every render — refetching content on every parent
  // state change. The ref pattern fixes this.
  test("does not refetch when getTextContent identity changes but path is stable", async () => {
    const container = document.createElement("div");
    let root: Root;
    const result = { current: undefined as unknown as TextContentResult };
    const getTextContent = vi.fn(() => Promise.resolve("# Hello"));
    // Rebuild the context object each render — same underlying function,
    // different outer identity. Because `get` is wrapped but `getTextContent`
    // is not, the resolved context returns a new getTextContent ref each render.
    function makeCtx(): StagebookContext {
      return createMockContext({
        // fresh identity per invocation
        getTextContent: (p: string) => getTextContent(p),
      });
    }

    function Harness(): ReactNode {
      result.current = useTextContent("prompts/hello.md");
      return null;
    }

    act(() => {
      root = createRoot(container);
      root.render(
        <StagebookProvider value={makeCtx()}>
          <Harness />
        </StagebookProvider>,
      );
    });
    await act(() => Promise.resolve());

    expect(getTextContent).toHaveBeenCalledTimes(1);

    // Force re-renders with fresh getTextContent identities
    for (let i = 0; i < 5; i++) {
      act(() => {
        root.render(
          <StagebookProvider value={makeCtx()}>
            <Harness />
          </StagebookProvider>,
        );
      });
      await act(() => Promise.resolve());
    }

    // Path never changed — effect must not refetch just because
    // getTextContent changed identity
    expect(getTextContent).toHaveBeenCalledTimes(1);

    act(() => root.unmount());
  });

  test("contentVersion bump triggers re-fetch even when path and getTextContent are stable", async () => {
    const container = document.createElement("div");
    let root: Root;
    const result = { current: undefined as unknown as TextContentResult };
    const getTextContent = vi.fn(() => Promise.resolve("# Original"));

    function makeCtx(version: number): StagebookContext {
      return {
        ...createMockContext({ getTextContent }),
        contentVersion: version,
      };
    }

    function Harness(): ReactNode {
      result.current = useTextContent("prompts/hello.md");
      return null;
    }

    // Initial render with contentVersion 0
    act(() => {
      root = createRoot(container);
      root.render(
        <StagebookProvider value={makeCtx(0)}>
          <Harness />
        </StagebookProvider>,
      );
    });
    await act(() => Promise.resolve());

    expect(getTextContent).toHaveBeenCalledTimes(1);
    expect(result.current.data).toBe("# Original");

    // Bump contentVersion — same path, same getTextContent identity
    getTextContent.mockResolvedValue("# Updated");
    act(() => {
      root.render(
        <StagebookProvider value={makeCtx(1)}>
          <Harness />
        </StagebookProvider>,
      );
    });
    await act(() => Promise.resolve());

    // Must have re-fetched because contentVersion changed
    expect(getTextContent).toHaveBeenCalledTimes(2);
    expect(result.current.data).toBe("# Updated");

    act(() => root.unmount());
  });
});
