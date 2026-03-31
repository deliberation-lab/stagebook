import React from "react";

export interface RadioOption {
  key: string;
  value: string;
}

export interface RadioGroupProps {
  options: RadioOption[];
  value?: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  label?: string;
  id?: string;
}

export function RadioGroup({
  options,
  value,
  onChange,
  label = "",
  id = "radioGroup",
}: RadioGroupProps) {
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
            className="font-normal text-sm text-gray-500 max-w-xl"
            key={`${id}_${key}`}
          >
            <input
              className="mr-2 shadow-sm"
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
