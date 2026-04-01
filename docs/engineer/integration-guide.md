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

```tsx
import { ScoreProvider, Element } from "@deliberation-lab/score/components";

function Stage({ elements, onSubmit, duration }) {
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
  };

  return (
    <ScoreProvider value={scoreContext}>
      {elements.map((element, i) => (
        <Element key={i} element={element} onSubmit={onSubmit} stageDuration={duration} />
      ))}
    </ScoreProvider>
  );
}
```

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

Some elements depend on external services (video calls, shared notepads, speaking time tracking). SCORE validates the config and manages layout, but your platform supplies the actual component via render props on the provider:

```typescript
const context: ScoreContext = {
  // ...other fields...

  renderDiscussion: (config) => {
    if (config.chatType === "video") {
      return <DailyVideoCall {...config} />;
    }
    return <TextChat {...config} />;
  },

  renderSharedNotepad: ({ padName }) => (
    <EtherpadEmbed padName={padName} />
  ),

  renderTalkMeter: () => <TalkTimeDisplay />,
};
```

If a render slot is not provided, the element renders nothing (no error). This lets you progressively add service integrations.
