import { j as jsxRuntimeExports } from './jsx-runtime-BN0wYjTe.js';
import { r as reactExports } from './index-C0RDlZJG.js';

function KitchenTimer({
  startTime,
  endTime,
  warnTimeRemaining = 10,
  getElapsedTime
}) {
  const [, setTick] = reactExports.useState(false);
  reactExports.useEffect(() => {
    const interval = setInterval(() => setTick((prev) => !prev), 1e3);
    return () => clearInterval(interval);
  }, []);
  const stageElapsed = getElapsedTime();
  const timerDuration = endTime - startTime;
  let timerElapsed = 0;
  let timerRemaining = timerDuration;
  if (stageElapsed > startTime) {
    timerElapsed = stageElapsed - startTime;
    timerRemaining = endTime - stageElapsed;
  }
  if (stageElapsed > endTime) {
    timerElapsed = timerDuration;
    timerRemaining = 0;
  }
  const percent = timerElapsed / timerDuration * 100;
  const displayRemaining = new Date(1e3 * timerRemaining).toISOString().slice(timerRemaining < 3600 ? 14 : 11, 19);
  const isWarning = timerRemaining <= warnTimeRemaining;
  return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "m-6 max-w-xl", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "relative w-full h-6 bg-gray-200 rounded-full overflow-hidden", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(
      "div",
      {
        className: `h-full rounded-full transition-all duration-1000 ${isWarning ? "bg-red-500" : "bg-blue-400"}`,
        style: { width: `${Math.min(percent, 100)}%` }
      }
    ),
    /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "absolute inset-0 flex items-center justify-center text-xs font-medium", children: displayRemaining })
  ] }) });
}

export { KitchenTimer };
//# sourceMappingURL=KitchenTimer-C_njxj3v.js.map
