import { j as jsxRuntimeExports } from './jsx-runtime-BN0wYjTe.js';
import './index-C0RDlZJG.js';

function RadioGroup({
  options,
  value,
  onChange,
  label = "",
  id = "radioGroup"
}) {
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
        className: "font-normal text-sm text-gray-500 max-w-xl",
        children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "input",
            {
              className: "mr-2 shadow-sm",
              type: "radio",
              value: key,
              checked: value === key,
              onChange
            }
          ),
          optionValue
        ]
      },
      `${id}_${key}`
    )) })
  ] });
}

export { RadioGroup };
//# sourceMappingURL=RadioGroup-CDTbwKpt.js.map
