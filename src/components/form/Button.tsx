import React, { useId } from "react";

const base =
  "inline-flex items-center px-4 py-2 border text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500";
const prim =
  "border-transparent shadow-sm text-white bg-blue-600 hover:bg-blue-700";
const sec = "border-gray-300 shadow-sm text-gray-700 bg-white hover:bg-gray-50";
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

  return (
    <button
      type={type}
      onClick={onClick ?? undefined}
      className={`${base} ${primary ? prim : sec} ${
        disabled ? dsbl : ""
      } ${className}`}
      autoFocus={autoFocus}
      style={style}
      id={buttonId}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
