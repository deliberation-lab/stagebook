# Prompt Files

Prompts are Markdown files with three sections separated by lines of three or more dashes (`---`):

1. **Metadata** — YAML frontmatter defining the prompt type and behavior
2. **Body** — Markdown-formatted text displayed to the participant
3. **Responses** — Response options (format depends on type)

## Example

```markdown
---
type: multipleChoice
---

# Which wizard appears in the most novels?

---

- Dr. Strange
- Gandalf
- Harry Potter
- Dumbledore
```

## Metadata Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | no | Optional human-readable identifier. Can be any string. |
| `type` | enum | yes | `multipleChoice`, `openResponse`, `noResponse`, `listSorter`, `slider` |
| `notes` | string | no | Internal notes (not displayed) |

### Type-specific fields

**`openResponse`:**

| Field | Type | Description |
|-------|------|-------------|
| `rows` | integer >= 1 | Height of the text area in lines (default: 5) |
| `minLength` | integer >= 0 | Display a character counter; show progress toward minimum |
| `maxLength` | integer >= 1 | Enforce a maximum character count |

**`multipleChoice`:**

| Field | Type | Description |
|-------|------|-------------|
| `select` | `"single"` or `"multiple"` | Radio buttons (default) or checkboxes |
| `shuffleOptions` | boolean | Randomize option order before display |
| `layout` | `"vertical"` or `"horizontal"` | Option layout direction (default: `vertical`) |

**`slider`:**

| Field | Type | Description |
|-------|------|-------------|
| `min` | number | **Required.** Minimum slider value |
| `max` | number | **Required.** Maximum slider value (must be > min) |
| `interval` | number | **Required.** Step size (min + interval must be <= max) |
| `labelPts` | number[] | Positions where tick marks and labels appear |

When `labelPts` is specified, the number of entries must match the number of response items.

**`noResponse`:** No type-specific fields. The responses section should be empty.

**`listSorter`:** No type-specific fields. Response items are the list to be reordered.

## Body Section

Standard [CommonMark](https://commonmark.org/help/) with [GitHub Flavored Markdown](https://github.github.com/gfm/) support: headings, bold, italic, lists, tables, links, images.

Images use paths relative to the asset repository root:

```markdown
![diagram](shared/question_diagram.png)
```

**Note:** You cannot use `---` as a horizontal rule in the body since it's used as the section delimiter. Use `***` or `___` instead.

## Response Section

The format depends on the prompt type:

### Multiple Choice / List Sorter

Each option on its own line, prefixed with `- `:

```markdown
- Option A
- Option B
- Option C
```

### Open Response

Placeholder text prefixed with `> `:

```markdown
> Type your response here
```

### Slider

Labels for tick marks, prefixed with `- `:

```markdown
- Strongly Disagree
- Disagree
- Neutral
- Agree
- Strongly Agree
```

### No Response

Leave the section empty (or blank lines).

## Prompt Types in Detail

### Multiple Choice

```markdown
---
type: multipleChoice
shuffleOptions: true
---

What is your favorite color?

---

- Red
- Blue
- Green
- Yellow
```

Use `select: multiple` for checkbox behavior:

```markdown
---
type: multipleChoice
select: multiple
---

Select all colors you like:

---

- Red
- Blue
- Green
- Yellow
```

Use `layout: horizontal` to lay options out in a row (useful for short option sets like yes/no):

```markdown
---
type: multipleChoice
layout: horizontal
---

Do you agree?

---

- Yes
- No
```

### Open Response

```markdown
---
type: openResponse
rows: 4
minLength: 50
maxLength: 500
---

Please describe your experience in detail.

---

> Write your response here.
```

The character counter appears automatically when `minLength` or `maxLength` is set. `maxLength` is enforced (input is capped); `minLength` is displayed but must be enforced separately via conditions if you want to block submission.

### Slider

The slider initializes **without a visible thumb** to avoid anchoring participants' responses. Clicking the track sets the initial value.

```markdown
---
type: slider
min: 0
max: 100
interval: 1
labelPts: [0, 25, 50, 75, 100]
---

How much do you agree with the following statement?

---

- Strongly Disagree
- Disagree
- Neutral
- Agree
- Strongly Agree
```

### List Sorter

```markdown
---
type: listSorter
---

Drag the following items into your preferred order:

---

- Economy
- Healthcare
- Education
- Environment
- Security
```

### No Response

Use for informational text that doesn't collect a response:

```markdown
---
type: noResponse
---

Please read the following instructions carefully before proceeding.

The study will take approximately 15 minutes.

---

```
