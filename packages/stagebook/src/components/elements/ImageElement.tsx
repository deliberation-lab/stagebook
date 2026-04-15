import React from "react";

export interface ImageElementProps {
  src: string;
  width?: number;
}

export function ImageElement({ src, width }: ImageElementProps) {
  if (!src) return null;

  return (
    <div style={{ display: "flex", justifyContent: "center" }}>
      <img
        src={src}
        alt=""
        style={{
          width: width ? `${width}%` : "100%",
          maxWidth: "100%",
          height: "auto",
        }}
      />
    </div>
  );
}
