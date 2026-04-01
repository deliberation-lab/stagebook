/**
 * Test wrapper for TextArea that handles function props internally.
 */
import React from "react";
import { TextArea } from "../form/TextArea.js";

export interface MockTextAreaProps {
  value?: string;
  rows?: number;
  showCharacterCount?: boolean;
  minLength?: number;
  maxLength?: number;
  defaultText?: string;
}

export function MockTextArea({
  value = "",
  rows = 5,
  showCharacterCount,
  minLength,
  maxLength,
  defaultText,
}: MockTextAreaProps) {
  const [localValue, setLocalValue] = React.useState(value);

  return (
    <TextArea
      value={localValue}
      onChange={(val) => setLocalValue(val)}
      rows={rows}
      showCharacterCount={showCharacterCount}
      minLength={minLength}
      maxLength={maxLength}
      defaultText={defaultText}
      debounceDelay={0}
    />
  );
}
