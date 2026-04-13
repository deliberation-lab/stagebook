/**
 * Test wrapper that renders a TextArea with overridden CSS variables.
 */
import React, { useState } from "react";
import { TextArea } from "../form/TextArea.js";

export interface ThemedTextAreaProps {
  value?: string;
  showCharacterCount?: boolean;
  minLength?: number;
  maxLength?: number;
  themeOverrides?: Record<string, string>;
}

export function ThemedTextArea({
  value: initialValue = "",
  showCharacterCount,
  minLength,
  maxLength,
  themeOverrides = {},
}: ThemedTextAreaProps) {
  const [value, setValue] = useState(initialValue);
  const cssText = Object.entries(themeOverrides)
    .map(([key, value]) => `${key}: ${value} !important;`)
    .join(" ");

  return (
    <>
      <style>{`:root { ${cssText} }`}</style>
      <TextArea
        value={value}
        onChange={(val) => setValue(val)}
        showCharacterCount={showCharacterCount}
        minLength={minLength}
        maxLength={maxLength}
        debounceDelay={0}
      />
    </>
  );
}
