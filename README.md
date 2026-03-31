# SCORE

Structured Complete Open Record of Experiment

Executable Study Protocol

A language for describing interactive social science experiments — the schemas, validators, utilities, and rendering components that turn a study protocol into what participants actually see.

## What is SCORE?

SCORE defines a declarative language for specifying interactive group experiments: stages, elements (prompts, surveys, timers, discussions), conditional logic, templates, and participant positioning. It provides:

- **Zod schemas** that validate treatment files, batch configs, and prompt files
- **A template engine** for parameterized experiment designs with broadcast expansion
- **Shared utilities** for condition evaluation, reference resolution, and prompt parsing
- **React components** that render SCORE elements into participant-facing UI
- **Documentation** of the language specification

SCORE is platform-agnostic. Define your study protocol once, then run it on any compatible platform.

## Installation

```bash
npm install @deliberation-lab/score
```

## Usage

### Validating a treatment file

```js
import { treatmentFileSchema } from "@deliberation-lab/score";
import { load as loadYaml } from "js-yaml";

const config = loadYaml(yamlString);
const result = treatmentFileSchema.safeParse(config);

if (!result.success) {
  console.error(result.error.issues);
}
```

### Evaluating conditions

```js
import { compare } from "@deliberation-lab/score";

compare(5, "isAbove", 3); // true
compare("hello", "includes", "ell"); // true
compare(undefined, "exists"); // false
```

### Parsing a prompt file

```js
import { parsePromptFile } from "@deliberation-lab/score";

const { metadata, body, responseItems } = parsePromptFile(markdownString);
```

### Rendering elements (React)

```jsx
import { Element, ScoreProvider } from "@deliberation-lab/score/components";

<ScoreProvider value={context}>
  <Element element={{ type: "prompt", file: "myPrompt.md" }} />
</ScoreProvider>;
```

The `ScoreProvider` accepts a context object that your platform implements:

```
const context = {
  resolve(reference, position) { /* read state */ },
  save(key, value, scope) { /* write state */ },
  getElapsedTime() { /* seconds since step started */ },
  submit() { /* advance to next step */ },
  progressLabel: "game_0_discussion",
  playerId: "abc123",
  position: 0,
  playerCount: 3,
  isSubmitted: false,
  renderDiscussion: (config) => <YourVideoComponent {...config} />,
};

## Documentation


## License
```
