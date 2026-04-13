import React from "react";

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

export function CheckboxGroup({
  options,
  value = [],
  onChange,
  label = "",
  layout = "vertical",
  id = "checkboxGroup",
  "data-testid": dataTestId,
}: CheckboxGroupProps) {
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
        {options.map(({ key, value: optionValue }) => (
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
              checked={value.includes(key)}
              onChange={() => handleToggle(key)}
            />
            {optionValue}
          </label>
        ))}
      </div>
    </div>
  );
}
