# Integrating SCORE into Your Platform

This guide explains how to add SCORE as a dependency and implement the platform-specific backend that powers SCORE's rendering components. SCORE provides the experiment description language (schemas + validation) and the rendering layer (React components). Your platform provides the state management, content delivery, and service integrations.

## Installation

```bash
npm install @deliberation-lab/score
```

Peer dependencies (install if not already present):

```bash
npm install zod js-yaml react react-dom
```

## Package Structure

SCORE exports from two entry points:

```typescript
// Schemas, validators, and utilities — no React dependency
import { treatmentFileSchema, compare, fillTemplates } from "@deliberation-lab/score";

// React components — requires React 18+
import { ScoreProvider, Element, Markdown, Button } from "@deliberation-lab/score/components";
```

## Validating Treatment Files

The most basic integration is validation. Use this in build tools, CI pipelines, or editor extensions:

```typescript
import { treatmentFileSchema, fillTemplates } from "@deliberation-lab/score";
import { load as loadYaml } from "js-yaml";
import { readFileSync } from "fs";

// Load and parse
const raw = loadYaml(readFileSync("study.treatments.yaml", "utf-8"));

// Expand templates
const templates = raw.templates ?? [];
const expanded = {
  ...raw,
  introSequences: fillTemplates({ obj: raw.introSequences, templates }),
  treatments: fillTemplates({ obj: raw.treatments, templates }),
};

// Validate
const result = treatmentFileSchema.safeParse(expanded);

if (!result.success) {
  for (const issue of result.error.issues) {
    console.error(`${issue.path.join(".")}: ${issue.message}`);
  }
}
```

## Validating Prompt Files

```typescript
import { promptFileSchema } from "@deliberation-lab/score";

const markdown = readFileSync("prompts/question.md", "utf-8");
const result = promptFileSchema.safeParse(markdown);

if (result.success) {
  const { metadata, body, responseItems } = result.data;
  // metadata: parsed YAML frontmatter
  // body: markdown text
  // responseItems: response options (prefix-stripped)
} else {
  for (const issue of result.error.issues) {
    console.error(issue.message);
  }
}
```

## Treatment Hydration Pipeline

Before passing treatment data to SCORE's rendering components, the platform must **hydrate** it — expand templates, validate, and resolve all placeholders. SCORE components expect fully resolved data with no template contexts or `${field}` placeholders remaining.

```typescript
import { treatmentFileSchema, fillTemplates } from "@deliberation-lab/score";
import { load as loadYaml } from "js-yaml";

// 1. Load and parse YAML
const raw = loadYaml(yamlString);

// 2. Expand templates (replaces template contexts with resolved values)
const templates = raw.templates ?? [];
const hydrated = {
  ...raw,
  introSequences: fillTemplates({ obj: raw.introSequences, templates }),
  treatments: fillTemplates({ obj: raw.treatments, templates }),
};

// 3. Validate the expanded result
const result = treatmentFileSchema.safeParse(hydrated);
if (!result.success) throw new Error(result.error.message);

// 4. Pass resolved stages to SCORE components
// Each treatment.gameStages[i] is now a concrete stage object
// that can be passed directly to <Stage stage={...} />
```

**Important:** The `<Stage>` component and `<Element>` component expect **hydrated** data. If you pass a stage that still contains `{ template: "..." }` objects or `${field}` placeholders, rendering will fail. Always run `fillTemplates()` before passing data to components.

The hydration step also resolves broadcast expansion — a single template with `broadcast: { d0: [...], d1: [...] }` may produce multiple stages or elements via cartesian product. This happens during `fillTemplates()`, not during rendering.

## Implementing a ScoreProvider

To render SCORE elements, your platform must implement the `ScoreContext` interface and wrap your component tree with `<ScoreProvider>`.

### The Interface

```typescript
import type { ScoreContext } from "@deliberation-lab/score/components";

const context: ScoreContext = {
  // Read experiment state by DSL reference string.
  // Returns an array because some references resolve across multiple participants.
  resolve(reference: string, position?: string): unknown[] {
    // Parse the reference, look up the value in your state store.
    // "position" controls whose data to return: "player", "shared", "all", "any", or index.
  },

  // Write participant data under a DSL-derived key.
  save(key: string, value: unknown, scope?: "player" | "shared"): void {
    // scope "player" = individual state, "shared" = group-visible state
  },

  // Seconds elapsed since the current step started.
  getElapsedTime(): number {
    // Game stages: use your synchronized server timer
    // Intro/exit steps: use Date.now() relative to step start
  },

  // Advance to the next step.
  submit(): void {
    // Intro/exit: call your next() function
    // Game stages: signal readiness, wait for all participants
  },

  // Resolve a project-relative path to a renderable URL.
  getAssetURL(path: string): string {
    // CDN: prepend base URL
    // Local dev: return local file path
    // VS Code: return webview URI
  },

  // Fetch text content of a file by project-relative path.
  // Platform handles caching, retries, error handling.
  getTextContent(path: string): Promise<string> {
    // CDN: fetch from CDN URL
    // Local: read from filesystem
    // Test: return fixture string
  },

  // Identity and progress
  progressLabel: "game_0_discussion",  // unique step identifier
  playerId: "abc123",
  position: 0,                          // undefined in intro steps
  playerCount: 3,                       // undefined in intro steps
  isSubmitted: false,

  // Optional: platform-provided renderers for service-coupled elements
  renderDiscussion: (config) => <YourVideoComponent {...config} />,
  renderSharedNotepad: (config) => <YourNotepadComponent {...config} />,
  renderTalkMeter: () => <YourTalkMeter />,
};
```

### Wiring It Up

SCORE provides a `Stage` component that handles all element layout, conditional rendering, and discussion placement. The platform just provides the context and the hydrated stage config:

```tsx
import { ScoreProvider, Stage } from "@deliberation-lab/score/components";
import type { ScoreContext } from "@deliberation-lab/score/components";

function GameStage({ stageConfig, onSubmit }) {
  const context = useYourPlatformContext(); // your platform's hooks

  const scoreContext: ScoreContext = {
    resolve: (ref, pos) => yourResolve(ref, pos, context),
    save: (key, val, scope) => yourSave(key, val, scope, context),
    getElapsedTime: () => context.timer.elapsed,
    submit: onSubmit,
    getAssetURL: (path) => `${context.cdnBase}/${path}`,
    getTextContent: (path) => fetch(`${context.cdnBase}/${path}`).then(r => r.text()),
    progressLabel: context.progressLabel,
    playerId: context.player.id,
    position: context.player.position,
    playerCount: context.playerCount,
    isSubmitted: context.player.isSubmitted,
    renderDiscussion: (config) => <YourVideoComponent {...config} />,
  };

  return (
    <ScoreProvider value={scoreContext}>
      <Stage stage={stageConfig} onSubmit={onSubmit} />
    </ScoreProvider>
  );
}
```

The `Stage` component handles:
- Laying out elements top-to-bottom with appropriate spacing and max-widths
- Two-column layout when a discussion is present (discussion left, elements right)
- Wrapping each element in time, position, and condition-based conditional rendering
- Showing a "waiting for others" message after submission

If you need lower-level control, you can use the `Element` component directly to render individual elements, or the pure element components (e.g., `Prompt`, `Display`) with manual prop wiring.

### The Three Phases

The same `ScoreContext` interface works across all three experiment phases. The platform adapts its implementation:

| | Intro (async, solo) | Game (sync, group) | Exit (async, solo) |
|---|---|---|---|
| `position` | `undefined` | `0`, `1`, `2`, ... | same as game |
| `playerCount` | `undefined` | group size | group size |
| `resolve` | single-player values only | multi-player values | multi-player values |
| `save(..., "shared")` | not available | writes to group state | writes to group state |
| `getElapsedTime` | client-side `Date.now()` | server-synced timer | client-side `Date.now()` |
| `submit` | advance to next step | signal readiness | advance to next step |

Components don't need to know which phase they're in.

## Using Standalone Components

Form components work without ScoreProvider. Use them anywhere in your app:

```tsx
import { Markdown, Button, Separator } from "@deliberation-lab/score/components";

function ConsentPage({ consentText, onAccept }) {
  return (
    <div>
      <Markdown text={consentText} resolveURL={(path) => `/assets/${path}`} />
      <Separator />
      <Button onClick={onAccept}>I Agree</Button>
    </div>
  );
}
```

Components that display images or reference external files accept an optional `resolveURL` prop for path resolution. Inside the experiment flow, the `Element` router passes `getAssetURL` from the provider automatically.

## Utilities Without React

Use schemas and utilities in Node.js, build tools, or server-side code — no React needed:

```typescript
import {
  treatmentFileSchema,
  promptFileSchema,
  compare,
  getReferenceKeyAndPath,
  fillTemplates,
} from "@deliberation-lab/score";

// Validate a treatment
treatmentFileSchema.safeParse(config);

// Evaluate a condition
compare(playerResponse, "isAtLeast", 0.75);

// Parse a reference string
const { referenceKey, path } = getReferenceKeyAndPath("survey.TIPI.result.score");

// Expand templates
const expanded = fillTemplates({ obj: treatments, templates });
```

## Render Slots for Service-Coupled Elements

Some elements depend on external services or platform-specific libraries. SCORE validates the config, manages layout and conditional rendering, and handles data storage — but your platform supplies the actual component via render props on the provider.

### Survey

Surveys are rendered by the platform because they depend on a survey library (e.g., `@watts-lab/surveys`). SCORE handles the storage key (`survey_${name}`) so other SCORE elements can reference the results.

```typescript
import { getSurvey } from "@watts-lab/surveys";

const context: ScoreContext = {
  // ...other fields...

  renderSurvey: ({ surveyName, onComplete }) => {
    const SurveyComponent = getSurvey(surveyName);
    return <SurveyComponent onComplete={onComplete} />;
  },
};
```

When the survey calls `onComplete(results)`, SCORE saves the results under `survey_${name}` so they're available to `display` elements and `conditions` via `survey.<name>.result.<key>`.

Your survey component just needs to:
1. Render the survey UI
2. Call `onComplete(results)` when the participant finishes, passing the results object

### Discussion

Video calls and text chat are tightly coupled to external services (Daily.co, Twilio, etc.). SCORE handles the two-column layout, position-based visibility, and breakout room config, but the platform provides the actual communication component.

```typescript
const context: ScoreContext = {
  renderDiscussion: (config) => {
    if (config.chatType === "video") {
      return <DailyVideoCall {...config} />;
    }
    return <TextChat {...config} />;
  },
};
```

The `config` parameter is the full `discussion` object from the treatment YAML, including `chatType`, `showNickname`, `showTitle`, `rooms`, `layout`, etc. Your component receives all the configuration and implements the service integration.

### Shared Notepad

Collaborative text editors (e.g., Etherpad) are used for `sharedNotepad` elements and `shared: true` open response prompts.

```typescript
const context: ScoreContext = {
  renderSharedNotepad: ({ padName }) => (
    <EtherpadEmbed padName={padName} />
  ),
};
```

### Talk Meter

Speaking time tracking requires audio analysis, which is platform-specific.

```typescript
const context: ScoreContext = {
  renderTalkMeter: () => <TalkTimeDisplay />,
};
```

### Progressive adoption

All render slots are optional. If a slot is not provided, the element renders nothing (no error). This lets you progressively add service integrations — start with prompts and submit buttons, add video calls later.
