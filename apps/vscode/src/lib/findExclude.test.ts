import { describe, it, expect } from "vitest";
import { buildFindExcludeGlob } from "./findExclude";

describe("buildFindExcludeGlob", () => {
  it("returns undefined when there is nothing to exclude", () => {
    expect(buildFindExcludeGlob({}, {}, [])).toBeUndefined();
  });

  it("returns a bare pattern (no braces) for a single exclude", () => {
    expect(buildFindExcludeGlob({}, {}, ["**/node_modules/**"])).toBe(
      "**/node_modules/**",
    );
  });

  it("brace-joins multiple patterns", () => {
    expect(
      buildFindExcludeGlob({ "**/dist/**": true }, {}, ["**/node_modules/**"]),
    ).toBe("{**/dist/**,**/node_modules/**}");
  });

  it("merges files.exclude and search.exclude", () => {
    expect(
      buildFindExcludeGlob({ "**/.git": true }, { "**/coverage/**": true }, []),
    ).toBe("{**/.git,**/coverage/**}");
  });

  it("skips patterns explicitly disabled with false", () => {
    expect(
      buildFindExcludeGlob({ "**/.git": true, "**/keepme/**": false }, {}, []),
    ).toBe("**/.git");
  });

  it("treats an object value (e.g. a when-clause) as enabled", () => {
    expect(
      buildFindExcludeGlob({ "**/*.js": { when: "$(basename).ts" } }, {}, []),
    ).toBe("**/*.js");
  });

  it("de-duplicates patterns across all three sources", () => {
    expect(
      buildFindExcludeGlob(
        { "**/node_modules/**": true },
        { "**/node_modules/**": true },
        ["**/node_modules/**"],
      ),
    ).toBe("**/node_modules/**");
  });
});
