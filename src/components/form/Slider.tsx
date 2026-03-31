import React, { useState, useEffect } from "react";

export interface SliderProps {
  min?: number;
  max?: number;
  interval?: number;
  labelPts?: number[];
  labels?: string[];
  value?: number;
  onChange?: (value: number) => void;
}

export function Slider({
  min = 0,
  max = 100,
  interval = 1,
  labelPts = [],
  labels = [],
  value,
  onChange,
}: SliderProps) {
  const [localValue, setLocalValue] = useState<number | undefined>(value);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseFloat(e.target.value);
    setLocalValue(newValue);
    onChange?.(newValue);
  };

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Only set value on click if no value is set yet (avoids anchoring)
    if (localValue !== undefined && localValue !== null) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const rawValue = min + percentage * (max - min);
    const newValue = Math.round(rawValue / interval) * interval;
    const clampedValue = Math.max(min, Math.min(max, newValue));
    setLocalValue(clampedValue);
    onChange?.(clampedValue);
  };

  const getPosition = (pt: number) => ((pt - min) / (max - min)) * 100;

  const hasValue = localValue !== undefined && localValue !== null;

  return (
    <div className="mt-4 w-full">
      <div className="relative w-full pt-2 pb-8">
        {/* Clickable track — no thumb until first interaction */}
        <div
          className="relative w-full h-2 bg-gray-200 rounded cursor-pointer hover:bg-gray-300"
          onClick={handleClick}
          role="presentation"
        >
          {labelPts.map((pt) => (
            <div
              key={`tick-${pt}`}
              className="absolute top-0 w-0.5 bg-gray-400"
              style={{ left: `${getPosition(pt)}%`, height: "12px" }}
            />
          ))}
        </div>

        {/* Instruction when no value set — avoids anchoring */}
        {!hasValue && (
          <div
            className="absolute text-xs text-gray-500 text-center whitespace-nowrap"
            style={{
              left: "50%",
              transform: "translateX(-50%) translateY(-150%)",
            }}
          >
            Click the bar to select a value, then drag to adjust.
          </div>
        )}

        {/* Range input — only rendered after first interaction */}
        {hasValue && (
          <input
            type="range"
            min={min}
            max={max}
            step={interval}
            value={localValue}
            onChange={handleChange}
            className="absolute top-2 left-0 w-full h-2 appearance-none bg-transparent cursor-pointer"
            style={{
              WebkitAppearance: "none",
              MozAppearance: "none",
            }}
            aria-label="Slider"
            aria-valuemin={min}
            aria-valuemax={max}
            aria-valuenow={localValue}
          />
        )}

        {/* Labels */}
        <div className="relative w-full mt-2">
          {labelPts.map((pt, idx) => (
            <div
              key={`label-${pt}`}
              className="absolute text-xs text-gray-600 text-center"
              style={{
                left: `${getPosition(pt)}%`,
                transform: "translateX(-50%)",
                maxWidth: "80px",
              }}
            >
              {labels[idx]}
            </div>
          ))}
        </div>
      </div>

      <style>{`
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 20px;
          height: 24px;
          background: #3b82f6;
          border-radius: 50%;
          cursor: pointer;
          border: 2px solid white;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
          margin-top: -11px;
        }
        input[type="range"]::-moz-range-thumb {
          width: 20px;
          height: 24px;
          background: #3b82f6;
          border-radius: 50%;
          cursor: pointer;
          border: 2px solid white;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }
        input[type="range"]::-webkit-slider-runnable-track {
          width: 100%;
          height: 0;
          background: transparent;
        }
        input[type="range"]::-moz-range-track {
          width: 100%;
          height: 0;
          background: transparent;
        }
        input[type="range"]:focus {
          outline: none;
        }
        input[type="range"]:focus::-webkit-slider-thumb {
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.3);
        }
        input[type="range"]:focus::-moz-range-thumb {
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.3);
        }
      `}</style>
    </div>
  );
}
