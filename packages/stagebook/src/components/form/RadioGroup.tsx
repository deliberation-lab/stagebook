import React, { useState } from "react";

export interface RadioOption {
  key: string;
  value: string;
}

export type RadioLayout = "vertical" | "horizontal";

export interface RadioGroupProps {
  options: RadioOption[];
  value?: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  label?: string;
  layout?: RadioLayout;
  id?: string;
  "data-testid"?: string;
}

// Radio input styling is applied inline so <input type="radio"> elements
// render consistently on any host — including Tailwind-preflight hosts
// where `appearance: none` strips the native OS chrome and leaves an
// empty circle that ignores --stagebook-primary. See issue #213.

const radioBaseStyle: React.CSSProperties = {
  appearance: "none",
  WebkitAppearance: "none",
  width: "1rem",
  height: "1rem",
  border: "1px solid var(--stagebook-border, #d1d5db)",
  borderRadius: "9999px",
  backgroundColor: "var(--stagebook-surface, #fff)",
  backgroundSize: "100% 100%",
  backgroundPosition: "center",
  backgroundRepeat: "no-repeat",
  verticalAlign: "middle",
  cursor: "pointer",
  margin: 0,
};

// Inner dot (white) drawn via SVG data URI so no font / icon-set
// dependency is needed on the host.
const RADIO_DOT_SVG =
  "url(\"data:image/svg+xml,%3csvg viewBox='0 0 16 16' fill='white' xmlns='http://www.w3.org/2000/svg'%3e%3ccircle cx='8' cy='8' r='3'/%3e%3c/svg%3e\")";

const radioCheckedStyle: React.CSSProperties = {
  backgroundColor: "var(--stagebook-primary, #3b82f6)",
  borderColor: "var(--stagebook-primary, #3b82f6)",
  backgroundImage: RADIO_DOT_SVG,
};

const radioFocusStyle: React.CSSProperties = {
  outline: "none",
  boxShadow: "0 0 0 2px var(--stagebook-focus-ring, rgba(59, 130, 246, 0.25))",
};

export function RadioGroup({
  options,
  value,
  onChange,
  label = "",
  layout = "vertical",
  id = "radioGroup",
  "data-testid": dataTestId,
}: RadioGroupProps) {
  // Only one radio can hold keyboard focus at a time, so a single
  // focused-key on the group suffices. Avoids per-input child components.
  const [focusedKey, setFocusedKey] = useState<string | null>(null);

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
          const checked = value === key;
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
                type="radio"
                // Shared `name` so the browser treats these as one radio
                // group (arrow-key navigation between options + AT
                // grouping semantics). Scoped to `id` so multiple
                // RadioGroup instances on the same page don't collide.
                name={id}
                value={key}
                checked={checked}
                onChange={onChange}
                onFocus={() => setFocusedKey(key)}
                onBlur={() =>
                  setFocusedKey((prev) => (prev === key ? null : prev))
                }
                style={{
                  ...radioBaseStyle,
                  ...(checked ? radioCheckedStyle : {}),
                  ...(focusedKey === key ? radioFocusStyle : {}),
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
