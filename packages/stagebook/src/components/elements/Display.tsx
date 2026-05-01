import React from "react";

export interface DisplayProps {
  /** Dotted-string representation of the reference, rendered into
   *  `data-reference` for downstream tooling. The caller (`Element.tsx`)
   *  routes both the dotted-string and the structured form through
   *  `formatReference` so consumers always see the dotted shape. */
  reference: string;
  position?: string;
  values: unknown[];
}

// Inline blockquote style — see Markdown.tsx for the full rationale.
//
// Short version: Stagebook is consumed as a library, host CSS resets routinely
// strip default styling, and inline styles win against everything except
// !important. Shipping the visual as inline styles guarantees the Display
// element looks the same on every host without each platform reinventing
// the styling.
//
// The colors ARE overridable: hosts can set --stagebook-blockquote-border and
// --stagebook-blockquote-bg on a parent element to retune without writing any
// selector-based CSS.
//
// Intentional duplication with Markdown.tsx's blockquote entry — both
// render <blockquote> and should look identical so a markdown blockquote
// and a Display element are visually consistent. See issue #33.
const blockquoteStyle: React.CSSProperties = {
  maxWidth: "36rem",
  wordBreak: "break-word",
  padding: "1rem",
  margin: "1rem 0",
  borderLeftWidth: "0.25rem",
  borderLeftStyle: "solid",
  borderLeftColor: "var(--stagebook-blockquote-border, #d1d5db)",
  background: "var(--stagebook-blockquote-bg, #f9fafb)",
};

export function Display({ reference, values }: DisplayProps) {
  return (
    <blockquote style={blockquoteStyle} data-reference={reference}>
      {values
        .map((v) => (typeof v === "string" ? v : JSON.stringify(v)))
        .join("\n")}
    </blockquote>
  );
}
