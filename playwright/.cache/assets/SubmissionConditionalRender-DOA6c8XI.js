import { j as jsxRuntimeExports } from './jsx-runtime-BN0wYjTe.js';
import './index-C0RDlZJG.js';

function SubmissionConditionalRender({
  isSubmitted,
  playerCount,
  children
}) {
  if (isSubmitted) {
    if (!playerCount || playerCount <= 1) {
      return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "text-center text-gray-400", children: "Loading..." });
    }
    return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "text-center text-gray-400 pointer-events-none", children: "Please wait for other participant(s) to finish this stage." });
  }
  return /* @__PURE__ */ jsxRuntimeExports.jsx(jsxRuntimeExports.Fragment, { children });
}

export { SubmissionConditionalRender };
//# sourceMappingURL=SubmissionConditionalRender-DOA6c8XI.js.map
