import { describe, it, expect, vi } from "vitest";
import { createViewerContext } from "./context";
import { ViewerStateStore } from "./store";

function makeContext(overrides?: {
  position?: number;
  stageIndex?: number;
  playerCount?: number;
  rawBaseUrl?: string;
  onSubmit?: () => void;
}) {
  const store = new ViewerStateStore();
  const ctx = createViewerContext({
    store,
    position: overrides?.position ?? 0,
    stageIndex: overrides?.stageIndex ?? 0,
    playerCount: overrides?.playerCount ?? 2,
    rawBaseUrl:
      overrides?.rawBaseUrl ??
      "https://raw.githubusercontent.com/org/repo/main/treatments/",
    onSubmit: overrides?.onSubmit ?? (() => {}),
  });
  return { store, ctx };
}

describe("createViewerContext", () => {
  describe("save and resolve", () => {
    it("save writes to store and resolve reads back", () => {
      const { ctx } = makeContext();
      ctx.save("prompt_q1", { value: "yes" });
      const values = ctx.resolve("prompt.q1", "player");
      expect(values).toEqual(["yes"]);
    });

    it("defaults to player scope", () => {
      const { store, ctx } = makeContext({ position: 0 });
      ctx.save("prompt_q1", { value: "yes" });
      // Should be stored under position 0
      expect(store.get(0, "prompt_q1")).toBeDefined();
      expect(store.get("shared", "prompt_q1")).toBeUndefined();
    });

    it("respects shared scope", () => {
      const { store, ctx } = makeContext();
      ctx.save("prompt_q1", { value: "shared-val" }, "shared");
      expect(store.get("shared", "prompt_q1")).toBeDefined();
    });

    it("resolve with numeric string position reads that position", () => {
      const { store, ctx } = makeContext({ position: 0 });
      store.save("prompt_q1", { value: "from-pos-1" }, "player", 1, 0);
      const values = ctx.resolve("prompt.q1", "1");
      expect(values).toEqual(["from-pos-1"]);
    });

    it("resolve with 'all' returns values from all positions", () => {
      const { store, ctx } = makeContext();
      store.save("prompt_q1", { value: "a" }, "player", 0, 0);
      store.save("prompt_q1", { value: "b" }, "player", 1, 0);
      const values = ctx.resolve("prompt.q1", "all");
      expect(values).toEqual(["a", "b"]);
    });

    it("resolve with 'any' returns values from all positions", () => {
      const { store, ctx } = makeContext();
      store.save("prompt_q1", { value: "a" }, "player", 0, 0);
      store.save("prompt_q1", { value: "b" }, "player", 1, 0);
      const values = ctx.resolve("prompt.q1", "any");
      expect(values).toEqual(["a", "b"]);
    });
  });

  describe("submit", () => {
    it("calls the onSubmit callback", () => {
      const onSubmit = vi.fn();
      const { ctx } = makeContext({ onSubmit });
      ctx.submit();
      expect(onSubmit).toHaveBeenCalledOnce();
    });
  });

  describe("getAssetURL", () => {
    it("constructs a raw GitHub URL relative to the base", () => {
      const { ctx } = makeContext();
      const url = ctx.getAssetURL("images/photo.png");
      expect(url).toBe(
        "https://raw.githubusercontent.com/org/repo/main/treatments/images/photo.png",
      );
    });
  });

  describe("getTextContent", () => {
    it("fetches from the raw GitHub URL and caches", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve("file contents"),
      });
      vi.stubGlobal("fetch", mockFetch);

      const { ctx } = makeContext();
      const result1 = await ctx.getTextContent("prompts/q1.prompt.md");
      const result2 = await ctx.getTextContent("prompts/q1.prompt.md");

      expect(result1).toBe("file contents");
      expect(result2).toBe("file contents");
      expect(mockFetch).toHaveBeenCalledTimes(1);

      vi.unstubAllGlobals();
    });
  });

  describe("metadata fields", () => {
    it("exposes position, playerCount, playerId", () => {
      const { ctx } = makeContext({ position: 1, playerCount: 3 });
      expect(ctx.position).toBe(1);
      expect(ctx.playerCount).toBe(3);
      expect(ctx.playerId).toBe("viewer");
    });

    it("exposes isSubmitted based on store state", () => {
      const { store, ctx } = makeContext({ stageIndex: 2 });
      expect(ctx.isSubmitted).toBe(false);
      store.setSubmitted(2, true);
      expect(ctx.isSubmitted).toBe(true);
    });

    it("exposes getElapsedTime from store", () => {
      const { store, ctx } = makeContext({ stageIndex: 1 });
      expect(ctx.getElapsedTime()).toBe(0);
      store.setElapsedTime(1, 30);
      expect(ctx.getElapsedTime()).toBe(30);
    });
  });
});
