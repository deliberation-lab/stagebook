import { describe, it, expect } from "vitest";
import { ViewerStateStore } from "./store";

describe("ViewerStateStore", () => {
  describe("save and get", () => {
    it("stores and retrieves a player-scoped value", () => {
      const store = new ViewerStateStore();
      store.save("prompt_q1", { value: "yes" }, "player", 0, 2);
      expect(store.get(0, "prompt_q1")).toEqual({
        value: { value: "yes" },
        setOnStageIndex: 2,
      });
    });

    it("stores and retrieves a shared-scoped value", () => {
      const store = new ViewerStateStore();
      store.save("prompt_q1", { value: "yes" }, "shared", 0, 1);
      expect(store.get("shared", "prompt_q1")).toEqual({
        value: { value: "yes" },
        setOnStageIndex: 1,
      });
    });

    it("overwrites an existing value", () => {
      const store = new ViewerStateStore();
      store.save("prompt_q1", { value: "yes" }, "player", 0, 1);
      store.save("prompt_q1", { value: "no" }, "player", 0, 2);
      expect(store.get(0, "prompt_q1")?.value).toEqual({ value: "no" });
      expect(store.get(0, "prompt_q1")?.setOnStageIndex).toBe(2);
    });

    it("returns undefined for missing keys", () => {
      const store = new ViewerStateStore();
      expect(store.get(0, "prompt_missing")).toBeUndefined();
    });
  });

  describe("getAll", () => {
    it("returns all entries across positions", () => {
      const store = new ViewerStateStore();
      store.save("prompt_q1", { value: "a" }, "player", 0, 0);
      store.save("prompt_q1", { value: "b" }, "player", 1, 0);
      store.save("prompt_q2", { value: "c" }, "shared", 0, 1);

      const all = store.getAll();
      expect(all).toHaveLength(3);
    });
  });

  describe("resolve", () => {
    it("resolves a prompt reference for a specific position", () => {
      const store = new ViewerStateStore();
      store.save("prompt_q1", { value: "yes" }, "player", 0, 0);
      const values = store.resolve("prompt.q1", 0);
      expect(values).toEqual(["yes"]);
    });

    it("resolves a prompt reference across all positions", () => {
      const store = new ViewerStateStore();
      store.save("prompt_q1", { value: "yes" }, "player", 0, 0);
      store.save("prompt_q1", { value: "no" }, "player", 1, 0);
      const values = store.resolve("prompt.q1");
      expect(values).toEqual(["yes", "no"]);
    });

    it("resolves a shared reference", () => {
      const store = new ViewerStateStore();
      store.save("prompt_q1", { value: "shared-val" }, "shared", 0, 0);
      const values = store.resolve("prompt.q1", "shared");
      expect(values).toEqual(["shared-val"]);
    });

    it("returns empty array for missing references", () => {
      const store = new ViewerStateStore();
      const values = store.resolve("prompt.missing", 0);
      expect(values).toEqual([]);
    });

    it("navigates nested paths for non-prompt types", () => {
      const store = new ViewerStateStore();
      store.save("survey_TIPI", { result: { score: 4.5 } }, "player", 0, 0);
      const values = store.resolve("survey.TIPI.result.score", 0);
      expect(values).toEqual([4.5]);
    });
  });

  describe("submitted and elapsedTime", () => {
    it("tracks submitted state per stage", () => {
      const store = new ViewerStateStore();
      expect(store.getSubmitted(0)).toBe(false);
      store.setSubmitted(0, true);
      expect(store.getSubmitted(0)).toBe(true);
      store.setSubmitted(0, false);
      expect(store.getSubmitted(0)).toBe(false);
    });

    it("tracks elapsed time per stage", () => {
      const store = new ViewerStateStore();
      expect(store.getElapsedTime(0)).toBe(0);
      store.setElapsedTime(0, 45);
      expect(store.getElapsedTime(0)).toBe(45);
    });
  });

  describe("set (direct write for inspector)", () => {
    it("allows setting a value directly by position and key", () => {
      const store = new ViewerStateStore();
      store.set(0, "prompt_q1", { value: "injected" }, 1);
      expect(store.get(0, "prompt_q1")).toEqual({
        value: { value: "injected" },
        setOnStageIndex: 1,
      });
    });
  });

  describe("onChange", () => {
    it("notifies listeners on save", () => {
      const store = new ViewerStateStore();
      const calls: unknown[] = [];
      store.onChange(() => calls.push("changed"));
      store.save("prompt_q1", { value: "yes" }, "player", 0, 0);
      expect(calls).toEqual(["changed"]);
    });

    it("notifies listeners on set", () => {
      const store = new ViewerStateStore();
      const calls: unknown[] = [];
      store.onChange(() => calls.push("changed"));
      store.set(0, "prompt_q1", { value: "yes" }, 0);
      expect(calls).toEqual(["changed"]);
    });

    it("returns an unsubscribe function", () => {
      const store = new ViewerStateStore();
      const calls: unknown[] = [];
      const unsub = store.onChange(() => calls.push("changed"));
      store.save("prompt_q1", { value: "a" }, "player", 0, 0);
      unsub();
      store.save("prompt_q1", { value: "b" }, "player", 0, 0);
      expect(calls).toEqual(["changed"]);
    });
  });
});
