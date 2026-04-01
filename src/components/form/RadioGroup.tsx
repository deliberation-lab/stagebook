import React from "react";

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
}

export function RadioGroup({
  options,
  value,
  onChange,
  label = "",
  layout = "vertical",
  id = "radioGroup",
}: RadioGroupProps) {
  return (
    <div style={{ marginTop: "1rem" }}>
      {label && (
        <label
          htmlFor={id}
          style={{
            display: "block",
            fontSize: "1rem",
            fontWeight: 500,
            color: "var(--score-text, #1f2937)",
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
        {options.map(({ key, value: optionValue }) => (
          <label
            key={`${id}_${key}`}
            style={{
              fontWeight: 400,
              fontSize: "0.875rem",
              color: "var(--score-text-muted, #6b7280)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <input
              type="radio"
              value={key}
              checked={value === key}
              onChange={onChange}
            />
            {optionValue}
          </label>
        ))}
      </div>
    </div>
  );
}
