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
// Stagebook is consumed as a library. The same Stagebook study should render
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
// the host's reset does. This is the same logic that makes Stagebook own
// button shapes, slider thumbs, and the media player controls — visual
// behavior is part of the contract, not a property of the host.
//
// These styles are tunable, but not every value is exposed as a CSS
// custom property. Key typography and color values are variable-backed
// (heading sizes/weights, link color, body line-height, blockquote
// border/background, code background/font, prompt max-width). Spacing
// and structural values (margins, padding, list bullet style, em
// italics, strong weight) are hard-coded inline to keep the visual
// consistent across hosts. If a researcher needs to tune one of those,
// add a new variable in styles.css :root and reference it here.
//
// To override the exposed variables, set them on a parent element or
// :root — no selector-based CSS needed:
//
//   :root {
//     --stagebook-prompt-h1-size: 1.5rem;
//     --stagebook-prompt-line-height: 1.6;
//     --stagebook-link: #1e40af;
//   }
//
// See issue #33 for the full discussion.

const headingBase: React.CSSProperties = {
  lineHeight: 1.2,
  marginBlock: "0.75em 0.5em",
};

const h1Style: React.CSSProperties = {
  ...headingBase,
  fontSize: "var(--stagebook-prompt-h1-size, 1.875rem)",
  fontWeight: "var(--stagebook-prompt-h1-weight, 700)",
};

const h2Style: React.CSSProperties = {
  ...headingBase,
  fontSize: "var(--stagebook-prompt-h2-size, 1.5rem)",
  fontWeight: "var(--stagebook-prompt-h2-weight, 600)",
};

const h3Style: React.CSSProperties = {
  ...headingBase,
  fontSize: "var(--stagebook-prompt-h3-size, 1.25rem)",
  fontWeight: "var(--stagebook-prompt-h3-weight, 600)",
  marginBlock: "0.5em 0.25em",
};

const h4Style: React.CSSProperties = {
  ...headingBase,
  fontSize: "var(--stagebook-prompt-h4-size, 1.125rem)",
  fontWeight: "var(--stagebook-prompt-h4-weight, 600)",
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
  // Match the browser-default <strong> weight so **bold** looks bold even
  // on hosts that strip the UA stylesheet.
  fontWeight: 700,
};

const emStyle: React.CSSProperties = {
  fontStyle: "italic",
};

// Inline code only — `like this`. Fenced code blocks (```...```) get
// className="language-*" from react-markdown; the <pre> wrapper receives
// the block-level chip styling (see preStyle), so the inner <code> is
// passed through without its own background/padding to avoid a nested
// box look.
const inlineCodeStyle: React.CSSProperties = {
  fontFamily:
    "var(--stagebook-code-font, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace)",
  fontSize: "0.9em",
  background: "var(--stagebook-code-bg, rgba(0,0,0,0.06))",
  padding: "0.1em 0.3em",
  borderRadius: "0.25rem",
};

// Fenced code block wrapper. react-markdown emits
// <pre><code class="language-*">...</code></pre>, so the <pre> carries
// all of the block-level chip styling (background, padding, radius,
// horizontal scroll). The inner <code> keeps only the font so the block
// doesn't render as a nested box. Tailwind preflight and similar resets
// strip the UA <pre> monospace font, so we reassert it here. See #215.
const preStyle: React.CSSProperties = {
  background: "var(--stagebook-code-bg, rgba(0,0,0,0.06))",
  padding: "0.75rem 1rem",
  borderRadius: "0.375rem",
  overflowX: "auto",
  fontFamily:
    "var(--stagebook-code-font, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace)",
  lineHeight: 1.4,
  marginBlock: "0.5em",
};

// Horizontal rule (`---`). Tailwind preflight ships `hr { border: 0 }`
// which makes the rule disappear entirely. Inline border-top wins on
// specificity and restores a visible rule on any host. We zero the other
// border sides so a future host rule like `hr { border-width: 1px }`
// doesn't accidentally give us a full box. See #215.
const hrStyle: React.CSSProperties = {
  border: 0,
  borderTopWidth: "1px",
  borderTopStyle: "solid",
  borderTopColor: "var(--stagebook-border, #d1d5db)",
  marginBlock: "1em",
};

const aStyle: React.CSSProperties = {
  color: "var(--stagebook-link, #2563eb)",
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
  borderLeftColor: "var(--stagebook-blockquote-border, #d1d5db)",
  background: "var(--stagebook-blockquote-bg, #f9fafb)",
};

const imgStyle: React.CSSProperties = {
  maxWidth: "100%",
  height: "auto",
};

// GFM tables. Inlined (per issue #214) so tables render with borders and
// padding even on hosts that don't import styles.css. thead / tbody / tr
// have no handlers here — browser defaults are acceptable once the table
// itself has border-collapse and the cells have borders + padding.
const tableStyle: React.CSSProperties = {
  borderCollapse: "collapse",
  margin: "1rem 0",
  width: "100%",
  maxWidth: "var(--stagebook-prompt-max-width, 36rem)",
};

const tableCellBase: React.CSSProperties = {
  border: "1px solid var(--stagebook-border, #d1d5db)",
  padding: "0.5rem 0.75rem",
  textAlign: "left",
  fontSize: "0.875rem",
  color: "var(--stagebook-table-text, #4a5568)",
};

const thStyle: React.CSSProperties = {
  ...tableCellBase,
  backgroundColor: "var(--stagebook-bg-muted, #f9fafb)",
  fontWeight: 500,
  color: "var(--stagebook-table-header-text, #1a202c)",
};

const tdStyle: React.CSSProperties = tableCellBase;

// GFM task-list checkboxes (`- [x]` / `- [ ]`). remark-gfm emits them as
// `<input type="checkbox" disabled [checked]>` inside a task-list <li>.
// Because they're disabled we don't need a focus ring, but the base +
// checked visuals still need to be inline so the checkbox stays a filled
// blue box on hosts without styles.css loaded (Tailwind preflight strips
// the default OS chrome via `appearance: none`). See issue #213.
const taskListCheckboxBaseStyle: React.CSSProperties = {
  appearance: "none",
  WebkitAppearance: "none",
  width: "1rem",
  height: "1rem",
  border: "1px solid var(--stagebook-border, #d1d5db)",
  borderRadius: "0.125rem",
  backgroundColor: "var(--stagebook-surface, #fff)",
  backgroundSize: "100% 100%",
  backgroundPosition: "center",
  backgroundRepeat: "no-repeat",
  verticalAlign: "middle",
  margin: "0 0.25rem 0 0",
};

const TASKLIST_CHECK_SVG =
  "url(\"data:image/svg+xml,%3csvg viewBox='0 0 16 16' fill='white' xmlns='http://www.w3.org/2000/svg'%3e%3cpath d='M12.207 4.793a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0l-2-2a1 1 0 011.414-1.414L6.5 9.086l4.293-4.293a1 1 0 011.414 0z'/%3e%3c/svg%3e\")";

const taskListCheckboxCheckedStyle: React.CSSProperties = {
  backgroundColor: "var(--stagebook-primary, #3b82f6)",
  borderColor: "var(--stagebook-primary, #3b82f6)",
  backgroundImage: TASKLIST_CHECK_SVG,
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
        maxWidth: "var(--stagebook-prompt-max-width, 36rem)",
        fontSize: "var(--stagebook-prompt-text-size, 1rem)",
        lineHeight: "var(--stagebook-prompt-line-height, 1.5)",
        color: "var(--stagebook-text, #1f2937)",
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
          code: ({ node: _node, className, ...props }) => {
            // react-markdown v10 dropped the `inline` prop. Fenced code
            // blocks get className="language-*"; inline code has no
            // className. The inline variant gets the chip styling
            // (background, padding, radius); the fenced variant's
            // block-level chip is supplied by the surrounding <pre>
            // (preStyle) so we don't double-wrap the background/padding
            // here. See #215.
            const isFenced =
              typeof className === "string" &&
              className.startsWith("language-");
            return isFenced ? (
              <code className={className} {...props} />
            ) : (
              <code style={inlineCodeStyle} {...props} />
            );
          },
          pre: ({ node: _node, ...props }) => (
            <pre style={preStyle} {...props} />
          ),
          hr: ({ node: _node, ...props }) => <hr style={hrStyle} {...props} />,
          a: ({ node: _node, ...props }) => <a style={aStyle} {...props} />,
          blockquote: ({ node: _node, ...props }) => (
            <blockquote style={blockquoteStyle} {...props} />
          ),
          // Inline max-width keeps markdown-embedded images inside the
          // prompt container on any host, regardless of what reset the
          // host chose. host-typography provides the same rule for the
          // host's own bare-tag pages; this override ensures stagebook's
          // own rendered content is self-constraining even when the host
          // hasn't opted in. See issue #211.
          img: ({ node: _node, ...props }) => (
            <img style={imgStyle} {...props} alt={props.alt ?? ""} />
          ),
          // GFM tables (issue #214). Only table / th / td need handlers —
          // thead / tbody / tr use browser defaults.
          table: ({ node: _node, ...props }) => (
            <table style={tableStyle} {...props} />
          ),
          th: ({ node: _node, ...props }) => <th style={thStyle} {...props} />,
          td: ({ node: _node, ...props }) => <td style={tdStyle} {...props} />,
          // GFM task-list checkboxes (#213). The task-list input is
          // rendered as a disabled <input type="checkbox">, so no focus
          // ring is needed — but the base + checked visuals still need
          // inline styling to survive hosts without styles.css. Other
          // `<input>` types emitted from raw HTML (if any ever passed
          // through rehype-raw) aren't styled here; the contract is
          // specifically about the GFM task-list case.
          input: ({ node: _node, type, checked, ...props }) => {
            if (type !== "checkbox") {
              return <input type={type} checked={checked} {...props} />;
            }
            return (
              <input
                type="checkbox"
                checked={checked}
                {...props}
                style={{
                  ...taskListCheckboxBaseStyle,
                  ...(checked ? taskListCheckboxCheckedStyle : {}),
                }}
              />
            );
          },
        }}
      >
        {displayText}
      </ReactMarkdown>
    </div>
  );
}
