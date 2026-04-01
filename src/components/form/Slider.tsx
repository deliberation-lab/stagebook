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
    <div style={{ marginTop: "1rem", width: "100%" }}>
      <div
        style={{
          position: "relative",
          width: "100%",
          paddingTop: "0.5rem",
          paddingBottom: "2.5rem",
          paddingLeft: "0.5rem",
          paddingRight: "0.5rem",
        }}
      >
        {/* Clickable track — no thumb until first interaction */}
        <div
          onClick={handleClick}
          role="presentation"
          style={{
            position: "relative",
            width: "100%",
            height: "8px",
            backgroundColor: "#e5e7eb",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          {/* Ticks */}
          {labelPts.map((pt) => (
            <div
              key={`tick-${pt}`}
              style={{
                position: "absolute",
                left: `${getPosition(pt)}%`,
                top: 0,
                width: "2px",
                height: "12px",
                backgroundColor: "#9ca3af",
              }}
            />
          ))}
        </div>

        {/* Instruction when no value set — avoids anchoring */}
        {!hasValue && (
          <div
            style={{
              position: "absolute",
              left: "50%",
              transform: "translateX(-50%)",
              top: "-0.75rem",
              fontSize: "0.75rem",
              color: "#6b7280",
              textAlign: "center",
              whiteSpace: "nowrap",
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
            style={{
              position: "absolute",
              top: "8px",
              left: "0.5rem",
              width: "calc(100% - 1rem)",
              height: "8px",
              background: "transparent",
              cursor: "pointer",
              WebkitAppearance: "none",
              MozAppearance: "none",
            }}
            aria-label="Slider"
            aria-valuemin={min}
            aria-valuemax={max}
            aria-valuenow={localValue}
          />
        )}

        {/* Labels — positioned below ticks */}
        <div style={{ position: "relative", width: "100%", marginTop: "6px" }}>
          {labelPts.map((pt, idx) => {
            const pos = getPosition(pt);
            // Prevent edge labels from clipping off-screen
            let transform = "translateX(-50%)";
            let textAlign: React.CSSProperties["textAlign"] = "center";
            if (pos <= 5) {
              transform = "translateX(0)";
              textAlign = "left";
            } else if (pos >= 95) {
              transform = "translateX(-100%)";
              textAlign = "right";
            }
            return (
              <div
                key={`label-${pt}`}
                style={{
                  position: "absolute",
                  left: `${pos}%`,
                  transform,
                  textAlign,
                  maxWidth: "80px",
                  fontSize: "0.75rem",
                  color: "#4b5563",
                }}
              >
                {labels[idx]}
              </div>
            );
          })}
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
          margin-top: -8px;
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
