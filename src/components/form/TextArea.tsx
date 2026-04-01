import React, { useEffect, useState, useRef, useId } from "react";

export interface TypingStats {
  type: "typingStats";
  totalKeystrokes: number;
  avgInterval: number;
  stdDev: number;
}

export interface PasteAttempt {
  type: "pasteAttempt";
  content: string;
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
  const debounceTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keystrokeTimestamps = useRef<number[]>([]);
  const isDebouncing = useRef(false);

  // Sync with external value only when not actively debouncing
  useEffect(() => {
    if (!isDebouncing.current) {
      setLocalValue(value || "");
    }
  }, [value]);

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
        content: pastedText,
        timestamp: Date.now(),
      });
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    if (maxLength && newValue.length > maxLength) return;
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
    let countColor = "var(--score-text-muted, #6b7280)"; // gray-500
    const currentLength = localValue.length;

    if (minLength && maxLength) {
      countText = `(${currentLength} / ${minLength}-${maxLength} chars)`;
      if (currentLength >= minLength && currentLength < maxLength) {
        countColor = "var(--score-success, #16a34a)"; // green-600
      } else if (currentLength === maxLength) {
        countColor = "var(--score-warning, #dc2626)"; // red-600
      }
    } else if (minLength) {
      countText = `(${currentLength} / ${minLength}+ characters required)`;
      if (currentLength >= minLength) {
        countColor = "var(--score-success, #16a34a)";
      }
    } else if (maxLength) {
      countText = `(${currentLength} / ${maxLength} chars max)`;
      if (currentLength === maxLength) {
        countColor = "var(--score-warning, #dc2626)";
      }
    } else {
      countText = `(${currentLength} characters)`;
    }

    return (
      <div
        data-testid="char-counter"
        style={{
          textAlign: "right",
          fontSize: "0.75rem",
          marginTop: "0.25rem",
          paddingRight: "0.75rem",
          color: countColor,
          boxSizing: "border-box",
          width: "100%",
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
          border: "1px solid var(--score-border, #d1d5db)",
          borderRadius: "0.375rem",
          boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
          fontSize: "0.875rem",
          lineHeight: "1.25rem",
          color: "var(--score-text, #1f2937)",
          resize: "vertical",
        }}
      />
      {renderCharacterCount()}
    </div>
  );
}
