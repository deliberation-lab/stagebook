import React, { useId } from "react";

const base =
  "inline-flex items-center px-4 py-2 border text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2";
const prim = "border-transparent shadow-sm";
const sec = "shadow-sm";
const dsbl = "opacity-50 cursor-not-allowed";

export interface ButtonProps {
  children: React.ReactNode;
  onClick?: React.MouseEventHandler<HTMLButtonElement> | null;
  className?: string;
  style?: React.CSSProperties;
  primary?: boolean;
  type?: "button" | "submit" | "reset";
  autoFocus?: boolean;
  disabled?: boolean;
  id?: string;
}

export function Button({
  children,
  onClick = null,
  className = "",
  style = {},
  primary = true,
  type = "button",
  autoFocus = false,
  disabled = false,
  id = "",
}: ButtonProps) {
  const generatedId = useId();
  const buttonId = id || `button${generatedId}`;

  const colorStyle: React.CSSProperties = primary
    ? {
        color: "#fff",
        backgroundColor: "var(--score-primary, #3b82f6)",
        borderColor: "transparent",
      }
    : {
        color: "var(--score-text-secondary, #374151)",
        backgroundColor: "#fff",
        borderColor: "var(--score-border, #d1d5db)",
      };

  return (
    <button
      type={type}
      onClick={onClick ?? undefined}
      className={`${base} ${primary ? prim : sec} ${
        disabled ? dsbl : ""
      } ${className}`}
      autoFocus={autoFocus}
      style={{ ...colorStyle, ...style }}
      id={buttonId}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
