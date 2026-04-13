# Writing Treatment Files

A treatment file is a YAML document (`.treatments.yaml`) that defines the complete flow of an interactive experiment. It specifies when and to whom different elements are displayed, under what conditions, and in what sequence — but not the content itself. Content such as prompts, instructions, and surveys are written separately in Markdown files and referenced within the treatment file.

## File Structure

Every treatment file has three top-level sections:

```yaml
templates:       # optional — reusable blocks of structure
introSequences:  # required — pre-randomization onboarding steps
treatments:      # required — post-randomization experiment flows
```

Everything is validated after templates are expanded. Unfilled `${field}` placeholders or unresolved template blocks are errors.

## Experiment Lifecycle

Each study follows a three-phase structure:

### 1. Intro Sequence (asynchronous, solo)

Completed individually before group assignment. Typically includes consent, setup checks, and researcher-defined surveys or prompts. You can define multiple intro sequences, but each batch uses exactly one.

### 2. Game Stages (synchronous, group)

The live portion where participants move through stages simultaneously. Each treatment defines a unique pathway. You can host video or text conversations, insert prompts between discussions, show different content to different positions, and include timers and submit buttons.

### 3. Exit Sequence (asynchronous, solo)

Post-game follow-up at each participant's pace: surveys, quality checks, debriefing. Defined per-treatment, so different conditions can have different exit flows.

## Complete Example

```yaml
introSequences:
  - name: default
    introSteps:
      - name: Consent
        elements:
          - type: prompt
            file: intro/consent.prompt.md
          - type: submitButton

      - name: Pre-Survey
        elements:
          - type: survey
            surveyName: TIPI
            name: preTIPI
          - type: submitButton

treatments:
  - name: two_player_discussion
    desc: Simple two-player video discussion
    playerCount: 2

    gameStages:
      - name: Discussion
        duration: 300
        discussion:
          chatType: video
          showNickname: true
          showTitle: false
        elements:
          - type: prompt
            file: game/discussion_prompt.prompt.md
          - type: submitButton
            buttonText: Leave Discussion

      - name: Post-Discussion Survey
        duration: 120
        elements:
          - type: prompt
            file: game/post_discussion.prompt.md
          - type: submitButton

    exitSequence:
      - name: Debrief
        elements:
          - type: prompt
            file: exit/debrief.prompt.md
          - type: submitButton
            buttonText: Finish
```

## Stages

Each game stage has:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | yes | Identifier for logging (not shown to participants) |
| `duration` | integer | yes | Stage length in seconds |
| `discussion` | object | no | Video/text chat configuration (see [Discussions](discussions.md)) |
| `elements` | array | yes | UI elements displayed during the stage |

Intro and exit steps have `name` and `elements` but no `duration` (they are untimed).

## Positions

When players join a group, each is assigned a zero-based position index (0, 1, 2, ...). Use positions to control what each participant sees:

```yaml
elements:
  - type: prompt
    file: game/democrat_instructions.prompt.md
    showToPositions: [0]
  - type: prompt
    file: game/republican_instructions.prompt.md
    showToPositions: [1]
```

Positions are consistent for the entire treatment. Use `showToPositions` and `hideFromPositions` on elements and discussions.

## Group Composition

Optionally define requirements for who fills each position:

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

Positions must be unique and cover 0 through `playerCount - 1`.

## Naming Rules

Names (for stages, elements, treatments, etc.) must be:
- 1 to 64 characters
- Letters, numbers, spaces, `_`, `-`
- May include template placeholders like `${fieldName}`
