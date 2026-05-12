import React, { useEffect, useState, useRef, useId } from "react";

export interface TypingStats {
  type: "typingStats";
  totalKeystrokes: number;
  avgInterval: number;
  stdDev: number;
}

export interface PasteAttempt {
  type: "pasteAttempt";
  length: number;
  timestamp: number;
}

export type DebugMessage = TypingStats | PasteAttempt;

export interface TextAreaProps {
  defaultText?: string;
  onChange?: (value: string) => void;
  onDebugMessage?: (message: DebugMessage) => void;
  value?: string;
  rows?: number;
  showCharacterCount?: boolean;
  minLength?: number;
  maxLength?: number;
  debounceDelay?: number;
  id?: string;
}

export function TextArea({
  defaultText,
  onChange,
  onDebugMessage,
  value,
  rows = 5,
  showCharacterCount,
  minLength,
  maxLength,
  debounceDelay = 500,
  id,
}: TextAreaProps) {
  const generatedId = useId();
  const textAreaId = id || generatedId;
  const [localValue, setLocalValue] = useState(value || "");
  // Transient flag set when a keystroke is rejected for exceeding maxLength;
  // drives the brief red pulse animation on the character counter. The
  // steady-state color stays valid-green when length === maxLength (#333).
  const [isOverflowing, setIsOverflowing] = useState(false);
  // Bumped on each rejected overflow keystroke. Used as the React `key`
  // on the counter element so that rapid repeat overflows reliably restart
  // the pulse animation — without this, a second overflow within 300ms
  // would not retrigger the keyframe (the animation prop string is
  // unchanged, so the browser doesn't restart).
  const [overflowPulseId, setOverflowPulseId] = useState(0);
  const debounceTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const overflowTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keystrokeTimestamps = useRef<number[]>([]);
  const isDebouncing = useRef(false);

  // Sync with external value only when not actively debouncing
  useEffect(() => {
    if (!isDebouncing.current) {
      setLocalValue(value || "");
    }
  }, [value]);

  // Clear the overflow timeout on unmount — without this, a stage/page
  // change within the 300ms window would fire setIsOverflowing(false) on
  // an unmounted component (silent in React 18+ but still a leak).
  useEffect(() => {
    return () => {
      if (overflowTimeout.current) clearTimeout(overflowTimeout.current);
    };
  }, []);

  const submitChange = (val: string) => {
    if (onChange && typeof onChange === "function") {
      onChange(val);
    }
  };

  const debouncedSubmit = (val: string) => {
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }
    isDebouncing.current = true;
    debounceTimeout.current = setTimeout(() => {
      isDebouncing.current = false;
      submitChange(val);
    }, debounceDelay);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData("text");
    if (onDebugMessage) {
      onDebugMessage({
        type: "pasteAttempt",
        length: pastedText.length,
        timestamp: Date.now(),
      });
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    if (maxLength && newValue.length > maxLength) {
      // Keystroke would overflow — reject it and pulse the counter red
      // briefly. Distinguishes "you tried to overflow" (transient, this
      // animation) from "you're at the limit" (steady valid state).
      if (overflowTimeout.current) clearTimeout(overflowTimeout.current);
      setIsOverflowing(true);
      setOverflowPulseId((p) => p + 1);
      overflowTimeout.current = setTimeout(() => {
        setIsOverflowing(false);
      }, 300);
      return;
    }
    setLocalValue(newValue);
    debouncedSubmit(newValue);
  };

  const computeTypingStats = (): TypingStats | null => {
    const timestamps = keystrokeTimestamps.current;
    if (timestamps.length < 2) return null;

    const intervals = timestamps.slice(1).map((t, i) => t - timestamps[i]);
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const stdDev = Math.sqrt(
      intervals.map((x) => (x - avgInterval) ** 2).reduce((a, b) => a + b, 0) /
        intervals.length,
    );

    return {
      type: "typingStats",
      totalKeystrokes: timestamps.length,
      avgInterval,
      stdDev,
    };
  };

  const handleBlur = () => {
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
      isDebouncing.current = false;
    }
    submitChange(localValue);
    const typingStats = computeTypingStats();
    if (typingStats && onDebugMessage) {
      onDebugMessage(typingStats);
    }
  };

  const handleKeyDown = () => {
    keystrokeTimestamps.current.push(Date.now());
  };

  const renderCharacterCount = () => {
    if (!showCharacterCount) return null;

    let countText = "";
    let countColor = "var(--stagebook-text-muted, #6b7280)";
    let countState = "default";
    const currentLength = localValue.length;

    if (minLength && maxLength) {
      countText = `(${currentLength} / ${minLength}-${maxLength} characters)`;
      // The valid range is [minLength, maxLength] inclusive on both ends.
      // Hitting maxLength is "you're at the upper limit" — a fact, not an
      // error. Attempts to type past it pulse red via isOverflowing (#333).
      if (currentLength >= minLength && currentLength <= maxLength) {
        countColor = "var(--stagebook-success, #16a34a)";
        countState = "valid";
      }
    } else if (minLength) {
      countText = `(${currentLength} / ${minLength}+ characters required)`;
      if (currentLength >= minLength) {
        countColor = "var(--stagebook-success, #16a34a)";
        countState = "valid";
      }
    } else if (maxLength) {
      countText = `(${currentLength} / ${maxLength} characters max)`;
    } else {
      countText = `(${currentLength} characters)`;
    }

    // Pulse animation takes priority over the steady-state color — when the
    // participant tries to type past maxLength, the counter flashes red for
    // 300ms regardless of the underlying valid state.
    const animationStyle = isOverflowing
      ? { animation: "stagebook-char-counter-pulse 300ms ease-out" }
      : {};
    const overflowState = isOverflowing ? "overflow" : countState;

    return (
      <div
        key={isOverflowing ? `pulse-${overflowPulseId}` : "steady"}
        data-testid="char-counter"
        data-state={overflowState}
        style={{
          textAlign: "right",
          fontSize: "0.75rem",
          marginTop: "0.25rem",
          paddingRight: "0.75rem",
          color: countColor,
          boxSizing: "border-box",
          width: "100%",
          ...animationStyle,
        }}
      >
        {countText}
      </div>
    );
  };

  return (
    <div
      style={{ position: "relative", width: "100%", boxSizing: "border-box" }}
    >
      <textarea
        id={textAreaId}
        autoComplete="off"
        rows={rows}
        placeholder={defaultText}
        value={localValue}
        onChange={handleChange}
        onBlur={handleBlur}
        onPaste={handlePaste}
        onKeyDown={handleKeyDown}
        style={{
          display: "block",
          width: "100%",
          boxSizing: "border-box",
          padding: "0.5rem 0.75rem",
          border: "1px solid var(--stagebook-border, #d1d5db)",
          borderRadius: "0.375rem",
          boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
          fontSize: "0.875rem",
          lineHeight: "1.25rem",
          color: "var(--stagebook-text, #1f2937)",
          resize: "vertical",
        }}
      />
      {renderCharacterCount()}
      <style>{`
        /* Animate a box-shadow glow instead of the text color, so the
           steady-state countColor (gray/green) is preserved throughout
           the pulse — animating color back to "inherit" produced a brief
           flash to the parent color before snapping back to countColor at
           animation end. The warning color is referenced via the same
           --stagebook-warning token used by host theming, so a themed
           orange (etc.) propagates through the pulse. */
        @keyframes stagebook-char-counter-pulse {
          0% {
            box-shadow: 0 0 0 0 var(--stagebook-warning, #dc2626);
          }
          30% {
            box-shadow: 0 0 0 4px var(--stagebook-warning, #dc2626);
          }
          100% {
            box-shadow: 0 0 0 0 var(--stagebook-warning, #dc2626);
          }
        }
      `}</style>
    </div>
  );
}
