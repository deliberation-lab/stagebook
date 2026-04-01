import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export interface MarkdownProps {
  text: string;
  resolveURL?: (path: string) => string;
}

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
    <div className="max-w-xl" id="markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{displayText}</ReactMarkdown>
    </div>
  );
}
