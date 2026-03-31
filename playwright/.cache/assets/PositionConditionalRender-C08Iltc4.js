import { j as jsxRuntimeExports } from './jsx-runtime-BN0wYjTe.js';
import './index-C0RDlZJG.js';

function PositionConditionalRender({
  showToPositions,
  hideFromPositions,
  position,
  children
}) {
  if (position === void 0) return /* @__PURE__ */ jsxRuntimeExports.jsx(jsxRuntimeExports.Fragment, { children });
  if (showToPositions && !showToPositions.includes(position)) return null;
  if (hideFromPositions && hideFromPositions.includes(position)) return null;
  return /* @__PURE__ */ jsxRuntimeExports.jsx(jsxRuntimeExports.Fragment, { children });
}

export { PositionConditionalRender };
//# sourceMappingURL=PositionConditionalRender-C08Iltc4.js.map
