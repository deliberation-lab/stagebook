import { j as jsxRuntimeExports } from './jsx-runtime-BN0wYjTe.js';
import { r as reactExports } from './index-C0RDlZJG.js';

function Slider({
  min = 0,
  max = 100,
  interval = 1,
  labelPts = [],
  labels = [],
  value,
  onChange
}) {
  const [localValue, setLocalValue] = reactExports.useState(value);
  reactExports.useEffect(() => {
    setLocalValue(value);
  }, [value]);
  const handleChange = (e) => {
    const newValue = parseFloat(e.target.value);
    setLocalValue(newValue);
    onChange?.(newValue);
  };
  const handleClick = (e) => {
    if (localValue !== void 0 && localValue !== null) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const rawValue = min + percentage * (max - min);
    const newValue = Math.round(rawValue / interval) * interval;
    const clampedValue = Math.max(min, Math.min(max, newValue));
    setLocalValue(clampedValue);
    onChange?.(clampedValue);
  };
  const getPosition = (pt) => (pt - min) / (max - min) * 100;
  const hasValue = localValue !== void 0 && localValue !== null;
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-4 w-full", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "relative w-full pt-2 pb-8", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        "div",
        {
          className: "relative w-full h-2 bg-gray-200 rounded cursor-pointer hover:bg-gray-300",
          onClick: handleClick,
          role: "presentation",
          children: labelPts.map((pt) => /* @__PURE__ */ jsxRuntimeExports.jsx(
            "div",
            {
              className: "absolute top-0 w-0.5 bg-gray-400",
              style: { left: `${getPosition(pt)}%`, height: "12px" }
            },
            `tick-${pt}`
          ))
        }
      ),
      !hasValue && /* @__PURE__ */ jsxRuntimeExports.jsx(
        "div",
        {
          className: "absolute text-xs text-gray-500 text-center whitespace-nowrap",
          style: {
            left: "50%",
            transform: "translateX(-50%) translateY(-150%)"
          },
          children: "Click the bar to select a value, then drag to adjust."
        }
      ),
      hasValue && /* @__PURE__ */ jsxRuntimeExports.jsx(
        "input",
        {
          type: "range",
          min,
          max,
          step: interval,
          value: localValue,
          onChange: handleChange,
          className: "absolute top-2 left-0 w-full h-2 appearance-none bg-transparent cursor-pointer",
          style: {
            WebkitAppearance: "none",
            MozAppearance: "none"
          },
          "aria-label": "Slider",
          "aria-valuemin": min,
          "aria-valuemax": max,
          "aria-valuenow": localValue
        }
      ),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "relative w-full mt-2", children: labelPts.map((pt, idx) => /* @__PURE__ */ jsxRuntimeExports.jsx(
        "div",
        {
          className: "absolute text-xs text-gray-600 text-center",
          style: {
            left: `${getPosition(pt)}%`,
            transform: "translateX(-50%)",
            maxWidth: "80px"
          },
          children: labels[idx]
        },
        `label-${pt}`
      )) })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("style", { children: `
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
      ` })
  ] });
}

export { Slider };
//# sourceMappingURL=Slider-BIv7TtcC.js.map
