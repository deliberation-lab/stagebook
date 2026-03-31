import { j as jsxRuntimeExports } from './jsx-runtime-BN0wYjTe.js';
import './index-C0RDlZJG.js';

function Display({ reference, values }) {
  return /* @__PURE__ */ jsxRuntimeExports.jsx(
    "blockquote",
    {
      className: "max-w-xl break-words p-4 my-4 border-l-4 border-gray-300 bg-gray-50",
      "data-reference": reference,
      children: values.map((v) => typeof v === "string" ? v : JSON.stringify(v)).join("\n")
    }
  );
}

export { Display };
//# sourceMappingURL=Display-m7TGNjd7.js.map
