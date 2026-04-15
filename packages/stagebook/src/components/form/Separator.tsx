import React from "react";

export interface SeparatorProps {
  style?: "" | "thin" | "regular" | "thick";
}

const baseStyle: React.CSSProperties = {
  margin: "1rem 0",
  width: "100%",
  border: "none",
};

const thinStyle: React.CSSProperties = {
  ...baseStyle,
  height: "1px",
  backgroundColor: "#9ca3af",
};

const regularStyle: React.CSSProperties = {
  ...baseStyle,
  height: "3px",
  backgroundColor: "#9ca3af",
};

const thickStyle: React.CSSProperties = {
  ...baseStyle,
  height: "5px",
  backgroundColor: "#6b7280",
};

export function Separator({ style = "" }: SeparatorProps) {
  return (
    <div>
      {style === "thin" && <hr style={thinStyle} />}
      {(style === "" || style === "regular") && <hr style={regularStyle} />}
      {style === "thick" && <hr style={thickStyle} />}
    </div>
  );
}
