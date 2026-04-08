import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export interface MarkdownProps {
  text: string;
  resolveURL?: (path: string) => string;
}

// ---------------------------------------------------------------------------
// Inline styles for markdown elements
// ---------------------------------------------------------------------------
//
// Why inline styles instead of a stylesheet?
//
// SCORE is consumed as a library. The same SCORE study should render
// consistently across every host platform — that's the whole point of the
// portable treatment file. But hosts ship wildly different CSS environments:
// one ships Tailwind preflight, another ships Bootstrap reboot, another
// ships normalize.css, another ships nothing. CSS resets routinely collapse
// every heading level to body text size, so a researcher's `## Watch the
// clip` renders as a paragraph that happens to start with capital letters.
//
// Author CSS shipped from node_modules loses specificity battles against
// host CSS. Inline styles win against everything except !important, so
// prompt content renders with the intended hierarchy regardless of what
// the host's reset does. This is the same logic that makes SCORE own
// button shapes, slider thumbs, and the media player controls — visual
// behavior is part of the contract, not a property of the host.
//
// These styles ARE overridable. Each value resolves to a CSS custom
// property with a sensible fallback (e.g. var(--score-prompt-h1-size,
// 1.875rem)). Hosts retune the type scale by overriding the variables on
// a parent element or :root — no selector-based CSS needed:
//
//   :root {
//     --score-prompt-h1-size: 1.5rem;
//     --score-prompt-line-height: 1.6;
//     --score-link: #1e40af;
//   }
//
// See issue #33 for the full discussion.

const headingBase: React.CSSProperties = {
  lineHeight: 1.2,
  marginBlock: "0.75em 0.5em",
};

const h1Style: React.CSSProperties = {
  ...headingBase,
  fontSize: "var(--score-prompt-h1-size, 1.875rem)",
  fontWeight:
    "var(--score-prompt-h1-weight, 700)" as React.CSSProperties["fontWeight"],
};

const h2Style: React.CSSProperties = {
  ...headingBase,
  fontSize: "var(--score-prompt-h2-size, 1.5rem)",
  fontWeight:
    "var(--score-prompt-h2-weight, 600)" as React.CSSProperties["fontWeight"],
};

const h3Style: React.CSSProperties = {
  ...headingBase,
  fontSize: "var(--score-prompt-h3-size, 1.25rem)",
  fontWeight:
    "var(--score-prompt-h3-weight, 600)" as React.CSSProperties["fontWeight"],
  marginBlock: "0.5em 0.25em",
};

const h4Style: React.CSSProperties = {
  ...headingBase,
  fontSize: "var(--score-prompt-h4-size, 1.125rem)",
  fontWeight:
    "var(--score-prompt-h4-weight, 600)" as React.CSSProperties["fontWeight"],
  marginBlock: "0.5em 0.25em",
};

const pStyle: React.CSSProperties = {
  marginBlock: "0.5em",
};

const ulStyle: React.CSSProperties = {
  marginBlock: "0.5em",
  paddingInlineStart: "1.5em",
  listStyle: "disc",
};

const olStyle: React.CSSProperties = {
  marginBlock: "0.5em",
  paddingInlineStart: "1.5em",
  listStyle: "decimal",
};

const liStyle: React.CSSProperties = {
  marginBlock: "0.125em",
};

const strongStyle: React.CSSProperties = {
  fontWeight: 600,
};

const emStyle: React.CSSProperties = {
  fontStyle: "italic",
};

const codeStyle: React.CSSProperties = {
  fontFamily:
    "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  fontSize: "0.9em",
  background: "rgba(0,0,0,0.06)",
  padding: "0.1em 0.3em",
  borderRadius: "0.25rem",
};

const aStyle: React.CSSProperties = {
  color: "var(--score-link, #2563eb)",
  textDecoration: "underline",
};

// Shared with Display.tsx (intentional inline duplication, see issue #33).
// Both render <blockquote> and should look identical.
const blockquoteStyle: React.CSSProperties = {
  maxWidth: "36rem",
  wordBreak: "break-word",
  padding: "1rem",
  margin: "1rem 0",
  borderLeftWidth: "0.25rem",
  borderLeftStyle: "solid",
  borderLeftColor: "var(--score-blockquote-border, #d1d5db)",
  background: "var(--score-blockquote-bg, #f9fafb)",
};

export function Markdown({ text, resolveURL }: MarkdownProps) {
  let displayText = text;

  // Rewrite relative image paths if a resolver is provided
  if (resolveURL) {
    displayText = text?.replace(
      /!\[(.*?)\]\((.*?)\)/g,
      (_match, alt: string, path: string) => {
        // Skip absolute URLs
        if (path.startsWith("http://") || path.startsWith("https://")) {
          return `![${alt}](${path})`;
        }
        const resolved = resolveURL(path);
        // Reject non-http protocols (e.g., javascript:)
        if (
          !resolved.startsWith("http://") &&
          !resolved.startsWith("https://") &&
          !resolved.startsWith("data:")
        ) {
          return `![${alt}](${path})`; // fall back to original path
        }
        const url = encodeURI(resolved);
        return `![${alt}](${url})`;
      },
    );
  }

  return (
    <div
      id="markdown"
      style={{
        maxWidth: "36rem",
        fontSize: "var(--score-prompt-text-size, 1rem)",
        lineHeight: "var(--score-prompt-line-height, 1.5)",
        color: "var(--score-text, #1f2937)",
      }}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ node: _node, ...props }) => <h1 style={h1Style} {...props} />,
          h2: ({ node: _node, ...props }) => <h2 style={h2Style} {...props} />,
          h3: ({ node: _node, ...props }) => <h3 style={h3Style} {...props} />,
          h4: ({ node: _node, ...props }) => <h4 style={h4Style} {...props} />,
          p: ({ node: _node, ...props }) => <p style={pStyle} {...props} />,
          ul: ({ node: _node, ...props }) => <ul style={ulStyle} {...props} />,
          ol: ({ node: _node, ...props }) => <ol style={olStyle} {...props} />,
          li: ({ node: _node, ...props }) => <li style={liStyle} {...props} />,
          strong: ({ node: _node, ...props }) => (
            <strong style={strongStyle} {...props} />
          ),
          em: ({ node: _node, ...props }) => <em style={emStyle} {...props} />,
          code: ({ node: _node, ...props }) => (
            <code style={codeStyle} {...props} />
          ),
          a: ({ node: _node, ...props }) => <a style={aStyle} {...props} />,
          blockquote: ({ node: _node, ...props }) => (
            <blockquote style={blockquoteStyle} {...props} />
          ),
        }}
      >
        {displayText}
      </ReactMarkdown>
    </div>
  );
}
