import React from "react";

export interface DisplayProps {
  reference: string;
  position?: string;
  values: unknown[];
}

export function Display({ reference, values }: DisplayProps) {
  return (
    <blockquote
      className="max-w-xl break-words p-4 my-4 border-l-4 border-gray-300 bg-gray-50"
      data-reference={reference}
    >
      {values
        .map((v) => (typeof v === "string" ? v : JSON.stringify(v)))
        .join("\n")}
    </blockquote>
  );
}
