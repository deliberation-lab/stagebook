import React from "react";

export interface CheckboxOption {
  key: string;
  value: string;
}

export interface CheckboxGroupProps {
  options: CheckboxOption[];
  value: string[];
  onChange: (selected: string[]) => void;
  label?: string;
  id?: string;
}

export function CheckboxGroup({
  options,
  value = [],
  onChange,
  label = "",
  id = "checkboxGroup",
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
    <div className="mt-4">
      {label && (
        <label
          htmlFor={id}
          className="block text-md font-medium text-gray-800 my-2"
        >
          {label}
        </label>
      )}
      <div className="ml-5 grid gap-1.5">
        {options.map(({ key, value: optionValue }) => (
          <label
            className="font-normal text-sm text-gray-500"
            key={`${id}_${key}`}
          >
            <input
              className="mr-2 shadow-sm"
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
