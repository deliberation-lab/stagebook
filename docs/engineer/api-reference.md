# API Reference

## Schemas

All schemas are [Zod](https://zod.dev/) objects. Use `.safeParse(data)` for validation or `.parse(data)` to throw on invalid input.

### Treatment File

| Export | Description |
|--------|-------------|
| `treatmentFileSchema` | Top-level schema for `.treatments.yaml` files |
| `treatmentSchema` | Single treatment (name, playerCount, gameStages, exitSequence) |
| `stageSchema` | Game stage (name, duration, elements, discussion) |
| `elementSchema` | Any element type (discriminated union on `type`) |
| `promptSchema` | Prompt element specifically |
| `discussionSchema` | Discussion configuration |
| `conditionSchema` | Single condition (reference, comparator, value, position) |
| `conditionsSchema` | Array of conditions |
| `referenceSchema` | Reference string validator (parses and validates `type.name.path`) |
| `introSequenceSchema` | Intro sequence with named steps |
| `introExitStepSchema` | Single intro or exit step |
| `templateSchema` | Template definition (templateName, contentType, templateContent) |
| `templateContextSchema` | Template usage (template, fields, broadcast) |

### Prompt File

| Export | Description |
|--------|-------------|
| `promptFileSchema` | Parses raw markdown → `{ metadata, body, responseItems }` with full validation |
| `metadataTypeSchema` | Prompt metadata field types (name, type, rows, min/max, etc.) |
| `metadataRefineSchema` | Cross-field metadata rules (e.g., slider requires min/max/interval) |
| `metadataLogicalSchema(fileName)` | Factory: validates `name` matches the given file path |
| `validateSliderLabels(metadata, items)` | Checks labelPts length matches response item count |

### Types

Every schema has a corresponding TypeScript type:

```typescript
import type {
  TreatmentFileType,
  TreatmentType,
  StageType,
  ElementType,
  DiscussionType,
  ConditionType,
  MetadataType,
  PromptFileType,
} from "@deliberation-lab/score";
```

## Utilities

### `compare(lhs, comparator, rhs?)`

Evaluate a condition comparator.

```typescript
import { compare, type Comparator } from "@deliberation-lab/score";

compare(5, "isAbove", 3);              // true
compare(undefined, "doesNotEqual", "x"); // true (undefined != anything)
compare(undefined, "equals", "x");      // undefined (can't determine yet)
compare("hello", "matches", "\\d+");    // false
```

**Returns:** `true`, `false`, or `undefined` (when comparison can't be made yet, e.g., undefined lhs).

**Comparators:** `exists`, `doesNotExist`, `equals`, `doesNotEqual`, `isAbove`, `isBelow`, `isAtLeast`, `isAtMost`, `hasLengthAtLeast`, `hasLengthAtMost`, `includes`, `doesNotInclude`, `matches`, `doesNotMatch`, `isOneOf`, `isNotOneOf`.

### `getReferenceKeyAndPath(reference)`

Parse a DSL reference string into a storage key and nested path.

```typescript
import { getReferenceKeyAndPath } from "@deliberation-lab/score";

getReferenceKeyAndPath("survey.bigFive.result.score");
// { referenceKey: "survey_bigFive", path: ["result", "score"] }

getReferenceKeyAndPath("prompt.myQuestion");
// { referenceKey: "prompt_myQuestion", path: ["value"] }

getReferenceKeyAndPath("urlParams.condition");
// { referenceKey: "urlParams", path: ["condition"] }
```

Supported namespaces: `survey`, `submitButton`, `qualtrics`, `prompt`, `trackedLink`, `urlParams`, `connectionInfo`, `browserInfo`, `participantInfo`, `discussion`.

### `getNestedValueByPath(obj, path?)`

Traverse a nested object by path array.

```typescript
import { getNestedValueByPath } from "@deliberation-lab/score";

getNestedValueByPath({ a: { b: { c: 42 } } }, ["a", "b", "c"]); // 42
getNestedValueByPath({ a: 1 }, ["x"]);                           // undefined
getNestedValueByPath({ a: 1 });                                   // { a: 1 }
```

### `fillTemplates({ obj, templates })`

Expand all template references in a structure.

```typescript
import { fillTemplates } from "@deliberation-lab/score";

const expanded = fillTemplates({
  obj: rawTreatments,
  templates: templateDefinitions,
});
```

Throws if any `${field}` placeholders remain unresolved.

Also exported: `expandTemplate`, `substituteFields`, `recursivelyFillTemplates` for lower-level control.

## React Components

### ScoreProvider

```tsx
import { ScoreProvider, type ScoreContext } from "@deliberation-lab/score/components";

<ScoreProvider value={context}>
  {children}
</ScoreProvider>
```

### Hooks

| Hook | Returns | Requires Provider |
|------|---------|-------------------|
| `useScoreContext()` | Full `ScoreContext` object | yes |
| `useResolve(reference, position?)` | `unknown[]` | yes |
| `useSave()` | `save` function | yes |
| `useElapsedTime()` | `number` (seconds) | yes |
| `useTextContent(path)` | `{ data, isLoading, error }` | yes |

### Element Router

```tsx
import { Element, type ElementConfig } from "@deliberation-lab/score/components";

<Element element={elementConfig} onSubmit={handleSubmit} stageDuration={300} />
```

Requires ScoreProvider. Dispatches to the appropriate element component based on `element.type`.

### Form Components (standalone)

| Component | Key Props |
|-----------|-----------|
| `Button` | `onClick`, `children`, `primary?`, `disabled?` |
| `Separator` | `style?` (`"thin"`, `"regular"`, `"thick"`) |
| `RadioGroup` | `options`, `value`, `onChange`, `label?` |
| `CheckboxGroup` | `options`, `value`, `onChange`, `label?` |
| `TextArea` | `value`, `onChange`, `rows?`, `minLength?`, `maxLength?`, `showCharacterCount?`, `onDebugMessage?` |
| `Slider` | `min`, `max`, `interval`, `value?`, `onChange`, `labelPts?`, `labels?` |
| `ListSorter` | `items`, `onChange` |
| `Markdown` | `text`, `resolveURL?` |

### Element Components (pure props)

| Component | Key Props |
|-----------|-----------|
| `Prompt` | `metadata`, `body`, `responseItems`, `name`, `save`, `getElapsedTime`, `value`, `progressLabel` |
| `Display` | `reference`, `values`, `position?` |
| `SubmitButton` | `onSubmit`, `name`, `save`, `getElapsedTime`, `buttonText?` |
| `AudioElement` | `src` |
| `ImageElement` | `src`, `width?` |
| `KitchenTimer` | `startTime`, `endTime`, `getElapsedTime`, `warnTimeRemaining?` |
| `TrackedLink` | `name`, `url`, `displayText`, `save`, `getElapsedTime`, `progressLabel`, `resolvedParams?` |
| `TrainingVideo` | `url`, `getElapsedTime`, `onComplete` |

### Conditional Components

| Component | Key Props |
|-----------|-----------|
| `TimeConditionalRender` | `displayTime?`, `hideTime?`, `getElapsedTime`, `children` |
| `PositionConditionalRender` | `showToPositions?`, `hideFromPositions?`, `position`, `children` |
| `ConditionsConditionalRender` | `conditions`, `resolve`, `children`, `fallback?` |
| `SubmissionConditionalRender` | `isSubmitted`, `playerCount`, `children` |
