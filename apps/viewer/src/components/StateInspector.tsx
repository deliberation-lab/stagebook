import { useState } from "react";
import { getReferenceKeyAndPath } from "stagebook";
import { ViewerStateStore } from "../lib/store";
import { extractStageReferences } from "../lib/references";
import type { ViewerStep } from "../lib/steps";

interface StateInspectorProps {
  store: ViewerStateStore;
  currentStep: ViewerStep;
  stageIndex: number;
  position: number;
  playerCount: number;
}

export function StateInspector({
  store,
  currentStep,
  stageIndex,
  position,
  playerCount,
}: StateInspectorProps) {
  const [showAll, setShowAll] = useState(false);

  const references = extractStageReferences(
    currentStep.elements as Record<string, unknown>[],
  );

  const isSubmitted = store.getSubmitted(stageIndex);

  return (
    <div style={containerStyle}>
      <div style={sectionHeaderStyle}>This stage</div>

      {/* Viewer controls */}
      <div style={controlGroupStyle}>
        <label style={controlLabelStyle}>
          <input
            type="checkbox"
            checked={isSubmitted}
            onChange={(e) => store.setSubmitted(stageIndex, e.target.checked)}
            style={checkboxStyle}
          />
          submitted
        </label>
      </div>

      {/* References relevant to this stage */}
      {references.length > 0 && (
        <>
          <div style={{ ...sectionHeaderStyle, marginTop: "1rem" }}>
            Referenced state
          </div>
          {references.map((ref) => (
            <ReferenceEditor
              key={ref}
              reference={ref}
              store={store}
              position={position}
              stageIndex={stageIndex}
            />
          ))}
        </>
      )}

      {references.length === 0 && (
        <p style={emptyStyle}>No external references on this stage.</p>
      )}

      {/* All state expansion */}
      <button onClick={() => setShowAll(!showAll)} style={expandButtonStyle}>
        {showAll ? "▾ Hide all state" : "▸ Show all state"}
      </button>

      {showAll && (
        <AllState
          store={store}
          currentStageIndex={stageIndex}
          playerCount={playerCount}
        />
      )}
    </div>
  );
}

function ReferenceEditor({
  reference,
  store,
  position,
  stageIndex,
}: {
  reference: string;
  store: ViewerStateStore;
  position: number;
  stageIndex: number;
}) {
  const values = store.resolve(reference, position);
  const currentValue = values[0] !== undefined ? String(values[0]) : "";

  const handleChange = (newValue: string) => {
    const { referenceKey, path } = getReferenceKeyAndPath(reference);

    if (path.length === 0) {
      // No nested path — store the value directly
      store.set(position, referenceKey, newValue, stageIndex);
    } else {
      // Nested path (e.g., prompt → path=["value"]) — preserve existing
      // object structure and write the value at the correct path
      const existing = store.get(position, referenceKey)?.value;
      const obj =
        existing && typeof existing === "object" && !Array.isArray(existing)
          ? { ...(existing as Record<string, unknown>) }
          : {};
      let cursor: Record<string, unknown> = obj;
      for (let i = 0; i < path.length - 1; i++) {
        const seg = path[i];
        if (typeof cursor[seg] !== "object" || cursor[seg] === null) {
          cursor[seg] = {};
        }
        cursor = cursor[seg] as Record<string, unknown>;
      }
      cursor[path[path.length - 1]] = newValue;
      store.set(position, referenceKey, obj, stageIndex);
    }
  };

  return (
    <div style={refGroupStyle}>
      <label style={refLabelStyle}>{reference}</label>
      <input
        type="text"
        value={currentValue}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="(not set)"
        style={refInputStyle}
      />
    </div>
  );
}

function AllState({
  store,
  currentStageIndex,
  playerCount,
}: {
  store: ViewerStateStore;
  currentStageIndex: number;
  playerCount: number;
}) {
  const allEntries = store.getAll();

  if (allEntries.length === 0) {
    return <p style={emptyStyle}>No state values stored yet.</p>;
  }

  return (
    <div style={allStateStyle}>
      {allEntries.map(({ positionKey, storeKey, entry }) => {
        const isFuture = entry.setOnStageIndex > currentStageIndex;
        const posLabel =
          positionKey === "shared"
            ? "shared"
            : `pos ${positionKey}${positionKey < playerCount ? "" : " (out of range)"}`;

        return (
          <div
            key={`${String(positionKey)}-${storeKey}`}
            style={{
              ...allStateItemStyle,
              opacity: isFuture ? 0.4 : 1,
            }}
          >
            <div style={allStateKeyStyle}>
              <span>{storeKey}</span>
              <span style={allStateBadgeStyle}>{posLabel}</span>
            </div>
            <div style={allStateValueStyle}>
              {typeof entry.value === "object"
                ? JSON.stringify(entry.value)
                : String(entry.value)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// --- Styles ---

const containerStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.25rem",
};

const sectionHeaderStyle: React.CSSProperties = {
  fontSize: "0.6875rem",
  fontWeight: 600,
  color: "#6b7280",
  textTransform: "uppercase" as const,
  letterSpacing: "0.05em",
  marginBottom: "0.25rem",
};

const controlGroupStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.5rem",
  fontSize: "0.8125rem",
};

const controlLabelStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.375rem",
  color: "#374151",
  fontSize: "0.8125rem",
  cursor: "pointer",
};

const checkboxStyle: React.CSSProperties = {
  cursor: "pointer",
};

const refGroupStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.125rem",
  marginBottom: "0.375rem",
};

const refLabelStyle: React.CSSProperties = {
  fontSize: "0.75rem",
  color: "#6b7280",
  fontFamily: "monospace",
};

const refInputStyle: React.CSSProperties = {
  padding: "0.25rem 0.375rem",
  border: "1px solid #d1d5db",
  borderRadius: "0.25rem",
  fontSize: "0.8125rem",
};

const emptyStyle: React.CSSProperties = {
  fontSize: "0.75rem",
  color: "#9ca3af",
  marginTop: "0.5rem",
};

const expandButtonStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "#6b7280",
  fontSize: "0.75rem",
  cursor: "pointer",
  textAlign: "left" as const,
  padding: "0.25rem 0",
  marginTop: "1rem",
};

const allStateStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.375rem",
  marginTop: "0.25rem",
};

const allStateItemStyle: React.CSSProperties = {
  padding: "0.375rem 0.5rem",
  backgroundColor: "white",
  borderRadius: "0.25rem",
  border: "1px solid #e5e7eb",
  fontSize: "0.75rem",
};

const allStateKeyStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  fontFamily: "monospace",
  color: "#374151",
};

const allStateBadgeStyle: React.CSSProperties = {
  fontSize: "0.625rem",
  color: "#9ca3af",
  backgroundColor: "#f3f4f6",
  padding: "0.0625rem 0.375rem",
  borderRadius: "0.25rem",
};

const allStateValueStyle: React.CSSProperties = {
  color: "#6b7280",
  marginTop: "0.125rem",
  wordBreak: "break-all" as const,
};
