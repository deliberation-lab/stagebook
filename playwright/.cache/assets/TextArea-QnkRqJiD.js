import { j as jsxRuntimeExports } from './jsx-runtime-BN0wYjTe.js';
import { r as reactExports } from './index-C0RDlZJG.js';

function TextArea({
  defaultText,
  onChange,
  onDebugMessage,
  value,
  rows = 5,
  showCharacterCount,
  minLength,
  maxLength,
  debounceDelay = 500,
  id
}) {
  const generatedId = reactExports.useId();
  const textAreaId = id || generatedId;
  const [localValue, setLocalValue] = reactExports.useState(value || "");
  const debounceTimeout = reactExports.useRef(null);
  const keystrokeTimestamps = reactExports.useRef([]);
  const isDebouncing = reactExports.useRef(false);
  reactExports.useEffect(() => {
    if (!isDebouncing.current) {
      setLocalValue(value || "");
    }
  }, [value]);
  const submitChange = (val) => {
    if (onChange && typeof onChange === "function") {
      onChange(val);
    }
  };
  const debouncedSubmit = (val) => {
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }
    isDebouncing.current = true;
    debounceTimeout.current = setTimeout(() => {
      isDebouncing.current = false;
      submitChange(val);
    }, debounceDelay);
  };
  const handlePaste = (e) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData("text");
    if (onDebugMessage) {
      onDebugMessage({
        type: "pasteAttempt",
        content: pastedText,
        timestamp: Date.now()
      });
    }
  };
  const handleChange = (e) => {
    const newValue = e.target.value;
    if (maxLength && newValue.length > maxLength) return;
    setLocalValue(newValue);
    debouncedSubmit(newValue);
  };
  const computeTypingStats = () => {
    const timestamps = keystrokeTimestamps.current;
    if (timestamps.length < 2) return null;
    const intervals = timestamps.slice(1).map((t, i) => t - timestamps[i]);
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const stdDev = Math.sqrt(
      intervals.map((x) => (x - avgInterval) ** 2).reduce((a, b) => a + b, 0) / intervals.length
    );
    return {
      type: "typingStats",
      totalKeystrokes: timestamps.length,
      avgInterval,
      stdDev
    };
  };
  const handleBlur = () => {
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
      isDebouncing.current = false;
    }
    submitChange(localValue);
    const typingStats = computeTypingStats();
    if (typingStats && onDebugMessage) {
      onDebugMessage(typingStats);
    }
  };
  const handleKeyDown = () => {
    keystrokeTimestamps.current.push(Date.now());
  };
  const renderCharacterCount = () => {
    if (!showCharacterCount) return null;
    let countText = "";
    let colorClass = "text-gray-500";
    const currentLength = localValue.length;
    if (minLength && maxLength) {
      countText = `(${currentLength} / ${minLength}-${maxLength} chars)`;
      if (currentLength >= minLength && currentLength < maxLength) {
        colorClass = "text-green-600";
      } else if (currentLength === maxLength) {
        colorClass = "text-red-600";
      }
    } else if (minLength) {
      countText = `(${currentLength} / ${minLength}+ characters required)`;
      if (currentLength >= minLength) {
        colorClass = "text-green-600";
      }
    } else if (maxLength) {
      countText = `(${currentLength} / ${maxLength} chars max)`;
      if (currentLength === maxLength) {
        colorClass = "text-red-600";
      }
    } else {
      countText = `(${currentLength} characters)`;
    }
    return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: `text-right text-sm mt-1 ${colorClass}`, children: countText });
  };
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "relative", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(
      "textarea",
      {
        className: "appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm",
        id: textAreaId,
        autoComplete: "off",
        rows,
        placeholder: defaultText,
        value: localValue,
        onChange: handleChange,
        onBlur: handleBlur,
        onPaste: handlePaste,
        onKeyDown: handleKeyDown
      }
    ),
    renderCharacterCount()
  ] });
}

export { TextArea };
//# sourceMappingURL=TextArea-QnkRqJiD.js.map
