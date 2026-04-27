import { useState } from "react";
import { getReferenceKeyAndPath, getNestedValueByPath } from "stagebook";
import { Markdown } from "stagebook/components";
import { ViewerStateStore } from "../lib/store";
import { extractStageReferences } from "../lib/references";
import type { ViewerStep } from "../lib/steps";

/**
 * DOM id used to scroll a specific element's note into view. Encodes the
 * type and name so characters like spaces (which nameSchema permits in
 * some contexts) don't produce invalid HTML ids.
 */
export function noteAnchorId(
  elementType: string,
  elementName?: string,
): string {
  const type = encodeURIComponent(elementType);
  const name =
    elementName === undefined ? "" : `-${encodeURIComponent(elementName)}`;
  return `note-${type}${name}`;
}

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

      {/* Researcher notes (never shown to participants) */}
      <NotesSection currentStep={currentStep} />

      {/* All state expansion + clear */}
      <div style={allStateActionsStyle}>
        <button onClick={() => setShowAll(!showAll)} style={expandButtonStyle}>
          {showAll ? "▾ Hide all state" : "▸ Show all state"}
        </button>
        <button
          type="button"
          onClick={() => {
            if (
              window.confirm(
                "Clear all stored state (responses, submitted flags, elapsed time)?",
              )
            ) {
              store.clearAll();
            }
          }}
          style={clearAllButtonStyle}
          title="Wipe all stored state in the viewer"
        >
          Clear all state
        </button>
      </div>

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

interface ElementNote {
  type: string;
  name?: string;
  notes: string;
}

function NotesSection({ currentStep }: { currentStep: ViewerStep }) {
  const stageNote = currentStep.notes;
  const elementNotes: ElementNote[] = [];
  for (const el of currentStep.elements) {
    const e = el as { type: string; name?: string; notes?: string };
    if (e.notes) {
      elementNotes.push({ type: e.type, name: e.name, notes: e.notes });
    }
  }

  if (!stageNote && elementNotes.length === 0) return null;

  return (
    <>
      <div style={{ ...sectionHeaderStyle, marginTop: "1rem" }}>Notes</div>
      <div style={notesStackStyle}>
        {stageNote && (
          <div style={noteItemStyle}>
            <div style={noteLabelStyle}>Stage: {currentStep.name}</div>
            <div style={noteBodyStyle}>
              <Markdown text={stageNote} />
            </div>
          </div>
        )}
        {elementNotes.map((n, i) => (
          <div
            id={noteAnchorId(n.type, n.name)}
            key={`${n.type}-${n.name ?? "anon"}-${i}`}
            style={noteItemStyle}
          >
            <div style={noteLabelStyle}>
              Element: {n.name ?? "(unnamed)"}{" "}
              <span style={noteTypeStyle}>({n.type})</span>
            </div>
            <div style={noteBodyStyle}>
              <Markdown text={n.notes} />
            </div>
          </div>
        ))}
      </div>
    </>
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
  let referenceKey: string;
  let path: string[];
  try {
    ({ referenceKey, path } = getReferenceKeyAndPath(reference));
  } catch {
    return (
      <div style={refGroupStyle}>
        <label style={refLabelStyle}>{reference}</label>
        <input
          type="text"
          value=""
          disabled
          placeholder="(invalid reference)"
          style={{ ...refInputStyle, opacity: 0.5 }}
        />
      </div>
    );
  }

  const rawValues = store.lookup(referenceKey, position);
  const values = rawValues
    .map((v) => getNestedValueByPath(v, path))
    .filter((v) => v !== undefined);
  const currentValue = values[0] !== undefined ? String(values[0]) : "";
  const isSet = values.length > 0;

  const handleChange = (newValue: string) => {
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

  const handleClear = () => {
    if (path.length === 0) {
      store.delete(position, referenceKey);
      return;
    }
    const existing = store.get(position, referenceKey)?.value;
    if (!existing || typeof existing !== "object" || Array.isArray(existing)) {
      // Nothing to prune at this path — drop the whole entry so `exists` fails
      store.delete(position, referenceKey);
      return;
    }
    const root = deletePath(existing as Record<string, unknown>, path);
    if (root === undefined) {
      store.delete(position, referenceKey);
    } else {
      store.set(position, referenceKey, root, stageIndex);
    }
  };

  return (
    <div style={refGroupStyle}>
      <label style={refLabelStyle}>{reference}</label>
      <div style={refInputRowStyle}>
        <input
          type="text"
          value={currentValue}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="(not set)"
          style={refInputStyle}
        />
        <button
          type="button"
          onClick={handleClear}
          disabled={!isSet}
          aria-label={`Clear ${reference}`}
          title={
            isSet
              ? "Remove this value entirely (so exists checks fail)"
              : "Not set"
          }
          style={isSet ? refClearButtonStyle : refClearButtonDisabledStyle}
        >
          ×
        </button>
      </div>
    </div>
  );
}

/**
 * Returns a new object with the leaf at `path` removed, pruning any
 * parent objects that become empty as a result. Returns `undefined` if
 * the entire root would become empty (signal to delete the entry).
 */
function deletePath(
  obj: Record<string, unknown>,
  path: string[],
): Record<string, unknown> | undefined {
  if (path.length === 0) return undefined;
  const [head, ...rest] = path;
  if (!(head in obj)) return obj;
  const next = { ...obj };
  if (rest.length === 0) {
    delete next[head];
  } else {
    const child = next[head];
    if (child && typeof child === "object" && !Array.isArray(child)) {
      const pruned = deletePath(child as Record<string, unknown>, rest);
      if (pruned === undefined) {
        delete next[head];
      } else {
        next[head] = pruned;
      }
    } else {
      // Path goes through a non-object — nothing to prune, leave as-is
      return obj;
    }
  }
  return Object.keys(next).length === 0 ? undefined : next;
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

const refInputRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "stretch",
  gap: "0.25rem",
};

const refInputStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  padding: "0.25rem 0.375rem",
  border: "1px solid #d1d5db",
  borderRadius: "0.25rem",
  fontSize: "0.8125rem",
};

const refClearButtonStyle: React.CSSProperties = {
  padding: "0 0.5rem",
  border: "1px solid #d1d5db",
  borderRadius: "0.25rem",
  background: "white",
  color: "#6b7280",
  fontSize: "1rem",
  lineHeight: 1,
  cursor: "pointer",
};

const refClearButtonDisabledStyle: React.CSSProperties = {
  ...{
    padding: "0 0.5rem",
    border: "1px solid #e5e7eb",
    borderRadius: "0.25rem",
    background: "#f9fafb",
    color: "#d1d5db",
    fontSize: "1rem",
    lineHeight: 1,
  },
  cursor: "not-allowed",
};

const emptyStyle: React.CSSProperties = {
  fontSize: "0.75rem",
  color: "#9ca3af",
  marginTop: "0.5rem",
};

const allStateActionsStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "0.5rem",
  marginTop: "1rem",
};

const expandButtonStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "#6b7280",
  fontSize: "0.75rem",
  cursor: "pointer",
  textAlign: "left" as const,
  padding: "0.25rem 0",
};

const clearAllButtonStyle: React.CSSProperties = {
  background: "none",
  border: "1px solid #e5e7eb",
  borderRadius: "0.25rem",
  color: "#b91c1c",
  fontSize: "0.75rem",
  cursor: "pointer",
  padding: "0.25rem 0.5rem",
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

const notesStackStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.5rem",
  marginTop: "0.25rem",
};

const noteItemStyle: React.CSSProperties = {
  padding: "0.5rem 0.625rem",
  backgroundColor: "#fffbeb",
  border: "1px solid #fde68a",
  borderRadius: "0.375rem",
  fontSize: "0.75rem",
  color: "#374151",
  scrollMarginTop: "1rem",
  transition: "background-color 300ms ease-out",
};

const noteLabelStyle: React.CSSProperties = {
  fontSize: "0.6875rem",
  fontWeight: 600,
  color: "#92400e",
  marginBottom: "0.25rem",
};

const noteTypeStyle: React.CSSProperties = {
  fontWeight: 400,
  color: "#b45309",
  fontFamily: "monospace",
};

const noteBodyStyle: React.CSSProperties = {
  color: "#374151",
  lineHeight: 1.45,
};
