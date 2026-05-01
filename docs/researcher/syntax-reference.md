# Stagebook Syntax Reference

A concise, precise reference for the Stagebook experiment description language. For detailed explanations, see the individual guides: [Treatment Files](treatment-files.md), [Elements](elements.md), [Prompts](prompts.md), [Conditions](conditions.md), [Discussions](discussions.md), [Templates](templates.md).

## 1. Top-Level Structure

```yaml
templates: # optional: array of template definitions
introSequences: # required: array of intro sequence objects
treatments: # required: array of treatment objects
```

## 2. Primitives

- **Names**: 1-64 chars; `[a-zA-Z0-9 _-]` plus `${field}` placeholders.
- **Durations**: positive integer (seconds).
- **Positions**: zero-based nonnegative integers.
- **Visibility**: `showToPositions` / `hideFromPositions` — nonempty int arrays.
- **Time gates**: `displayTime` (nonnegative int), `hideTime` (positive int) — seconds into stage.

## 3. Templates

```yaml
templates:
  - name: <name>
    contentType: <element|stage|treatment|...>  # required
    content: <any structure>

# Usage:
- template: <name>
  fields: { key: value }       # ${key} substitution
  broadcast: { d0: [...] }     # cartesian expansion
```

Content types: `introSequence`, `introSequences`, `elements`, `element`, `stage`, `stages`, `treatment`, `treatments`, `reference`, `condition`, `conditions`, `player`, `groupComposition`, `introExitStep`, `introSteps`, `exitSteps`, `discussion`, `broadcastAxisValues`.

## 4. References

| Pattern                      | Example                                |
| ---------------------------- | -------------------------------------- |
| `prompt.<name>`              | `prompt.topicVote`                     |
| `survey.<name>.result.<key>` | `survey.TIPI.result.normAgreeableness` |
| `submitButton.<name>.<path>` | `submitButton.confirm.time`            |
| `qualtrics.<name>.<path>`    | `qualtrics.exit.sessionId`             |
| `trackedLink.<name>.<path>`  | `trackedLink.signup.events`            |
| `urlParams.<key>`            | `urlParams.PROLIFIC_PID`               |
| `connectionInfo.<key>`       | `connectionInfo.country`               |
| `browserInfo.<key>`          | `browserInfo.language`                 |
| `participantInfo.<field>`    | `participantInfo.name`                 |
| `discussion.<field>`         | `discussion.cumulativeSpeakingTime`    |

## 5. Conditions

```yaml
conditions:
  - reference: <reference string>
    comparator: <comparator>
    value: <expected value> # omit for exists/doesNotExist
    position: <position> # optional
```

**Comparators:** `exists`, `doesNotExist`, `equals`, `doesNotEqual`, `isAbove`, `isBelow`, `isAtLeast`, `isAtMost`, `hasLengthAtLeast`, `hasLengthAtMost`, `includes`, `doesNotInclude`, `matches`, `doesNotMatch`, `isOneOf`, `isNotOneOf`.

**Position values:** `player` (default), `shared`, or integer slot index. (After #238, `position` is a pure read selector. Cross-player aggregation lives in the `all:` / `any:` / `none:` boolean-tree operators — see [Conditions](conditions.md).)

## 6. Elements

All elements accept: `name?`, `notes?`, `file?`, `displayTime?`, `hideTime?`, `showToPositions?`, `hideFromPositions?`, `conditions?`, `tags?`.

| Type            | Key Fields                                                                                                                                                                                                                                     |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prompt`        | `file` (required), `shared?`                                                                                                                                                                                                                   |
| `display`       | `reference` (required), `position?` (default: `player`)                                                                                                                                                                                        |
| `submitButton`  | `buttonText?` (default: "Next")                                                                                                                                                                                                                |
| `timer`         | `startTime?`, `endTime?`, `warnTimeRemaining?`                                                                                                                                                                                                 |
| `separator`     | `style?` (`thin`, `regular`, `thick`)                                                                                                                                                                                                          |
| `audio`         | `file` (required)                                                                                                                                                                                                                              |
| `image`         | `file` (required), `width?`                                                                                                                                                                                                                    |
| `mediaPlayer`   | `url` (required), `name`, `controls?`, `syncToStageTime?`, `submitOnComplete?`, `startAt?`, `stopAt?`, `stepDuration?`, `playVideo?`, `playAudio?`, `captionsFile?`, `allowScrubOutsideBounds?`                                                |
| `timeline`      | `source` (required, name of a sibling `mediaPlayer`), `name` (required), `selectionType` (required, `range` or `point`), `selectionScope?` (default `all`), `multiSelect?` (default `false`), `showWaveform?` (default `true`), `trackLabels?` |
| `survey`        | `surveyName` (required) — _deprecated; pending removal once a module-reuse pattern lands. Prefer prompt-based patterns._                                                                                                                       |
| `qualtrics`     | `url` (required), `urlParams?`                                                                                                                                                                                                                 |
| `trackedLink`   | `name` (required), `url` (required), `displayText` (required), `helperText?`, `urlParams?`                                                                                                                                                     |

### Media hosting requirements

The `<video>` element rendered by `mediaPlayer` always sets `crossOrigin="anonymous"`. This is required for the Web Audio API to read the audio stream when a `timeline` element with `showWaveform: true` is attached — without it, the analyser is silently CORS-tainted and the waveform tracks render as flat lines.

**This means all media URLs must be served with proper CORS headers** (`Access-Control-Allow-Origin: *` or matching the experiment origin), regardless of whether you use the timeline. Same-origin media (e.g., served from the same host as the experiment) is unaffected.

If you see flat waveforms in the timeline despite audio playing, check the browser console — Stagebook logs a warning after 5 seconds of playback if the AnalyserNode is producing only silence:

```
[MediaPlayer] Waveform capture is producing all-zero data after 5s of playback...
```

## 7. Stages

```yaml
gameStages:
  - name: <name>
    duration: <seconds>
    discussion: <discussion object> # optional
    elements: [...] # required, nonempty
```

Time bounds on elements (`displayTime`, `hideTime`, `startTime`, `endTime`) must not exceed stage `duration`.

## 8. Discussions

```yaml
discussion:
  chatType: text | audio | video
  showNickname: true
  showTitle: false
  # text-only: reactionEmojisAvailable?, reactToSelf?, numReactionsPerMessage?
  # video-only: showSelfView?, showReportMissing?, showAudioMute?, showVideoMute?
  # video-only: rooms? or layout?
  showToPositions: [0, 1] # optional
  hideFromPositions: [2] # optional
  conditions: [...] # optional
```

## 9. Intro/Exit Steps

```yaml
introSequences:
  - name: <name>
    introSteps:
      - name: <name>
        elements: [...] # no duration, no position-based visibility

treatments:
  - name: <name>
    exitSequence:
      - name: <name>
        elements: [...] # no shared prompts
```

Constraints: no `shared` prompts, no `position`/`showToPositions`/`hideFromPositions` on elements in intro steps. Exit steps disallow `shared` prompts.

## 10. Treatments

```yaml
treatments:
  - name: <name>
    playerCount: <integer>
    groupComposition: # optional
      - position: 0
        title: "Role A"
        conditions: [...]
    gameStages: [...] # required, nonempty
    exitSequence: [...] # optional
```

Position indices in `showToPositions`, `hideFromPositions`, `groupComposition`, and discussion `rooms` must be < `playerCount`.

## 11. Prompt Files

Three sections separated by `---`:

```markdown
---
type: multipleChoice | openResponse | noResponse | listSorter | slider
name: My Prompt # optional — human-readable identifier
---

## Markdown body text

- Response option 1
- Response option 2
```

`name` is optional. Can be any string — use it as a human-readable identifier. Prompt files must use the `.prompt.md` extension.

Slider requires `min`, `max`, `interval` in metadata. Slider initializes without a visible thumb (anti-anchoring).
