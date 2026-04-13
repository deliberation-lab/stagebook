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
  file: game/discussion_prompt.prompt.md
  name: topicA_prompt        # optional — names the saved response
  shared: true               # optional — single response editable by all participants
```

**Shorthand:** A bare string in the `elements` array is treated as a prompt:

```yaml
elements:
  - game/discussion_prompt.prompt.md   # equivalent to { type: prompt, file: "..." }
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

## Media Player

Embeds a video or audio file with optional researcher-controlled playback UI. All interactions — play, pause, seek, speed changes — are recorded with timestamps.

Use a direct URL for any video/audio file, or a YouTube URL for embedded YouTube videos.

```yaml
- type: mediaPlayer
  name: intro_video
  url: https://example.com/study/clip.mp4
```

### Sync mode (default)

By default each participant controls their own playback independently.

```yaml
- type: mediaPlayer
  name: coding_clip
  url: https://example.com/clips/scene1.mp4
  controls:
    playPause: true
    seek: true        # ±1s seek buttons + scrub bar
    step: true        # step by stepDuration
    speed: true       # 0.5×–2× speed cycling
  stepDuration: 0.5   # seconds per step (default: 1)
  startAt: 30         # seek to 30s on load
  stopAt: 90          # pause and record event at 90s
```

### Synchronized mode

Ties video time to stage elapsed time so all participants stay in sync. Hides all controls — only useful when you also set `submitOnComplete`.

```yaml
- type: mediaPlayer
  name: group_video
  url: https://youtu.be/QC8iQqtG0hg
  syncToStageTime: true
  submitOnComplete: true   # stage advances when video ends
```

### Options

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `url` | string | required | Direct media URL or YouTube URL |
| `playVideo` | boolean | `true` | Show the video track (set `false` for audio-only) |
| `playAudio` | boolean | `true` | Unmute audio |
| `captionsFile` | string | — | Path to a `.vtt` captions file |
| `startAt` | number | — | Jump to this timestamp (seconds) on load |
| `stopAt` | number | — | Pause and record a `stopAt` event at this timestamp |
| `allowScrubOutsideBounds` | boolean | `false` | Let participants scrub outside `startAt`/`stopAt` window |
| `stepDuration` | number | `1` | Seconds per step button / `,` `.` key press |
| `syncToStageTime` | boolean | `false` | Lock video time to stage elapsed time; hides all controls |
| `submitOnComplete` | boolean | `false` | Auto-submit the stage when the video ends |
| `controls.playPause` | boolean | — | Show play/pause button |
| `controls.seek` | boolean | — | Show ±1s seek buttons and scrub bar |
| `controls.step` | boolean | — | Show step-back / step-forward buttons |
| `controls.speed` | boolean | — | Show speed-cycle button (0.5×, 0.75×, 1×, 1.25×, 1.5×, 2×) |

### Keyboard shortcuts

When the player has focus:

| Key | Action |
|-----|--------|
| `Space` / `K` | Play / pause |
| `←` / `→` | Seek ±1 second |
| `J` / `L` | Seek ±10 seconds |
| `,` / `.` | Step ±`stepDuration` seconds |
| `<` / `>` | Decrease / increase speed one step |
| Hold `←` / `→` | Fast-scrub at 2× |

### Saved data

Each interaction is appended to an event list under the element's name:

```json
{
  "name": "coding_clip",
  "url": "https://example.com/clips/scene1.mp4",
  "startAt": 30,
  "stopAt": 90,
  "lastVideoTime": 87.4,
  "events": [
    { "type": "play",   "videoTime": 30.0, "stageTimeElapsed": 4.1 },
    { "type": "seek",   "videoTime": 45.0, "stageTimeElapsed": 12.0, "fromTime": 30.0 },
    { "type": "pause",  "videoTime": 45.2, "stageTimeElapsed": 19.3 },
    { "type": "speed",  "videoTime": 45.2, "stageTimeElapsed": 20.1, "playbackRate": 1.5 },
    { "type": "play",   "videoTime": 45.2, "stageTimeElapsed": 20.5 },
    { "type": "stopAt", "videoTime": 90.0, "stageTimeElapsed": 74.8 }
  ],
  "watchedRanges": [[30.0, 90.0]]
}
```

Event types: `play`, `pause`, `ended` (natural end), `stopAt` (reached stopAt position), `seek` (includes `fromTime`), `speed` (includes `playbackRate`).

`watchedRanges` is derived from the event log: closed `[start, end]` intervals (in video seconds) of the portions the participant actually watched, with overlapping or touching intervals merged. Open intervals (a `play` with no closing event — e.g. a mid-playback disconnect) are excluded.

## Timeline

A form input for marking ranges (intervals) or points (moments) on a media player's timeline. Like a slider saves a number or a radio group saves a choice, the timeline saves a list of time-stamped selections. Use it for annotation and coding tasks — e.g., "mark every segment where Speaker A interrupts Speaker B" or "mark each time the participant nods."

The timeline links to a sibling `mediaPlayer` element by name via the `source` field. It is always a consumer — it reads playback state and can seek, but never controls play/pause directly.

```yaml
- type: mediaPlayer
  name: coding_video
  url: shared/interview.mp4
  controls:
    playPause: true
    seek: true

- type: timeline
  source: coding_video          # links to the player above by name
  name: interruptions
  selectionType: range          # "range" or "point"
  multiSelect: true             # allow multiple selections
```

### Range mode vs point mode

**Range mode** (`selectionType: range`) — for marking intervals with a start and end time. Participants click-and-drag on the waveform to create a range.

**Point mode** (`selectionType: point`) — for marking individual moments. Participants click on the waveform to place a point marker.

### Selection scope

By default (`selectionScope: all`), selections span all audio channels. In `track` mode, each selection belongs to the specific speaker track the participant clicks on — two speakers can have overlapping time ranges across tracks, but not within the same track.

```yaml
- type: timeline
  source: coding_video
  name: assertions
  selectionType: range
  selectionScope: track         # selections are per-speaker
  multiSelect: true
  trackLabels:                  # custom labels for the track gutter
    - "Interviewer"
    - "Participant"
```

When `trackLabels` is omitted, tracks are labeled by position index: "Position 0", "Position 1", etc. (matching the channel order in the composed video). If there are more audio channels than labels, extra channels fall back to "Position N".

### Use case examples

| `selectionType` | `multiSelect` | `selectionScope` | Use case |
|-----------------|---------------|------------------|----------|
| `range` | `false` | `all` | "Select when the story starts and ends" |
| `range` | `true` | `all` | "Mark every pause longer than 3 seconds" |
| `range` | `true` | `track` | "Mark every segment where each speaker makes an assertion" |
| `point` | `false` | `all` | "Mark the moment the participant changes their mind" |
| `point` | `true` | `all` | "Mark each time someone laughs" |
| `point` | `true` | `track` | "Mark each time each speaker nods" |

### Options

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `source` | string | required | `name` of a sibling `mediaPlayer` element to link to |
| `name` | string | required | Storage key for saved selections |
| `selectionType` | `"range"` or `"point"` | required | Whether participants mark intervals or moments |
| `selectionScope` | `"all"` or `"track"` | `"all"` | Whether selections span all tracks or belong to a specific speaker track |
| `multiSelect` | boolean | `false` | Allow multiple selections. When `false`, creating a new selection replaces the previous one |
| `showWaveform` | boolean | `true` | Show the audio waveform visualization (fills in as the clip plays) |
| `trackLabels` | string[] | — | Custom labels for the track gutter. Falls back to "Position N" |

### Mouse interactions

**Range mode:**

| Gesture | Action |
|---------|--------|
| Click on empty space | Seek playhead to that time |
| Click-and-drag on empty space | Create a new range (clamped to free space — ranges cannot overlap within a track/scope) |
| Click on an existing range | Select it (shows handles) |
| Drag a handle | Adjust the range boundary (clamped so ranges cannot overlap or invert) |
| Click outside all ranges | Deselect |

**Point mode:**

| Gesture | Action |
|---------|--------|
| Click on empty space | Place a new point and seek playhead there |
| Click on an existing point | Select it |
| Drag a selected point | Reposition it |

### Keyboard shortcuts

The timeline only captures keys when a selection is active. Otherwise all keys fall through to the media player (Space, K, J, L, arrows, etc. still work for playback).

**Range mode (handle active):**

| Key | Action |
|-----|--------|
| `Left` / `Right` | Adjust active handle +-1 second (video seeks to show the frame) |
| `,` / `.` | Adjust active handle +-1 frame (~0.033s) |
| `Tab` | Switch active handle (start / end) |
| `Delete` / `Backspace` | Remove the selected range |
| `Ctrl+Z` / `Cmd+Z` | Undo last action |
| `Escape` | Deselect |

**Point mode (point selected):**

| Key | Action |
|-----|--------|
| `Left` / `Right` | Reposition +-1 second |
| `,` / `.` | Reposition +-1 frame |
| `Delete` / `Backspace` | Remove the selected point |
| `Ctrl+Z` / `Cmd+Z` | Undo last action |
| `Escape` | Deselect |

### Zoom and minimap

The footer bar contains `[+]` and `[-]` buttons for zooming in and out. When zoomed in:

- A **minimap** appears above the time ruler showing a compressed overview of the full duration. Click the minimap to pan, or drag the viewport rectangle.
- The viewport **auto-scrolls** during playback when the playhead reaches 90% of the visible area.
- A **seek or scrub** (via the media player's controls or clicking the timeline) snaps the viewport so the playhead is ~25% from the left edge.

The footer also shows a selection summary (count when nothing is active, time readout when a selection is focused) and a `[?]` help button that opens a keyboard shortcut reference.

### Waveform

The waveform tracks fill in progressively as the participant plays the clip — empty at first, fully drawn after one complete playthrough. This uses the Web Audio API's AnalyserNode and requires no pre-processing or extra files.

If the media file has multiple audio channels (e.g., per-speaker audio from a group video composition), each channel is displayed as a separate track. Mono or stereo files show a single track.

**CORS requirement:** The media must be served with proper CORS headers (`Access-Control-Allow-Origin`). Without them, the waveform tracks render as flat lines (the browser silently taints the audio stream). Same-origin media is unaffected. If this happens, a console warning appears after 5 seconds of playback.

### Saved data

Saved under `timeline_<name>`. The value is always a chronologically sorted array — even when `multiSelect: false` (the array has at most one item).

**Range mode, `selectionScope: "all"`:**
```json
[
  { "start": 12.5, "end": 18.3 },
  { "start": 45.0, "end": 52.1 }
]
```

**Range mode, `selectionScope: "track"`:**
```json
[
  { "track": 0, "start": 12.5, "end": 18.3 },
  { "track": 1, "start": 14.0, "end": 20.5 }
]
```

**Point mode, `selectionScope: "all"`:**
```json
[
  { "time": 8.2 },
  { "time": 31.0 },
  { "time": 55.7 }
]
```

**Point mode, `selectionScope: "track"`:**
```json
[
  { "track": 0, "time": 8.2 },
  { "track": 1, "time": 15.4 }
]
```

Selections are saved on each user action (creating, adjusting, deleting, or undoing). Keyboard adjustments (holding arrow keys) are debounced — the save fires ~500ms after the last keypress. Handle drags save once on release, not on every pixel of motion.

Saved selections are **restored on reload** — if a participant refreshes mid-stage, their existing marks reappear.

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

By default a short helper line appears below the link reminding participants the
link opens in a new tab. Override it with `helperText` to give task-specific
guidance, or set it to an empty string to hide the helper entirely:

```yaml
- type: trackedLink
  name: signup_link
  url: https://example.org/form
  displayText: Complete the bonus signup form
  helperText: "You'll need about 5 minutes. Return here when you're done."
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | yes | Storage key for the tracking record |
| `url` | string | yes | Destination URL |
| `displayText` | string | yes | Visible link text |
| `helperText` | string | no | Text shown below the link. Defaults to "Link opens in a new tab. Return to this tab to complete the study." Pass an empty string to hide. |
| `urlParams` | list | no | Query parameters appended to the URL (see Qualtrics example) |

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
  file: game/wrapup.prompt.md
  displayTime: 540    # 9 minutes into a 10-minute stage
```

Show an element only to position 0, only after a condition is met:

```yaml
- type: prompt
  file: game/leader_instructions.prompt.md
  showToPositions: [0]
  conditions:
    - reference: prompt.readiness_check
      comparator: exists
```
