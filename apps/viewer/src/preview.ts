// Preview infrastructure — reusable by any app that wants to preview
// stagebook treatment content (VS Code extension, standalone viewer, etc.)

// Lib utilities
export { ViewerStateStore } from "./lib/store";
export type { PositionKey, StoreEntry, StoreRecord } from "./lib/store";
export { createViewerContext } from "./lib/context";
export type { ViewerContextOptions } from "./lib/context";
export { flattenSteps } from "./lib/steps";
export type { ViewerStep, Phase } from "./lib/steps";
export { extractStageReferences } from "./lib/references";
export { extractTimeBreakpoints } from "./lib/timeBreakpoints";
export { createUrlContentFns } from "./lib/contentFns";

// React components
export { Viewer } from "./components/Viewer";
export type { ViewerProps } from "./components/Viewer";
export { PreviewHost } from "./components/PreviewHost";
export type { PreviewHostProps } from "./components/PreviewHost";
export { StageNav } from "./components/StageNav";
export { StateInspector } from "./components/StateInspector";
export { TimeScrubber } from "./components/TimeScrubber";
export {
  SkeletonPlaceholder,
  createSkeletonRenderers,
} from "./components/SkeletonPlaceholder";
export { TreatmentPicker } from "./components/TreatmentPicker";
export { FieldForm } from "./components/FieldForm";
