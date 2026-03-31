# Deduplication Plan

Six pieces of logic are currently duplicated between `server/src/` and `client/src/` in deliberation-empirica. SCORE unifies each into a single canonical implementation.

## 1. `compare(lhs, comparator, rhs)` — condition evaluator

**Server**: `server/src/utils/comparison.js:18-104`
**Client**: `client/src/components/hooks.js:138-233`

The Zod schema defines 16 canonical comparators: `exists`, `doesNotExist`, `equals`, `doesNotEqual`, `isAbove`, `isBelow`, `isAtLeast`, `isAtMost`, `hasLengthAtLeast`, `hasLengthAtMost`, `includes`, `doesNotInclude`, `matches`, `doesNotMatch`, `isOneOf`, `isNotOneOf`. Both server and client implement all 16.

The client additionally accepts 10 legacy aliases that map to the same operations:

| Canonical (in schema + server + client) | Legacy alias (client only) |
|---|---|
| `doesNotExist` | `notExists` |
| `hasLengthAtLeast` | `lengthAtLeast` |
| `hasLengthAtMost` | `lengthAtMost` |
| `includes` | `include` |
| `doesNotInclude` | `notInclude` |
| `matches` | `match` |
| `doesNotMatch` | `notMatch` |
| `isOneOf` | `oneOf` |
| `isNotOneOf` | `notOneOf` |

These are not different comparators — they're short names from before the schema was standardized. The Zod schema does not accept them; any treatment file using them would fail validation.

One behavioral difference: when `lhs` is `undefined` and the comparator is `doesNotEqual`, the client returns `true` (undefined is not equal to anything) while the server returns `undefined` (comparison cannot be made). The client behavior is the intentional fix.

**SCORE plan**: Use the client implementation as the base but drop the legacy aliases (schema doesn't accept them, so no treatment file can use them). Adopt the client's `doesNotEqual`/`undefined` behavior. Include the two private helpers: `trimSlashes()` and `isNumberOrParsableNumber()`. Define a `Comparator` string literal union type matching the 16 canonical names.

**After**: Server imports `compare` from SCORE, deletes `server/src/utils/comparison.js`. Client imports `compare` from SCORE, removes the inline implementation from `hooks.js`.

## 2. Reference key parsing

**Server**: `server/src/utils/reference.js:4-37` — `getReference({reference, player})`
**Client**: `client/src/components/referenceResolver.js:16-48` — `getReferenceKeyAndPath(reference)`

Both parse DSL reference strings like `prompt.foo` or `survey.bar.result.score` into a storage key and a nested path. Two differences:

**Namespace coverage**: The server handles 6 namespaces: `survey`, `submitButton`, `qualtrics`, `prompt`, `trackedLink`, `urlParams`/`connectionInfo`/`browserInfo`. The client handles those plus `participantInfo` and `discussion`.

**Coupling**: The server function mixes parsing with Empirica `.get()` calls. The client cleanly separates parsing (`getReferenceKeyAndPath`) from data fetching (`resolveReferenceValues`).

**SCORE plan**: Use the client's `getReferenceKeyAndPath()` as the canonical implementation with all namespaces. The Empirica-coupled `resolveReferenceValues()` stays in deliberation-empirica.

**After**: Server replaces `getReference()` with SCORE's `getReferenceKeyAndPath()` plus a local `.get()` call. Client imports `getReferenceKeyAndPath` from SCORE, keeps `resolveReferenceValues` locally.

## 3. `getNestedValueByPath(obj, path)`

**Server**: `server/src/utils/reference.js:1-2`
**Client**: `client/src/components/referenceResolver.js:12-13`

Identical one-liner: `path.reduce((acc, key) => acc?.[key], obj)`. Client version has a default parameter `path = []`.

**SCORE plan**: Include in the reference module alongside `getReferenceKeyAndPath`. Use the client version (with default parameter).

## 4. Prompt markdown parsing

**Server**: `server/src/getTreatments.js:28-82` — `validatePromptString()`
**Client**: `client/src/elements/Prompt.jsx:69-101`

Both split markdown on `/^-{3,}$/gm` into three sections (metadata YAML, body, response options), then YAML-parse the metadata. They diverge in what they do next:

- Server validates: type is one of 5 valid types, name matches filename, body exists, response lines start with `- ` or `> `
- Client extracts: metadata fields, response items with prefix stripped (`.substring(2)`), optional shuffle

**SCORE plan**: Create `parsePromptFile(markdownString)` that does the shared parse and returns `{ metadata, body, responseItems }` with structural validation. Server uses it for validation. Client uses it for rendering (and can additionally shuffle responses). The server's TODO at line 33 goes away.

## 5. Dead code cleanup

`server/src/validateConfig.js` is a legacy imperative batch config validator. Nothing imports it. `server/src/README.md:42` calls it "legacy config validator." Fully superseded by the Zod `batchConfigSchema`. Delete it.

## Migration order

1. **`compare()`** — smallest, self-contained, no dependencies
2. **`getReferenceKeyAndPath()` + `getNestedValueByPath()`** — also self-contained
3. **`parsePromptFile()`** — depends on prompt metadata Zod schema being in SCORE
4. **Delete dead code** — after everything else is migrated and tests pass
