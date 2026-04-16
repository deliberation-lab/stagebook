import {
  useEffect,
  useState,
  useMemo,
  useCallback,
  useSyncExternalStore,
} from "react";
import type { TreatmentFileType } from "stagebook";
import { StagebookProvider, Stage } from "stagebook/components";
import { flattenSteps } from "../lib/steps";
import { ViewerStateStore } from "../lib/store";
import { createViewerContext } from "../lib/context";
import { StageNav } from "./StageNav";
import { StateInspector } from "./StateInspector";
import { TimeScrubber } from "./TimeScrubber";
import { createSkeletonRenderers } from "./SkeletonPlaceholder";

export interface ViewerProps {
  treatmentFile: TreatmentFileType;
  /** Must be referentially stable (memoized) to avoid re-fetch loops. */
  getTextContent: (path: string) => Promise<string>;
  /** Must be referentially stable (memoized) to avoid re-fetch loops. */
  getAssetURL: (path: string) => string;
  selectedIntroIndex: number;
  selectedTreatmentIndex: number;
  /**
   * Optional back affordance. When provided, the header shows a back arrow
   * that invokes this callback. Omit to hide the arrow (e.g. in an embedded
   * preview where there is no prior screen to return to).
   */
  onBack?: () => void;
  /**
   * Optional refresh affordance. When provided, the header shows a reload
   * icon that invokes this callback. The Viewer itself doesn't re-fetch —
   * hosts are expected to supply an updated `treatmentFile` prop in response.
   * Viewer state (stageIndex, position, saved responses) persists across the
   * prop update since React doesn't unmount the component.
   */
  onRefresh?: () => void;
}

export function Viewer({
  treatmentFile,
  getTextContent,
  getAssetURL,
  selectedIntroIndex,
  selectedTreatmentIndex,
  onBack,
  onRefresh,
}: ViewerProps) {
  const treatment = treatmentFile.treatments[selectedTreatmentIndex];
  const introSequence = treatmentFile.introSequences[selectedIntroIndex];

  const steps = useMemo(
    () => flattenSteps(introSequence, treatment),
    [introSequence, treatment],
  );

  const [stageIndex, setStageIndex] = useState(0);
  const [position, setPosition] = useState(0);
  const [store] = useState(() => new ViewerStateStore());

  // Clamp stageIndex if the treatment was edited to have fewer stages
  // (e.g. researcher deleted a stage while the preview was open). Without
  // this, steps[stageIndex] returns undefined and the viewer blanks.
  useEffect(() => {
    if (steps.length > 0 && stageIndex >= steps.length) {
      setStageIndex(steps.length - 1);
    }
  }, [steps.length, stageIndex]);

  // Subscribe to store changes so the UI re-renders.
  // The version is included in ctx memo deps below so that
  // StagebookProvider gets a new context value on store changes.
  const storeVersion = useSyncExternalStore(
    useCallback((cb: () => void) => store.onChange(cb), [store]),
    useCallback(() => store.getVersion(), [store]),
  );

  const currentStep = steps[stageIndex];
  const isSubmitted = store.getSubmitted(stageIndex);

  const handleSubmit = useCallback(() => {
    store.setSubmitted(stageIndex, true);
  }, [store, stageIndex]);

  const handleNext = useCallback(() => {
    if (stageIndex < steps.length - 1) {
      setStageIndex(stageIndex + 1);
    }
  }, [stageIndex, steps.length]);

  const handleTimeChange = useCallback(
    (seconds: number) => store.setElapsedTime(stageIndex, seconds),
    [store, stageIndex],
  );

  const ctx = useMemo(
    () =>
      createViewerContext({
        store,
        position,
        stageIndex,
        playerCount: treatment.playerCount,
        onSubmit: handleSubmit,
        getTextContent,
        getAssetURL,
        renderers: createSkeletonRenderers(),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      store,
      storeVersion,
      position,
      stageIndex,
      treatment.playerCount,
      handleSubmit,
      getTextContent,
      getAssetURL,
    ],
  );

  if (!currentStep) return null;

  const stageConfig = {
    name: currentStep.name,
    duration: currentStep.duration,
    elements: currentStep.elements,
  };

  return (
    <div style={layoutStyle}>
      {/* Header */}
      <header style={headerStyle}>
        <div style={headerLeftStyle}>
          {onBack && (
            <button aria-label="Back" onClick={onBack} style={backButtonStyle}>
              &larr;
            </button>
          )}
          {onRefresh && (
            <button
              aria-label="Refresh preview"
              title="Refresh preview"
              onClick={onRefresh}
              style={refreshButtonStyle}
            >
              &#x21bb;
            </button>
          )}
          <span style={treatmentNameStyle}>{treatment.name}</span>
        </div>
        <StageNav
          steps={steps}
          currentIndex={stageIndex}
          onSelect={setStageIndex}
        />
        <TimeScrubber
          currentStep={currentStep}
          elapsedTime={store.getElapsedTime(stageIndex)}
          onTimeChange={handleTimeChange}
        />
        <div style={positionSwitcherStyle}>
          <label htmlFor="position-select" style={positionLabelStyle}>
            Position
          </label>
          <select
            id="position-select"
            value={position}
            onChange={(e) => setPosition(Number(e.target.value))}
            style={positionSelectStyle}
          >
            {Array.from({ length: treatment.playerCount }, (_, i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </select>
        </div>
      </header>

      <div style={bodyStyle}>
        <aside style={sidebarStyle}>
          <StateInspector
            store={store}
            currentStep={currentStep}
            stageIndex={stageIndex}
            position={position}
            playerCount={treatment.playerCount}
          />
        </aside>

        {/* Main content */}
        <main style={mainStyle}>
          {isSubmitted ? (
            <div style={submittedOverlayStyle}>
              <p style={submittedTextStyle}>
                Waiting for other participants...
              </p>
              <button onClick={handleNext} style={nextButtonStyle}>
                Next &rarr;
              </button>
              <button
                onClick={() => store.setSubmitted(stageIndex, false)}
                style={toggleSubmitStyle}
              >
                Show stage again
              </button>
            </div>
          ) : (
            <StagebookProvider value={ctx}>
              <Stage stage={stageConfig} onSubmit={handleSubmit} />
            </StagebookProvider>
          )}
        </main>
      </div>
    </div>
  );
}

// --- Styles ---

const layoutStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  height: "100vh",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "0.5rem 1rem",
  borderBottom: "1px solid #e5e7eb",
  backgroundColor: "white",
  gap: "1rem",
  flexShrink: 0,
};

const headerLeftStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.5rem",
};

const backButtonStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  cursor: "pointer",
  fontSize: "1.25rem",
  color: "#6b7280",
  padding: "0.25rem",
};

const refreshButtonStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  cursor: "pointer",
  fontSize: "1.1rem",
  color: "#6b7280",
  padding: "0.25rem",
  lineHeight: 1,
};

const treatmentNameStyle: React.CSSProperties = {
  fontWeight: 600,
  fontSize: "0.875rem",
  color: "#1f2937",
};

const positionSwitcherStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.5rem",
};

const positionLabelStyle: React.CSSProperties = {
  fontSize: "0.75rem",
  color: "#6b7280",
};

const positionSelectStyle: React.CSSProperties = {
  padding: "0.25rem 0.5rem",
  borderRadius: "0.25rem",
  border: "1px solid #d1d5db",
  fontSize: "0.75rem",
};

const bodyStyle: React.CSSProperties = {
  display: "flex",
  flex: 1,
  overflow: "hidden",
};

const sidebarStyle: React.CSSProperties = {
  width: "var(--viewer-sidebar-width)",
  flexShrink: 0,
  borderRight: "1px solid #e5e7eb",
  backgroundColor: "#fafafa",
  overflow: "auto",
  padding: "1rem",
};

const mainStyle: React.CSSProperties = {
  flex: 1,
  overflow: "auto",
  padding: "1.5rem",
  display: "flex",
  justifyContent: "center",
};

const submittedOverlayStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "1rem",
  height: "100%",
  width: "100%",
};

const submittedTextStyle: React.CSSProperties = {
  color: "#6b7280",
  fontSize: "0.875rem",
};

const nextButtonStyle: React.CSSProperties = {
  padding: "0.5rem 1.5rem",
  borderRadius: "0.375rem",
  border: "none",
  backgroundColor: "#3b82f6",
  color: "white",
  cursor: "pointer",
  fontSize: "0.875rem",
  fontWeight: 500,
};

const toggleSubmitStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "#9ca3af",
  fontSize: "0.75rem",
  cursor: "pointer",
  textDecoration: "underline",
};
