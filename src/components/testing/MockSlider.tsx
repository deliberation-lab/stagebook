import React, { useState } from "react";
import { Slider } from "../form/Slider.js";

export interface MockSliderProps {
  min?: number;
  max?: number;
  interval?: number;
  labelPts?: number[];
  labels?: string[];
  initialValue?: number;
}

export function MockSlider({
  min = 0,
  max = 100,
  interval = 1,
  labelPts = [],
  labels = [],
  initialValue,
}: MockSliderProps) {
  const [value, setValue] = useState<number | undefined>(initialValue);

  return (
    <div>
      <Slider
        min={min}
        max={max}
        interval={interval}
        labelPts={labelPts}
        labels={labels}
        value={value}
        onChange={setValue}
      />
      <div data-testid="slider-value" style={{ display: "none" }}>
        {value !== undefined ? String(value) : "undefined"}
      </div>
    </div>
  );
}
