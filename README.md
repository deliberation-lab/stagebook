# SCORE

**Structured Complete Open Record of Experiment**

A language for describing interactive social science experiments — the schemas, validators, utilities, and rendering components that turn a study protocol into what participants actually see.

## What is SCORE?

SCORE defines a declarative language for specifying interactive group experiments: stages, elements (prompts, surveys, timers, discussions), conditional logic, templates, and participant positioning. It provides:

- **Zod schemas** that validate treatment files and prompt files
- **A template engine** for parameterized experiment designs with broadcast expansion
- **Shared utilities** for condition evaluation and reference resolution
- **React components** (planned) that render SCORE elements into participant-facing UI

SCORE is platform-agnostic. Define your study protocol once, then run it on any compatible platform.

## Installation

```bash
npm install @deliberation-lab/score
```

Peer dependencies: `zod >= 3.23`, `js-yaml >= 4`

## Usage

### Validating a treatment file

```typescript
import { treatmentFileSchema } from "@deliberation-lab/score";
import { load as loadYaml } from "js-yaml";

const config = loadYaml(yamlString);
const result = treatmentFileSchema.safeParse(config);

if (!result.success) {
  console.error(result.error.issues);
}
```

### Validating a prompt file

`promptFileSchema` takes raw markdown, parses it, and validates structure, metadata, response format, and slider labels in a single pass:

```typescript
import { promptFileSchema } from "@deliberation-lab/score";

const result = promptFileSchema.safeParse(markdownString);

if (result.success) {
  const { metadata, body, responseItems } = result.data;
  // metadata: parsed and validated YAML frontmatter
  // body: the prompt text
  // responseItems: parsed response options (prefix-stripped)
} else {
  console.error(result.error.issues);
}
```

### Evaluating conditions

```typescript
import { compare } from "@deliberation-lab/score";

compare(5, "isAbove", 3);           // true
compare("hello", "includes", "ell"); // true
compare(undefined, "exists");        // false
compare(undefined, "doesNotEqual", "x"); // true
```

The 16 canonical comparators: `exists`, `doesNotExist`, `equals`, `doesNotEqual`, `isAbove`, `isBelow`, `isAtLeast`, `isAtMost`, `hasLengthAtLeast`, `hasLengthAtMost`, `includes`, `doesNotInclude`, `matches`, `doesNotMatch`, `isOneOf`, `isNotOneOf`.

### Parsing reference strings

```typescript
import { getReferenceKeyAndPath } from "@deliberation-lab/score";

getReferenceKeyAndPath("survey.bigFive.result.score");
// { referenceKey: "survey_bigFive", path: ["result", "score"] }

getReferenceKeyAndPath("prompt.myQuestion");
// { referenceKey: "prompt_myQuestion", path: ["value"] }
```

Supported namespaces: `survey`, `submitButton`, `qualtrics`, `prompt`, `trackedLink`, `urlParams`, `connectionInfo`, `browserInfo`, `participantInfo`, `discussion`.

### Expanding templates

```typescript
import { fillTemplates } from "@deliberation-lab/score";

const result = fillTemplates({
  obj: treatmentConfig,
  templates: treatmentConfig.templates,
});
```

The template engine supports field substitution (`${fieldName}`), nested templates, and multi-dimensional broadcast expansion.

## API Reference

### Schemas

| Export | Description |
|--------|-------------|
| `treatmentFileSchema` | Top-level schema for a treatment YAML file (templates, introSequences, treatments) |
| `treatmentSchema` | Single treatment with playerCount, gameStages, exitSequence |
| `stageSchema` | Game stage with name, duration, elements, discussion; validates element time bounds against duration |
| `elementSchema` | Any DSL element (prompt, display, survey, timer, etc.) with conditional rendering support |
| `promptSchema` | Prompt element with file reference and optional shared flag |
| `discussionSchema` | Discussion config (chat type, layout, rooms, visibility) |
| `conditionSchema` | Condition with reference, comparator, value, and position |
| `referenceSchema` | DSL reference string validator |
| `promptFileSchema` | Parses and validates a complete prompt markdown file |
| `metadataTypeSchema` | Prompt metadata field types and constraints |
| `metadataRefineSchema` | Cross-field metadata validation (e.g., slider requires min/max/interval) |
| `templateContextSchema` | Template reference with fields and broadcast dimensions |
| `templateSchema` | Named template definition with content type |

All schemas export corresponding TypeScript types (e.g., `TreatmentType`, `StageType`, `ElementType`).

### Utilities

| Export | Description |
|--------|-------------|
| `compare(lhs, comparator, rhs?)` | Evaluate a condition. Returns `boolean \| undefined` |
| `Comparator` | String literal union type of the 16 canonical comparator names |
| `getReferenceKeyAndPath(reference)` | Parse a DSL reference string into storage key + nested path |
| `getNestedValueByPath(obj, path?)` | Traverse a nested object by path array |

### Templates

| Export | Description |
|--------|-------------|
| `fillTemplates({ obj, templates })` | Expand all template references and validate no placeholders remain |
| `expandTemplate({ templates, context })` | Expand a single template context with fields and broadcast |
| `substituteFields({ templateContent, fields })` | Replace `${key}` placeholders with values |

## Documentation

### For Researchers (designing experiments)

- [Treatment Files](docs/researcher/treatment-files.md) — how to structure a `.treatments.yaml` file
- [Page Elements](docs/researcher/elements.md) — all element types and their options
- [Prompt Files](docs/researcher/prompts.md) — markdown format for prompts, sliders, surveys
- [Conditions & References](docs/researcher/conditions.md) — conditional display and data references
- [Discussions](docs/researcher/discussions.md) — text chat, video calls, breakout rooms, custom layouts
- [Templates](docs/researcher/templates.md) — reusable structures with field substitution and broadcast
- [Syntax Reference](docs/researcher/syntax-reference.md) — compact cheat sheet for the full language

### For Engineers (integrating SCORE)

- [Integration Guide](docs/engineer/integration-guide.md) — implementing a ScoreProvider backend
- [Platform Requirements](docs/engineer/platform-requirements.md) — what the host platform must provide (state, orchestration, group formation, services)
- [API Reference](docs/engineer/api-reference.md) — all exports, types, and component props
- [Architecture](docs/score-provider.md) — ScoreProvider design, three-layer component model, render slots, CSS theming

## License

MIT
