// @deliberation-lab/score/components
// React components for rendering SCORE elements

// Context provider and hooks
export {
  ScoreProvider,
  useScoreContext,
  useResolve,
  useSave,
  useElapsedTime,
  useTextContent,
  type ScoreContext,
  type TextContentResult,
} from "./ScoreProvider.js";

// Element router (requires ScoreProvider)
export { Element, type ElementConfig, type ElementProps } from "./Element.js";

// Standalone form components — no ScoreProvider required
export {
  Button,
  type ButtonProps,
  Separator,
  type SeparatorProps,
  RadioGroup,
  type RadioGroupProps,
  type RadioOption,
  CheckboxGroup,
  type CheckboxGroupProps,
  type CheckboxOption,
  TextArea,
  type TextAreaProps,
  type DebugMessage,
  type TypingStats,
  type PasteAttempt,
  Slider,
  type SliderProps,
  ListSorter,
  type ListSorterProps,
  Markdown,
  type MarkdownProps,
} from "./form/index.js";

// Pure element components — usable with manual prop wiring
export {
  Display,
  type DisplayProps,
  SubmitButton,
  type SubmitButtonProps,
  AudioElement,
  type AudioElementProps,
  ImageElement,
  type ImageElementProps,
  KitchenTimer,
  type KitchenTimerProps,
  TrackedLink,
  type TrackedLinkProps,
  type ResolvedParam,
  TrainingVideo,
  type TrainingVideoProps,
  Prompt,
  type PromptProps,
} from "./elements/index.js";

// Conditional rendering components
export {
  TimeConditionalRender,
  type TimeConditionalRenderProps,
  PositionConditionalRender,
  type PositionConditionalRenderProps,
  ConditionsConditionalRender,
  type ConditionsConditionalRenderProps,
  type Condition,
  SubmissionConditionalRender,
  type SubmissionConditionalRenderProps,
} from "./conditions/index.js";
