import React, { useId } from "react";

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
  "data-testid"?: string;
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
  "data-testid": dataTestId,
}: ButtonProps) {
  const generatedId = useId();
  const buttonId = id || `button${generatedId}`;

  const baseStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    padding: "0.5rem 1rem",
    border: "1px solid",
    fontSize: "0.875rem",
    fontWeight: 500,
    borderRadius: "0.375rem",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
  };

  const colorStyle: React.CSSProperties = primary
    ? {
        color: "#fff",
        backgroundColor: "var(--score-primary, #3b82f6)",
        borderColor: "transparent",
        boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
      }
    : {
        color: "var(--score-text-secondary, #374151)",
        backgroundColor: "#fff",
        borderColor: "var(--score-border, #d1d5db)",
        boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
      };

  return (
    <button
      type={type}
      onClick={onClick ?? undefined}
      className={className}
      autoFocus={autoFocus}
      style={{ ...baseStyle, ...colorStyle, ...style }}
      id={buttonId}
      data-testid={dataTestId}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
