import React from "react";

export interface ImageElementProps {
  src: string;
  width?: number;
}

export function ImageElement({ src, width }: ImageElementProps) {
  if (!src) return null;

  return (
    <div style={{ display: "flex", justifyContent: "center" }}>
      <img src={src} alt="" width={width ? `${width}%` : "100%"} />
    </div>
  );
}
