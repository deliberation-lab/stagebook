import { j as jsxRuntimeExports } from './jsx-runtime-BN0wYjTe.js';
import './index-C0RDlZJG.js';

function CheckboxGroup({
  options,
  value = [],
  onChange,
  label = "",
  id = "checkboxGroup"
}) {
  const handleToggle = (key) => {
    const selectedSet = new Set(value);
    if (selectedSet.has(key)) {
      selectedSet.delete(key);
    } else {
      selectedSet.add(key);
    }
    onChange(Array.from(selectedSet));
  };
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-4", children: [
    label && /* @__PURE__ */ jsxRuntimeExports.jsx(
      "label",
      {
        htmlFor: id,
        className: "block text-md font-medium text-gray-800 my-2",
        children: label
      }
    ),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "ml-5 grid gap-1.5", children: options.map(({ key, value: optionValue }) => /* @__PURE__ */ jsxRuntimeExports.jsxs(
      "label",
      {
        className: "font-normal text-sm text-gray-500",
        children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "input",
            {
              className: "mr-2 shadow-sm",
              type: "checkbox",
              name: key,
              value: key,
              id: `${id}_${key}`,
              checked: value.includes(key),
              onChange: () => handleToggle(key)
            }
          ),
          optionValue
        ]
      },
      `${id}_${key}`
    )) })
  ] });
}

export { CheckboxGroup };
//# sourceMappingURL=CheckboxGroup-BGSvM1Ez.js.map
