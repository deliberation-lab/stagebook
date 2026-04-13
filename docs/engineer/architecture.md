# StagebookProvider: Architecture

Stagebook display components need to do four things: read experiment state, write participant responses, track time within a step, and load content (prompt markdown, images, audio) from wherever the platform stores it. The StagebookProvider abstracts all of these behind a single context that any platform can implement.

## The interface

```typescript
interface StagebookContext {
  // Read state via DSL reference strings
  resolve(reference: string, position?: string): unknown[];

  // Write state under a DSL-derived key
  save(key: string, value: unknown, scope?: "player" | "shared"): void;

  // Seconds since current step started
  getElapsedTime(): number;

  // Advance to next step
  submit(): void;

  // Content resolution — platform handles fetching, caching, retries
  getAssetURL(path: string): string;
  getTextContent(path: string): Promise<string>;

  // Idle state — signal when participant is expected to be away
  setAllowIdle?: (allow: boolean) => void;

  // Identity and progress
  progressLabel: string;
  playerId: string;
  position: number | undefined;
  playerCount: number | undefined;
  isSubmitted: boolean;

  // Platform-provided renderers for service-coupled elements
  renderDiscussion?: (config: DiscussionType) => React.ReactNode;
  renderSharedNotepad?: (config: { padName: string }) => React.ReactNode;
  renderTalkMeter?: () => React.ReactNode;
  renderSurvey?: (config: { surveyName: string; onComplete: (results: unknown) => void }) => React.ReactNode;
}
```

## Three-layer component architecture

Stagebook components are organized in three layers:

1. **Pure components** (form/) — `Button`, `Separator`, `RadioGroup`, `CheckboxGroup`, `TextArea`, `Slider`, `ListSorter`, `Markdown`, `Loading`. These take props and render UI. No StagebookProvider needed. Usable anywhere in the app (consent screens, debrief, etc.).

2. **Element components** (elements/) — `Prompt`, `Display`, `SubmitButton`, `AudioElement`, `ImageElement`, `KitchenTimer`, `TrackedLink`, `TrainingVideo`, `Qualtrics`. These are pure prop-based components that render specific experiment elements. They receive data and callbacks as props, not from context.

3. **Stage renderer** — The `Stage` component reads from StagebookProvider, wraps each element in conditional rendering (time, position, conditions), handles layout (single column or two-column with discussion), and bridges context to element components via the `Element` router.

The platform provides the StagebookProvider context. Stagebook handles everything inside it.

## How reading works

Every element that reads experiment state does so through a **reference string** — a DSL concept like `prompt.myQuestion`, `survey.bigFive.result.score`, or `urlParams.condition`. The `resolve()` function returns an array because some references resolve across multiple participants (e.g., `position: "all"` returns one value per player). In a solo intro step the array has one element; in a group game stage it may have several. The component doesn't need to know which case it's in.

## How writing works

Every element that saves a participant response computes a storage key from the element type and name, and saves a record containing the response value plus metadata:

```jsx
save(`prompt_${name}`, { value: answer, stageTimeElapsed: getElapsedTime() }, "player");
```

The `scope` parameter ("player" or "shared") handles the case where a prompt is shared across participants (saved to group state) vs individual (saved to player state). The platform decides what these scopes mean in its storage model.

## How timing works across phases

Components call `getElapsedTime()` and get seconds. They call `submit()` and the step advances. The platform's implementation varies by phase:

| Phase | `getElapsedTime()` | `submit()` |
|-------|-------------------|------------|
| Intro (solo, async) | `Date.now()` relative to step start | Advance to next step |
| Game (group, sync) | Server-synchronized timer | Signal readiness, wait for all |
| Exit (solo, async) | `Date.now()` relative to step start | Advance to next step |

Components don't need to know which phase they're in.

## How content resolution works

Components need images, audio, and prompt markdown files. The platform implements:

- **`getAssetURL(path)`** — returns a renderable `src` (CDN URL, local file path, webview URI, etc.)
- **`getTextContent(path)`** — returns file content as a string (platform handles fetching, caching, retries)

Stagebook provides `useTextContent(path)` — a hook that wraps `getTextContent` with React loading/error state.

## Render slots for service-coupled elements

Some elements depend on external services. Stagebook validates config, manages layout, and handles conditional rendering — but the platform supplies the actual component:

| Slot | When used | What the platform provides |
|------|-----------|---------------------------|
| `renderDiscussion` | Stage has `discussion` block | Video call or text chat component |
| `renderSurvey` | `type: "survey"` element | Survey UI component that calls `onComplete(results)` |
| `renderSharedNotepad` | `type: "sharedNotepad"` or `shared: true` prompt | Collaborative text editor |
| `renderTalkMeter` | `type: "talkMeter"` element | Speaking time display |

All slots are optional. If not provided, the element renders nothing.

## Idle management

Some elements temporarily expect the participant to be away (watching a video, following an external link). Stagebook components call `setAllowIdle?.(true/false)` to signal this. The platform's idle detection system uses this signal to suppress inactivity warnings during expected away periods.

## CSS theming

Stagebook ships a default stylesheet (`@deliberation-lab/stagebook/styles`) with CSS custom properties for all themeable values. Platforms override these on `:root`:

```css
:root {
  --stagebook-primary: #7c3aed;    /* change blue to purple */
  --stagebook-danger: #b91c1c;     /* darker red */
}
```

Component layout (padding, flex, positioning) uses inline styles and is not overridable — this ensures consistent experiment rendering. Only visual theming (colors, borders) is customizable.
