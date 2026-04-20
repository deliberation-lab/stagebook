import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export interface HelpPopoverProps {
  selectionType: "range" | "point";
  onClose: () => void;
  buttonRef: React.RefObject<HTMLButtonElement | null>;
}

const rangeShortcuts: { keys: string; description: string }[] = [
  { keys: "Space", description: "Play / Pause" },
  { keys: "Click empty space", description: "Seek playhead" },
  { keys: "←  → (no selection)", description: "Scrub playhead ±1s" },
  { keys: ", . (no selection)", description: "Scrub ±1 frame" },
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
  { keys: "Space", description: "Play / Pause" },
  { keys: "Click empty space", description: "Place point" },
  { keys: "←  → (no selection)", description: "Scrub playhead ±1s" },
  { keys: ", . (no selection)", description: "Scrub ±1 frame" },
  { keys: "Click point", description: "Select it" },
  { keys: "Drag point", description: "Reposition" },
  { keys: "←  →", description: "Reposition ±1s" },
  { keys: ", .", description: "Reposition ±1 frame" },
  { keys: "Delete", description: "Remove point" },
  { keys: "Ctrl+Z / Cmd+Z", description: "Undo" },
  { keys: "Escape", description: "Deselect" },
];

export function HelpPopover({
  selectionType,
  onClose,
  buttonRef,
}: HelpPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const shortcuts = selectionType === "range" ? rangeShortcuts : pointShortcuts;

  // Track button position for fixed positioning
  const [position, setPosition] = useState<{ top: number; right: number }>({
    top: 0,
    right: 0,
  });

  // Compute position from the button's bounding rect on mount and on scroll/resize
  useEffect(() => {
    function updatePosition() {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      const popoverHeight =
        popoverRef.current?.getBoundingClientRect().height ?? 0;
      setPosition({
        top: rect.top - popoverHeight - 4,
        right: window.innerWidth - rect.right,
      });
    }
    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [buttonRef]);

  // Ref `onClose` so the listener effect doesn't re-register document
  // listeners when the parent passes a fresh callback identity (#105).
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Close on Escape and click-outside
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCloseRef.current();
      }
    }
    function onClick(e: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        onCloseRef.current();
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
  }, [buttonRef]);

  const popoverContent = (
    <div
      ref={popoverRef}
      data-testid="timeline-help-popover"
      role="dialog"
      aria-label="Timeline keyboard shortcuts"
      style={{
        position: "fixed",
        top: `${String(position.top)}px`,
        right: `${String(position.right)}px`,
        zIndex: 1000,
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

  return createPortal(popoverContent, document.body);
}
