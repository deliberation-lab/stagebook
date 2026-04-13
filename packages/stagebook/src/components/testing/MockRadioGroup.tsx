import React, { useState } from "react";
import { RadioGroup } from "../form/RadioGroup.js";

export interface MockRadioGroupProps {
  options: Array<{ key: string; value: string }>;
  initialValue?: string;
  layout?: "vertical" | "horizontal";
}

export function MockRadioGroup({
  options,
  initialValue,
  layout,
}: MockRadioGroupProps) {
  const [value, setValue] = useState(initialValue);

  return (
    <div>
      <RadioGroup
        options={options}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        layout={layout}
      />
      <div data-testid="selected-value" style={{ display: "none" }}>
        {value ?? ""}
      </div>
    </div>
  );
}
