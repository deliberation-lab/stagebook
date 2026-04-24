import React, { useState } from "react";

export interface CheckboxOption {
  key: string;
  value: string;
}

export type CheckboxLayout = "vertical" | "horizontal";

export interface CheckboxGroupProps {
  options: CheckboxOption[];
  value: string[];
  onChange: (selected: string[]) => void;
  label?: string;
  layout?: CheckboxLayout;
  id?: string;
  "data-testid"?: string;
}

// Checkbox input styling is applied inline so <input type="checkbox">
// elements render consistently on any host — including Tailwind-preflight
// hosts where `appearance: none` strips the native OS chrome and leaves
// an empty box that ignores --stagebook-primary. See issue #213.

const checkboxBaseStyle: React.CSSProperties = {
  appearance: "none",
  WebkitAppearance: "none",
  width: "1rem",
  height: "1rem",
  border: "1px solid var(--stagebook-border, #d1d5db)",
  borderRadius: "0.125rem",
  backgroundColor: "var(--stagebook-surface, #fff)",
  backgroundSize: "100% 100%",
  backgroundPosition: "center",
  backgroundRepeat: "no-repeat",
  verticalAlign: "middle",
  cursor: "pointer",
  margin: 0,
};

// White check mark drawn via SVG data URI so no font / icon-set
// dependency is needed on the host.
const CHECKBOX_CHECK_SVG =
  "url(\"data:image/svg+xml,%3csvg viewBox='0 0 16 16' fill='white' xmlns='http://www.w3.org/2000/svg'%3e%3cpath d='M12.207 4.793a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0l-2-2a1 1 0 011.414-1.414L6.5 9.086l4.293-4.293a1 1 0 011.414 0z'/%3e%3c/svg%3e\")";

const checkboxCheckedStyle: React.CSSProperties = {
  backgroundColor: "var(--stagebook-primary, #3b82f6)",
  borderColor: "var(--stagebook-primary, #3b82f6)",
  backgroundImage: CHECKBOX_CHECK_SVG,
};

const checkboxFocusStyle: React.CSSProperties = {
  outline: "none",
  boxShadow: "0 0 0 2px var(--stagebook-focus-ring, rgba(59, 130, 246, 0.25))",
};

export function CheckboxGroup({
  options,
  value = [],
  onChange,
  label = "",
  layout = "vertical",
  id = "checkboxGroup",
  "data-testid": dataTestId,
}: CheckboxGroupProps) {
  // Only one input can hold keyboard focus at a time, so a single
  // focused-key on the group suffices. Avoids per-input child components.
  const [focusedKey, setFocusedKey] = useState<string | null>(null);

  const handleToggle = (key: string) => {
    const selectedSet = new Set(value);
    if (selectedSet.has(key)) {
      selectedSet.delete(key);
    } else {
      selectedSet.add(key);
    }
    onChange(Array.from(selectedSet));
  };

  return (
    <div data-testid={dataTestId ?? id} style={{ marginTop: "1rem" }}>
      {label && (
        <label
          htmlFor={id}
          style={{
            display: "block",
            fontSize: "1rem",
            fontWeight: 500,
            color: "var(--stagebook-text, #1f2937)",
            marginBottom: "0.5rem",
          }}
        >
          {label}
        </label>
      )}
      <div
        style={{
          marginLeft: "1.25rem",
          display: layout === "horizontal" ? "flex" : "grid",
          gap: layout === "horizontal" ? "1rem" : "0.375rem",
          flexWrap: layout === "horizontal" ? "wrap" : undefined,
        }}
      >
        {options.map(({ key, value: optionValue }) => {
          const checked = value.includes(key);
          return (
            <label
              key={`${id}_${key}`}
              data-testid="option"
              style={{
                fontWeight: 400,
                fontSize: "0.875rem",
                color: "var(--stagebook-text-muted, #6b7280)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              <input
                type="checkbox"
                name={key}
                value={key}
                id={`${id}_${key}`}
                checked={checked}
                onChange={() => handleToggle(key)}
                onFocus={() => setFocusedKey(key)}
                onBlur={() =>
                  setFocusedKey((prev) => (prev === key ? null : prev))
                }
                style={{
                  ...checkboxBaseStyle,
                  ...(checked ? checkboxCheckedStyle : {}),
                  ...(focusedKey === key ? checkboxFocusStyle : {}),
                }}
              />
              {optionValue}
            </label>
          );
        })}
      </div>
    </div>
  );
}
