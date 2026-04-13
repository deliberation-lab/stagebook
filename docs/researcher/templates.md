# Templates

Templates let you define reusable blocks of YAML and instantiate them with different parameters. This is useful when you have multiple treatments that share the same structure but differ in a few values (e.g., discussion topics, prompt files, or timing).

## Defining Templates

Templates are defined in the `templates` section of your treatment file:

```yaml
templates:
  - templateName: topicStage
    contentType: stage
    templateContent:
      name: ${topicName}_discussion
      duration: 300
      discussion:
        chatType: video
        showNickname: true
        showTitle: false
      elements:
        - type: prompt
          file: topics/${topicName}_prompt.md
        - type: submitButton
```

| Field | Required | Description |
|-------|----------|-------------|
| `templateName` | yes | Unique identifier |
| `contentType` | recommended | What the template produces: `element`, `elements`, `stage`, `stages`, `treatment`, `treatments`, `introSequence`, `introExitStep`, `exitSteps`, `condition`, `reference`, `player`, or `other` |
| `templateDesc` | no | Human-readable description |
| `templateContent` | yes | The YAML structure to instantiate |

## Using Templates

Place a template context wherever the content type would normally appear:

```yaml
gameStages:
  - template: topicStage
    fields:
      topicName: immigration
  - template: topicStage
    fields:
      topicName: healthcare
```

This produces two stages with different topic names substituted throughout.

## Field Substitution

Placeholders use the `${fieldName}` syntax. They can appear in string values, as standalone values (replaced with objects or arrays), or embedded within larger strings:

```yaml
templateContent:
  name: ${prefix}_study           # embedded in a string
  file: ${promptFile}             # standalone (can be any type)
  message: "Hello ${name}!"       # embedded in a string
```

Field keys can contain letters, numbers, and underscores.

## Broadcast Expansion

Use `broadcast` to generate a cartesian product of parameter combinations:

```yaml
- template: topicStage
  fields:
    prefix: trial_${d0}_${d1}
  broadcast:
    d0:
      - topicName: immigration
      - topicName: healthcare
    d1:
      - difficulty: easy
      - difficulty: hard
```

This produces 4 stages (2 topics x 2 difficulties). Each broadcast axis is named `d0`, `d1`, `d2`, etc. The axis index is available as `${d0}`, `${d1}`, etc.

### Broadcast Rules

- Each axis is an array of field maps
- The cartesian product of all axes is computed
- Each combination substitutes its fields into a copy of the template
- Index values (`d0`, `d1`, ...) are injected as string indices (0, 1, 2, ...)

## Nesting Templates

Templates can reference other templates:

```yaml
templates:
  - templateName: outerTemplate
    contentType: treatment
    templateContent:
      name: ${treatmentName}
      playerCount: 2
      gameStages:
        - template: innerStage
          fields:
            topic: ${topicName}

  - templateName: innerStage
    contentType: stage
    templateContent:
      name: ${topic}_stage
      duration: 300
      elements:
        - type: prompt
          file: ${topic}_prompt.md
```

Templates are expanded recursively until no template blocks remain.

## Templates in Broadcast Axes

A broadcast axis can itself be a template reference:

```yaml
templates:
  - templateName: topicList
    contentType: other
    templateContent:
      - topicName: immigration
      - topicName: healthcare
      - topicName: education

treatments:
  - template: topicStage
    broadcast:
      d0:
        template: topicList
```

## Important Notes

- All `${field}` placeholders must be resolved after expansion. Leftover placeholders cause validation errors.
- All template blocks must be resolved. Leftover `template:` entries cause validation errors.
- Template expansion happens before schema validation. The expanded result must satisfy all Stagebook schemas.
- Field keys cannot be `type` (reserved for element type discrimination).
- Broadcast axis names must match `d0`, `d1`, `d2`, etc.
