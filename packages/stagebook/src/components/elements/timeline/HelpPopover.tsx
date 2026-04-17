import React, { useEffect, useRef } from "react";

export interface HelpPopoverProps {
  selectionType: "range" | "point";
  onClose: () => void;
}

const rangeShortcuts: { keys: string; description: string }[] = [
  { keys: "Click empty space", description: "Seek playhead" },
  { keys: "Click and drag", description: "Create range" },
  { keys: "Click range", description: "Select it" },
  { keys: "Drag handle", description: "Adjust boundary" },
  { keys: "←  →", description: "Adjust handle ±1s" },
  { keys: ", .", description: "Adjust ±1 frame" },
  { keys: "Tab", description: "Switch handle" },
  { keys: "Delete", description: "Remove range" },
  { keys: "Ctrl+Z / Cmd+Z", description: "Undo" },
  { keys: "Escape", description: "Deselect" },
];

const pointShortcuts: { keys: string; description: string }[] = [
  { keys: "Click empty space", description: "Place point" },
  { keys: "Click point", description: "Select it" },
  { keys: "Drag point", description: "Reposition" },
  { keys: "←  →", description: "Reposition ±1s" },
  { keys: ", .", description: "Reposition ±1 frame" },
  { keys: "Delete", description: "Remove point" },
  { keys: "Ctrl+Z / Cmd+Z", description: "Undo" },
  { keys: "Escape", description: "Deselect" },
];

export function HelpPopover({ selectionType, onClose }: HelpPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const shortcuts = selectionType === "range" ? rangeShortcuts : pointShortcuts;

  // Close on Escape and click-outside
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    }
    function onClick(e: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    }
    document.addEventListener("keydown", onKey, true);
    // Use capture so we run before other listeners; mousedown so we close
    // before any click handler on outside elements fires.
    document.addEventListener("mousedown", onClick, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("mousedown", onClick, true);
    };
  }, [onClose]);

  return (
    <div
      ref={popoverRef}
      data-testid="timeline-help-popover"
      role="dialog"
      aria-label="Timeline keyboard shortcuts"
      style={{
        position: "absolute",
        right: "0.5rem",
        bottom: "2rem",
        zIndex: 100,
        background: "var(--stagebook-bg, #ffffff)",
        border: "1px solid var(--stagebook-border, #e5e7eb)",
        borderRadius: "0.375rem",
        padding: "0.5rem 0.75rem",
        fontSize: "0.75rem",
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.12)",
        minWidth: "220px",
      }}
    >
      <div
        style={{
          fontWeight: 600,
          marginBottom: "0.375rem",
          color: "var(--stagebook-text, #111827)",
        }}
      >
        Keyboard shortcuts
      </div>
      <table
        style={{
          borderCollapse: "collapse",
          width: "100%",
        }}
      >
        <tbody>
          {shortcuts.map((s) => (
            <tr key={s.keys}>
              <td
                style={{
                  paddingRight: "0.75rem",
                  fontFamily: "monospace",
                  color: "var(--stagebook-text, #111827)",
                  whiteSpace: "nowrap",
                  verticalAlign: "top",
                }}
              >
                {s.keys}
              </td>
              <td
                style={{
                  color: "var(--stagebook-text-muted, #6b7280)",
                  verticalAlign: "top",
                }}
              >
                {s.description}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
