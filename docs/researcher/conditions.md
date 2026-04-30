# Conditions and References

Conditions control when elements are displayed and how participants are assigned to groups. They compare a referenced value against an expected value using a comparator.

## Basic Syntax

```yaml
conditions:
  - reference: prompt.topicVote
    comparator: equals
    value: "Yes"
```

Multiple conditions use AND logic — all must be satisfied:

```yaml
conditions:
  - reference: prompt.multipleChoice
    comparator: equals
    value: response1
  - reference: prompt.openResponse
    comparator: hasLengthAtLeast
    value: 15
```

## Boolean operators: `all`, `any`, `none`

When you need OR or NOR logic, wrap conditions in an operator-keyed object. The flat-array form above is sugar for `all:` — these two are equivalent:

```yaml
# Implicit all (sugar)
conditions:
  - reference: prompt.a
    comparator: equals
    value: yes
  - reference: prompt.b
    comparator: exists

# Explicit all
conditions:
  all:
    - { reference: prompt.a, comparator: equals, value: yes }
    - { reference: prompt.b, comparator: exists }
```

Use `any:` for OR, `none:` for NOR (none of these are true):

```yaml
# Show element if either participant's previous answer was "yes"
conditions:
  any:
    - {
        reference: prompt.changedMind,
        position: 0,
        comparator: equals,
        value: yes,
      }
    - {
        reference: prompt.changedMind,
        position: 1,
        comparator: equals,
        value: yes,
      }
```

```yaml
# Render fallback message when nobody hit the threshold
conditions:
  none:
    - {
        reference: prompt.familiarity,
        position: 0,
        comparator: isAtLeast,
        value: 50,
      }
    - {
        reference: prompt.familiarity,
        position: 1,
        comparator: isAtLeast,
        value: 50,
      }
```

Operators nest. Mix freely:

```yaml
# (P1 disagrees OR P2 disagrees) AND timer hasn't overflowed
conditions:
  all:
    - any:
        - {
            reference: prompt.consensus,
            position: 0,
            comparator: equals,
            value: disagree,
          }
        - {
            reference: prompt.consensus,
            position: 1,
            comparator: equals,
            value: disagree,
          }
    - { reference: prompt.discussion_overflow, comparator: doesNotExist }
```

### Three-valued logic — what happens before data arrives

Each leaf condition can be **true**, **false**, or **unknown** (data not yet recorded). Operators propagate "unknown" so fallback elements gated on `none:` don't render prematurely:

| Operator | True when            | False when           |
| -------- | -------------------- | -------------------- |
| `all`    | every child is true  | any child is false   |
| `any`    | any child is true    | every child is false |
| `none`   | every child is false | any child is true    |

If neither row applies (because some children are still "unknown"), the operator itself is unknown — at the rendering boundary, that collapses to "don't show yet." The most common place this matters: a `none:` block whose children all reference data nobody has answered yet stays hidden until at least one answer arrives, instead of rendering as if "no one matched."

For OR logic on a single reference (across positions, comparators, etc.), `any:` is usually clearer than creating separate elements. For NOR, `none:` replaces the De Morgan trick of stacking negated comparators (`doesNotEqual`, `doesNotInclude`, `isNotOneOf`).

**Visibility-field interaction.** When an element also has `displayTime`, `hideTime`, `showToPositions`, or `hideFromPositions` set, all of those fields combine with `conditions` using implicit AND — the element is visible only when every visibility field that's set evaluates to "show." See [Element visibility](elements.md#visibility) for the full picture.

## Reference Strings

References point to data collected earlier in the experiment. The format is `type.name.path`:

### Prompt Responses

```
prompt.<name>
```

Returns the value saved by a prompt element. The `<name>` matches what you set in the treatment YAML.

### Survey Results

```
survey.<name>.result.<scoreKey>     # computed scores
survey.<name>.responses.<questionId> # raw answers
```

### Submit Button Timing

```
submitButton.<name>.time
```

Returns elapsed seconds when the button was clicked.

### Tracked Link Events

```
trackedLink.<name>.events
trackedLink.<name>.totalTimeAwaySeconds
```

### URL Parameters

```
urlParams.<paramName>
```

Query parameters from the participant's landing URL (e.g., `?role=confederate`).

### Connection Info

```
connectionInfo.country
connectionInfo.isKnownVpn
connectionInfo.timezone
```

Network metadata captured during consent.

### Browser Info

```
browserInfo.screenWidth
browserInfo.language
browserInfo.userAgent
```

Client-side browser information from onboarding.

### Participant Info

```
participantInfo.name           # nickname
participantInfo.sampleId       # recruiting platform ID
```

### Timeline Selections

```
timeline.<name>                  # the full selections array
timeline.<name>.length           # number of selections
timeline.<name>.0.start          # start time of the first range selection (seconds)
timeline.<name>.0.end            # end time of the first range selection (seconds)
timeline.<name>.0.time           # time of the first point selection (seconds)
timeline.<name>.0.track          # track index of the first selection (if track-scoped)
```

Array indices (0, 1, 2, ...) access individual selections in chronological order. Use this to validate that selections fall within expected time ranges:

```yaml
# Only show the submit button when the first selected range starts
# between 15 and 19 seconds (validating annotation accuracy)
- type: submitButton
  conditions:
    - reference: timeline.storySegment.0.start
      comparator: isAtLeast
      value: 15
    - reference: timeline.storySegment.0.start
      comparator: isAtMost
      value: 19
```

You can also check that a minimum number of selections have been made:

```yaml
- type: submitButton
  conditions:
    - reference: timeline.storySegment.length
      comparator: isAtLeast
      value: 3
```

### Discussion Metrics

```
discussion.discussionFailed
discussion.cumulativeSpeakingTime
```

## Position Modifier

When using conditions on display elements, you can reference data from other participants:

| Value              | Meaning                                                    |
| ------------------ | ---------------------------------------------------------- |
| _(omitted)_        | Current participant (same as `player`)                     |
| `player`           | Current participant                                        |
| `shared`           | Shared records (e.g., `shared: true` prompts)              |
| `0`, `1`, `2`, ... | Specific participant by position index                     |
| `all`              | Every participant must satisfy the condition               |
| `any`              | At least one participant must satisfy the condition        |
| `percentAgreement` | Compare the largest consensus percentage against the value |

### Examples

Show a submit button only when all participants have answered:

```yaml
- type: submitButton
  conditions:
    - reference: prompt.topic_vote
      position: all
      comparator: exists
```

Show content when 80%+ agree:

```yaml
- type: prompt
  file: game/consensus_reached.prompt.md
  conditions:
    - reference: prompt.topic_vote
      position: percentAgreement
      comparator: isAtLeast
      value: 80
```

Display another participant's response:

```yaml
- type: display
  reference: prompt.topicA_prompt
  position: 1
  showToPositions: [0]
```

## Comparators

### Existence

| Comparator     | Description            | Value    |
| -------------- | ---------------------- | -------- |
| `exists`       | Reference is defined   | _(none)_ |
| `doesNotExist` | Reference is undefined | _(none)_ |

### Equality

| Comparator     | Description        | Value Type                 |
| -------------- | ------------------ | -------------------------- |
| `equals`       | Strict equality    | string, number, or boolean |
| `doesNotEqual` | Not strictly equal | string, number, or boolean |

### Numeric

| Comparator  | Description           | Value Type |
| ----------- | --------------------- | ---------- |
| `isAbove`   | Strictly greater than | number     |
| `isBelow`   | Strictly less than    | number     |
| `isAtLeast` | Greater than or equal | number     |
| `isAtMost`  | Less than or equal    | number     |

### String Length

| Comparator         | Description            | Value Type |
| ------------------ | ---------------------- | ---------- |
| `hasLengthAtLeast` | String length >= value | integer    |
| `hasLengthAtMost`  | String length <= value | integer    |

### String Content

| Comparator       | Description                | Value Type     |
| ---------------- | -------------------------- | -------------- |
| `includes`       | Contains substring         | string         |
| `doesNotInclude` | Does not contain substring | string         |
| `matches`        | Matches regular expression | string (regex) |
| `doesNotMatch`   | Does not match regex       | string (regex) |

### Set Membership

| Comparator   | Description               | Value Type             |
| ------------ | ------------------------- | ---------------------- |
| `isOneOf`    | Value is in the array     | array of string/number |
| `isNotOneOf` | Value is not in the array | array of string/number |

## Using Conditions for Group Assignment

Conditions in `groupComposition` control which participants fill which positions:

```yaml
treatments:
  - name: cross_partisan
    playerCount: 2
    groupComposition:
      - position: 0
        title: "Democrat"
        conditions:
          - reference: survey.partyAffiliation.result.normPosition
            comparator: isBelow
            value: 0.5
      - position: 1
        title: "Republican"
        conditions:
          - reference: survey.partyAffiliation.result.normPosition
            comparator: isAbove
            value: 0.5
```

You can also use URL parameters for pre-assigned roles:

```yaml
groupComposition:
  - position: 0
    title: Confederate
    conditions:
      - reference: urlParams.role
        comparator: equals
        value: confederate
  - position: 1
    title: Participant
    conditions:
      - reference: urlParams.role
        comparator: equals
        value: participant
```

**Note:** Group assignment conditions can only use the participant's own responses — no `position` modifier is available.

## Stage-level conditions

Any stage, intro step, or exit step can carry its own `conditions` array. Think of it as: _this stage should be active while these conditions hold._ When any condition is false, stagebook asks the host to advance — either skipping the stage at load (if the data comes from an earlier stage) or ending it early (if it comes from the current stage).

Same condition syntax, same comparators, same position modifier as element-level conditions.

### Skip a stage based on prior data

Round 2 only runs if the group voted to continue after round 1:

```yaml
gameStages:
  - name: round1_vote
    duration: 60
    elements:
      - type: survey
        surveyName: continueVote
        name: continueVote

  - name: round2
    duration: 300
    conditions:
      - reference: survey.continueVote.result.keepGoing
        comparator: equals
        value: "yes"
        position: all
    elements:
      - type: prompt
        file: round2.prompt.md
      - type: submitButton
```

### End a stage early (early termination)

Condition authored so it's `true` while no one has submitted, flips to `false` as soon as anyone does:

```yaml
gameStages:
  - name: speed_round
    duration: 120
    conditions:
      - reference: submitButton.speedSubmit
        comparator: doesNotExist
        position: all
    elements:
      - type: submitButton
        name: speedSubmit
```

### Position rules

Game-stage conditions must evaluate **identically on every client** or the stage desyncs (one participant skips while the other renders). Stagebook rejects per-player positions at preflight for game stages:

| Context            | Default / `player`       | `shared` / `all` / `any` / `percentAgreement` / index |
| ------------------ | ------------------------ | ----------------------------------------------------- |
| Game stages        | ❌ rejected at preflight | ✅                                                    |
| Intro / exit steps | ✅                       | ✅                                                    |

Intro and exit steps run per-participant, so any position is fine there — including the default.

### `percentAgreement` needs a numeric comparator

`percentAgreement` aggregates all players' values and compares the _percentage of agreement_ against a threshold. Preflight now enforces that the comparator is one of `isAbove`, `isBelow`, `isAtLeast`, `isAtMost` — the ones that actually compare numbers.

```yaml
# At least 60% of the group agreed on some value
conditions:
  - reference: survey.vote.result.choice
    comparator: isAtLeast
    value: 60
    position: percentAgreement
```

### Host requirements

Stage-level conditions rely on two fields on `StagebookContext`:

- `advanceStage()` — called by stagebook when conditions fail. Hosts implement the advancement policy. Single-participant hosts wrap `submit()`; multi-participant hosts submit for every player (so dropouts can't hang the stage).
- `stageId` — opaque per-stage identifier. Lets stagebook reset its internal latch cleanly between stages without a key-remount by the host.

See [platform-requirements.md](../engineer/platform-requirements.md) for the full host-integration checklist.

## Preflight reference validation

References (in conditions, `display.reference`, `trackedLink` / `qualtrics` `urlParams`, discussion conditions, and `groupComposition` conditions) are checked at preflight. Two rules, the second of which is stage-condition-specific:

### No forward references — everywhere

A reference must point at data produced by an earlier or the current stage in the flow:

```
introSteps → gameStages → exitSequence
```

Referencing a stage that hasn't run yet is rejected. External references (`urlParams.*`, `participantInfo.*`, `connectionInfo.*`, `browserInfo.*`) are always valid — they come from the platform, not a stage.

`groupComposition` is stricter: it runs before the game starts, so its conditions can only reference intro-phase or external data. Referencing game or exit data from `groupComposition` is rejected.

### No always-skip-at-load — stage-level conditions only

A stage-level condition that references its _own_ stage's data (early-termination pattern) must be authored so `compare(undefined, comparator, value) === true` — otherwise the stage evaluates false at mount and always skips itself, which is almost always a forgotten `doesNotExist`.

OK:

```yaml
conditions:
  - reference: submitButton.speedSubmit
    comparator: doesNotExist # true against undefined → stage renders
    position: all
```

Rejected at preflight:

```yaml
conditions:
  - reference: submitButton.speedSubmit
    comparator: exists # false against undefined → always skips
    position: all
```

This rule only applies to stage-level conditions. Element-level conditions, `display.reference`, `urlParams`, and discussion conditions all have "wait for data to arrive" semantics where false-at-load is the standard pattern (e.g., a submit button that appears only after the prompt is answered).
