# Page Elements

Elements are the building blocks of every stage. The `elements` array is rendered top-to-bottom as a single column. All element types accept these common fields:

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Label for saved content and timing data |
| `displayTime` | integer | Seconds into the stage before showing this element |
| `hideTime` | integer | Seconds into the stage after which to hide this element |
| `showToPositions` | int[] | Only show to these participant positions |
| `hideFromPositions` | int[] | Hide from these participant positions |
| `conditions` | array | Complex conditional display rules (see [Conditions](conditions.md)) |
| `tags` | string[] | Optional tags for grouping or filtering |

## Prompt

Renders a question or informational text from a Markdown file. This is the most common element type.

```yaml
- type: prompt
  file: game/discussion_prompt.md
  name: topicA_prompt        # optional — names the saved response
  shared: true               # optional — single response editable by all participants
```

**Shorthand:** A bare string in the `elements` array is treated as a prompt:

```yaml
elements:
  - game/discussion_prompt.md   # equivalent to { type: prompt, file: "..." }
  - type: submitButton
```

See [Prompt Files](prompts.md) for the Markdown format.

## Display

Shows a previously captured value (usually a prompt response) as a styled blockquote. Use this to show one participant what another wrote.

```yaml
- type: display
  reference: prompt.topicA_prompt
  position: 1              # show position 1's response (default: "player")
```

The `position` field accepts: a numeric index, `player` (current participant), `shared`, `all`, or `any`.

## Submit Button

Adds a button participants click when they're done with the stage. Without a submit button, stages advance only when the timer expires.

```yaml
- type: submitButton
  buttonText: Continue      # default: "Next"
  name: readiness_check     # optional — gives you submission timing data
```

**Important:** Every intro and exit step needs a submit button (or a Qualtrics/video element that auto-submits).

## Timer

Displays a progress bar tied to stage time. Turns red when time is running low.

```yaml
- type: timer
  startTime: 0              # when the bar starts counting (default: 0)
  endTime: 600              # when the bar reaches 100% (default: stage duration)
  warnTimeRemaining: 60     # seconds before end when bar turns red
```

## Separator

A horizontal line to break up long pages.

```yaml
- type: separator
  style: thick              # "thin", "regular" (default), or "thick"
```

## Audio

Plays an audio file once when the stage loads.

```yaml
- type: audio
  file: shared/chime.mp3
```

## Image

Displays an image.

```yaml
- type: image
  file: shared/diagram.png
  width: 50                 # optional — percentage of available width
```

## Video

Embeds a synchronized video. Video time is tied to stage time — reconnecting participants jump to the correct position. The stage auto-submits when the video ends.

```yaml
- type: video
  url: https://youtu.be/QC8iQqtG0hg
```

## Survey

Renders a pre-built survey from the `@watts-lab/surveys` package.

```yaml
- type: survey
  surveyName: TIPI
  name: pre_discussion_TIPI   # optional storage key
```

## Qualtrics

Embeds an external Qualtrics survey in an iframe. The stage auto-submits when the participant completes the Qualtrics survey.

```yaml
- type: qualtrics
  url: https://upenn.qualtrics.com/jfe/form/SV_xxx
  urlParams:
    - key: condition
      value: topicA
    - key: prolificId
      reference: urlParams.PROLIFIC_PID   # resolved per-participant
```

Each `urlParams` entry has a `key` and either a literal `value` or a `reference` string (not both). Add `position` to pull from a specific participant.

## Tracked Link

An instrumented external link that records click/blur/focus events and time spent away.

```yaml
- type: trackedLink
  name: signup_link
  url: https://example.org/form
  displayText: Complete the bonus signup form
  urlParams:
    - key: participant
      reference: participantInfo.sampleId
    - key: source
      value: deliberation_lab
```

## Shared Notepad

A collaborative text editor (backed by Etherpad) where participants can write together.

```yaml
- type: sharedNotepad
  name: group_notes
```

## Talk Meter

Displays cumulative speaking time for each participant. Only meaningful in video discussion stages.

```yaml
- type: talkMeter
```

## Timing and Visibility Examples

Show a submit button after 10 seconds:

```yaml
- type: submitButton
  buttonText: Continue
  displayTime: 10
```

Show wrap-up instructions in the last minute:

```yaml
- type: prompt
  file: game/wrapup.md
  displayTime: 540    # 9 minutes into a 10-minute stage
```

Show an element only to position 0, only after a condition is met:

```yaml
- type: prompt
  file: game/leader_instructions.md
  showToPositions: [0]
  conditions:
    - reference: prompt.readiness_check
      comparator: exists
```
