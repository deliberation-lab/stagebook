/**
 * Test wrapper that renders a Button with overridden CSS variables.
 */
import React from "react";
import { Button, type ButtonProps } from "../form/Button.js";

export interface ThemedButtonProps extends ButtonProps {
  themeOverrides?: Record<string, string>;
}

export function ThemedButton({
  themeOverrides = {},
  ...buttonProps
}: ThemedButtonProps) {
  const cssText = Object.entries(themeOverrides)
    .map(([key, value]) => `${key}: ${value} !important;`)
    .join(" ");

  return (
    <>
      <style>{`:root { ${cssText} }`}</style>
      <Button {...buttonProps} />
    </>
  );
}
