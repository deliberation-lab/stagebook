# ScoreProvider: Platform Abstraction

SCORE display components need to do three things: read experiment state, write participant responses, and track time within a step. In deliberation-empirica, every component does this by directly calling Empirica hooks (`usePlayer()`, `useGame()`, `usePlayers()`, `useStage()`, `useStageTimer()`), which hardwires them to a single platform.

The ScoreProvider replaces all of that with a single context that any platform can implement.

## The interface

```typescript
interface ScoreContext {
  // Read state via DSL reference strings
  resolve(reference: string, position?: string): any[];

  // Write state under a DSL-derived key
  save(key: string, value: any, scope?: "player" | "shared"): void;

  // Seconds since current step started
  getElapsedTime(): number;

  // Advance to next step
  submit(): void;

  // Content resolution — platform handles fetching, caching, retries
  getAssetURL(path: string): string;
  getTextContent(path: string): Promise<string>;

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
}
```

## How reading works

Every element that reads experiment state does so through a **reference string** — a DSL concept like `prompt.myQuestion`, `survey.bigFive.result.score`, or `urlParams.condition`. The component passes this string to `resolve()`, and gets back the value(s) without knowing where they came from.

For example, a Display element that shows what another participant typed:

```jsx
// Before (Empirica-coupled)
const player = usePlayer();
const game = useGame();
const players = usePlayers();
const values = resolveReferenceValues({reference, position, player, game, players});

// After (platform-agnostic)
const { resolve } = useScoreContext();
const values = resolve(reference, position);
```

The `resolve` function returns an array because some references resolve across multiple participants (e.g., `position: "all"` returns one value per player). In a solo intro step the array has one element; in a group game stage it may have several. The component doesn't need to know which case it's in.

## How writing works

Every element that saves a participant response follows the same pattern: compute a storage key from the element type and name, and save a record containing the response value plus metadata. With the provider, components call `save()`:

```jsx
// Before
player.set(`prompt_${name}`, { value: answer, stageTimeElapsed: elapsed });

// After
const { save, getElapsedTime } = useScoreContext();
save(`prompt_${name}`, { value: answer, stageTimeElapsed: getElapsedTime() });
```

The `scope` parameter ("player" or "shared") handles the case where a prompt is shared across participants (saved to game state) vs individual (saved to player state). The platform decides what "player scope" and "shared scope" mean in its storage model.

## How stage submission and time tracking work

Experiment phases have different timing and submission mechanics:

- **Intro steps** (solo, async): time tracked client-side with `Date.now()`, submission advances to the next step via a `next()` callback
- **Game stages** (group, sync): time tracked server-side via a synchronized stage timer, submission signals readiness and waits for all participants
- **Exit steps** (group, async): time tracked client-side, submission advances like intro

Components don't handle any of this. They call `getElapsedTime()` and it returns seconds. They call `submit()` and the step advances. The platform's provider implementation picks the right time source and submission mechanism based on the current phase.

This means a `SubmitButton` component is just:

```jsx
function SubmitButton({ name, buttonText = "Next" }) {
  const { save, getElapsedTime, submit, progressLabel } = useScoreContext();
  const buttonName = name || progressLabel;

  const handleClick = () => {
    save(`submitButton_${buttonName}`, { time: getElapsedTime() });
    submit();
  };

  return <Button onClick={handleClick}>{buttonText}</Button>;
}
```

No platform imports. No awareness of whether it's in an intro step or a game stage. The same component works everywhere.

## How content resolution works

Components need to display images, play audio, and load prompt markdown files. In deliberation-empirica, each component calls `useFileURL()` to prepend a CDN base URL, then `useText()` to fetch. This bakes in the assumption that content lives at URLs on a CDN.

The ScoreProvider abstracts this into two methods:

- **`getAssetURL(path)`** — returns a renderable `src` for images, audio, and video. The platform decides what that URL looks like (CDN URL, local `file://` path, data URI, etc.).
- **`getTextContent(path)`** — returns the text content of a file as a string. The platform handles fetching, caching, and retries.

Components don't know where content comes from. SCORE provides a `useTextContent(path)` hook that wraps `getTextContent` with React loading/error state:

```jsx
// SCORE provides this hook (generic React loading state)
const { data, isLoading, error } = useTextContent(path);

// The platform provides getTextContent (actual content resolution)
```

This means:
- **deliberation-empirica** implements `getAssetURL` by prepending its CDN base URL, and `getTextContent` by fetching from CDN with retry logic.
- **VS Code preview** implements `getAssetURL` by resolving to workspace file paths, and `getTextContent` by reading from the local filesystem.
- **A test harness** returns inline fixtures for both.

## What the platform provides

Each platform implements the ScoreContext by wiring it to its own state management:

- **deliberation-empirica**: wraps Empirica's `usePlayer()`, `useGame()`, `usePlayers()`, `useStageTimer()` hooks. `resolve` calls `.get()` on the appropriate Empirica objects, `save` calls `.set()`, `getElapsedTime` reads the stage timer during game stages and falls back to `Date.now()` during intro/exit. `getAssetURL` prepends the CDN base URL, `getTextContent` fetches from CDN with retries.
- **VS Code preview**: provides static mock data for `resolve`, no-ops for `save`, a controllable clock for `getElapsedTime`, workspace file resolution for `getAssetURL`/`getTextContent`.
- **A future platform**: implements the same interface against its own data layer and content store.

## Service-coupled elements use render slots

Some elements are tightly coupled to external services (Daily.co for video, Etherpad for shared notepads). These can't be made platform-agnostic, so the provider offers render prop slots instead. SCORE validates the config and manages layout, but the platform supplies the actual component:

```jsx
const context = {
  // ...resolve, save, getElapsedTime, etc.
  renderDiscussion: (config) =>
    config.chatType === "video"
      ? <DailyVideoCall {...config} />
      : <TextChat {...config} />,
};
```

The SCORE stage renderer calls `renderDiscussion(config)` when a stage has a discussion, handles the two-column layout, applies position-based visibility rules, and wraps it in conditional rendering — all without knowing what video provider is being used.
