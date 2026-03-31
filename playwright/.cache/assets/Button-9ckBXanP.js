import { j as jsxRuntimeExports } from './jsx-runtime-BN0wYjTe.js';
import { r as reactExports } from './index-C0RDlZJG.js';

const base = "inline-flex items-center px-4 py-2 border text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500";
const prim = "border-transparent shadow-sm text-white bg-blue-600 hover:bg-blue-700";
const sec = "border-gray-300 shadow-sm text-gray-700 bg-white hover:bg-gray-50";
const dsbl = "opacity-50 cursor-not-allowed";
function Button({
  children,
  onClick = null,
  className = "",
  style = {},
  primary = true,
  type = "button",
  autoFocus = false,
  disabled = false,
  id = ""
}) {
  const generatedId = reactExports.useId();
  const buttonId = id || `button${generatedId}`;
  return /* @__PURE__ */ jsxRuntimeExports.jsx(
    "button",
    {
      type,
      onClick: onClick ?? void 0,
      className: `${base} ${primary ? prim : sec} ${disabled ? dsbl : ""} ${className}`,
      autoFocus,
      style,
      id: buttonId,
      disabled,
      children
    }
  );
}

export { Button };
//# sourceMappingURL=Button-9ckBXanP.js.map
