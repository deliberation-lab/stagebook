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
    let colorClass = "text-gray-500";
    const currentLength = localValue.length;

    if (minLength && maxLength) {
      countText = `(${currentLength} / ${minLength}-${maxLength} chars)`;
      if (currentLength >= minLength && currentLength < maxLength) {
        colorClass = "text-green-600";
      } else if (currentLength === maxLength) {
        colorClass = "text-red-600";
      }
    } else if (minLength) {
      countText = `(${currentLength} / ${minLength}+ characters required)`;
      if (currentLength >= minLength) {
        colorClass = "text-green-600";
      }
    } else if (maxLength) {
      countText = `(${currentLength} / ${maxLength} chars max)`;
      if (currentLength === maxLength) {
        colorClass = "text-red-600";
      }
    } else {
      countText = `(${currentLength} characters)`;
    }

    return (
      <div className={`text-right text-sm mt-1 ${colorClass}`}>{countText}</div>
    );
  };

  return (
    <div className="relative">
      <textarea
        className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
        id={textAreaId}
        autoComplete="off"
        rows={rows}
        placeholder={defaultText}
        value={localValue}
        onChange={handleChange}
        onBlur={handleBlur}
        onPaste={handlePaste}
        onKeyDown={handleKeyDown}
      />
      {renderCharacterCount()}
    </div>
  );
}
