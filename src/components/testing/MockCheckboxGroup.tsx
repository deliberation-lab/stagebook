import React, { useState } from "react";
import { CheckboxGroup } from "../form/CheckboxGroup.js";

export interface MockCheckboxGroupProps {
  options: Array<{ key: string; value: string }>;
  initialValue?: string[];
}

export function MockCheckboxGroup({
  options,
  initialValue = [],
}: MockCheckboxGroupProps) {
  const [value, setValue] = useState(initialValue);

  return (
    <div>
      <CheckboxGroup options={options} value={value} onChange={setValue} />
      <div data-testid="selected-values" style={{ display: "none" }}>
        {value.join("|")}
      </div>
    </div>
  );
}
