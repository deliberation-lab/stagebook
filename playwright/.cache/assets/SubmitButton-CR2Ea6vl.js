import { j as jsxRuntimeExports } from './jsx-runtime-BN0wYjTe.js';
import { Button } from './Button-9ckBXanP.js';
import './index-C0RDlZJG.js';

function SubmitButton({
  onSubmit,
  name,
  buttonText = "Next",
  save,
  getElapsedTime
}) {
  const handleClick = () => {
    save(`submitButton_${name}`, { time: getElapsedTime() });
    onSubmit();
  };
  return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mt-4", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Button, { onClick: handleClick, children: buttonText }) });
}

export { SubmitButton };
//# sourceMappingURL=SubmitButton-CR2Ea6vl.js.map
