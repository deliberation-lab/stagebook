# getTreatments.js Split Plan

`server/src/getTreatments.js` is the main entry point for loading and preparing experiment treatments at runtime. It mixes two concerns: fetching content from external services, and validating/transforming that content against the DSL spec. The fetching is platform-specific (CDN, GitHub, Qualtrics APIs). The validation is DSL logic that belongs in SCORE.

## What moves to SCORE

### `validatePromptString()` (lines 28-82) → `parsePromptFile()` in SCORE

This function takes raw markdown, splits it on `---` delimiters, YAML-parses the metadata section, and validates the structure: prompt type is one of the five valid types, name matches the filename, body section exists, response lines start with `- ` or `> `. The exact same split-and-parse logic is duplicated in `client/src/elements/Prompt.jsx:69-101` for rendering. A unified `parsePromptFile(markdownString)` in SCORE returns `{ metadata, body, responseItems }` and performs all structural validation. The server calls it to validate; the client calls it to render. The TODO comment at line 33 ("this replicates client-side code") goes away.

### Time-bound checks (lines 149-172) → Zod `superRefine` on `stageSchema`

Currently four imperative checks:
```js
if (element.hideTime > duration) throw new Error(...)
if (element.displayTime > duration) throw new Error(...)
if (element.startTime > duration) throw new Error(...)
if (element.endTime > duration) throw new Error(...)
```
These should move into the `stageSchema` definition as a `superRefine`, since the stage has both `duration` and `elements` available for cross-validation. This means `treatmentFileSchema.safeParse()` catches time-bound violations in a single pass, and the runtime loader doesn't need separate imperative checks.

### Shorthand hydration (lines 86-95) → consolidate into Zod `.transform()`

When an element is a bare string like `"myPrompt.md"`, it gets hydrated to `{ file: element, name: element, type: "prompt" }`. The Zod schema already has a `promptShorthandSchema` transform (line 724 of `validateTreatmentFile.ts`) that handles `{ type: "prompt", file: str }`, but it doesn't set `name`. The runtime code adds `name` redundantly. Consolidate so the schema transform also sets `name: str`, making the runtime hydration fully redundant.

### `validateTreatment()` / `validateStage()` / `validateElements()` (lines 188-245) — mostly redundant

These imperative wrappers check that treatments have `playerCount` and `gameStages`, that stages have `name` and `duration`, etc. The Zod `treatmentSchema` already validates all of this. After the time-bound checks and shorthand hydration move into the schema, these functions reduce to "call `safeParse` and report errors." The structural validation disappears; only the fetch-then-validate orchestration remains.

## What stays in deliberation-empirica

- **`getResourceLookup()` (lines 12-26)** — fetches the GitHub repo tree for `deliberation-assets` to build a path→URL lookup. Pure infrastructure.
- **CDN fetch orchestration (lines 249-261)** — `getText({ cdn, path })` to fetch the treatment YAML file from the CDN. Platform-specific.
- **Template expansion call (lines 265-280)** — calls `fillTemplates()` (imported from SCORE). The call site stays; the implementation moves.
- **Zod validation call (lines 282-293)** — `treatmentSchema.safeParse()` for each treatment after template expansion. Imports schema from SCORE.
- **Prompt content fetching (lines 97-118)** — fetches prompt markdown from CDN, then calls `parsePromptFile()` (imported from SCORE). The fetch stays; the parse/validate call changes to a SCORE import.
- **Qualtrics metadata fetch (lines 121-147)** — hits the Qualtrics API to verify a survey exists. Entirely platform-specific.
- **Intro sequence selection (lines 295-309)** and **treatment name matching (lines 311-338)** — runtime orchestration.

## After the split

`getTreatments.js` becomes a thin orchestrator:

1. Fetch YAML from CDN
2. Parse YAML, expand templates (using SCORE's `fillTemplates`)
3. Validate each treatment (using SCORE's `treatmentSchema.safeParse`)
4. For each prompt element: fetch markdown from CDN, parse/validate (using SCORE's `parsePromptFile`)
5. For each Qualtrics element: verify survey exists via Qualtrics API
6. Select requested treatments and intro sequence by name
7. Return the validated, expanded treatments

Steps 2, 3, and 4 use SCORE imports. Steps 1, 5, 6, 7 are platform orchestration.
