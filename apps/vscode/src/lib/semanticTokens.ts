import { parseDocument, isMap, isSeq, isScalar, isPair } from "yaml";
import {
  validElementTypes,
  validComparators,
  validReferenceTypes,
} from "stagebook";
import { offsetToLineCol } from "./offsetToLineCol";

// Map domain concepts to VS Code's built-in semantic token types.
// These are standard types that all themes already color distinctly.
export type SemanticTokenType =
  | "type" // element types (prompt, submitButton) → teal/green
  | "keyword" // comparators (equals, isAbove) → purple
  | "variable" // reference strings (prompt.q1) → light blue
  | "string" // file paths → orange (distinct via modifier)
  | "property"; // section keys (elements, treatments) → blue

export interface SemanticToken {
  line: number;
  startCol: number;
  length: number;
  tokenType: SemanticTokenType;
  /** The matched text, for testing */
  text: string;
}

const elementTypeSet = new Set<string>(validElementTypes);
const comparatorSet = new Set<string>(validComparators);
const referenceTypeSet = new Set<string>(validReferenceTypes);
const contentTypeSet = new Set([
  "introSequence",
  "introSequences",
  "elements",
  "element",
  "stage",
  "stages",
  "treatment",
  "treatments",
  "reference",
  "condition",
  "player",
  "introExitStep",
  "exitSteps",
]);

const separatorStyles = new Set(["thin", "thick", "regular"]);

const enumValues = new Set([
  "shared",
  "player",
  "all",
  "any",
  "percentAgreement",
  "text",
  "audio",
  "video",
]);

const sectionKeys = new Set([
  "introSequences",
  "introSteps",
  "gameStages",
  "elements",
  "treatments",
  "templates",
  "exitSequence",
  "groupComposition",
  "templateName",
  "templateContent",
  "contentType",
  "broadcast",
  "discussion",
  "conditions",
]);

/**
 * Compute semantic tokens for a treatment YAML source string.
 *
 * Walks the YAML AST and identifies domain-specific tokens based
 * on key names and value content. Returns tokens sorted by position.
 *
 * This is a pure function — no VS Code dependency.
 */
export function computeSemanticTokens(source: string): SemanticToken[] {
  const doc = parseDocument(source, { uniqueKeys: false });
  if (!doc.contents) return [];

  const tokens: SemanticToken[] = [];

  function addToken(
    offset: number,
    text: string,
    tokenType: SemanticTokenType,
  ): void {
    const { line, col } = offsetToLineCol(source, offset);
    tokens.push({
      line,
      startCol: col,
      length: text.length,
      tokenType,
      text,
    });
  }

  const TEMPLATE_VAR_RE = /\$\{[a-zA-Z0-9_]+\}/g;

  /**
   * Emit variable tokens for ${...} placeholders within a string.
   * Only emits tokens for the placeholders, not the surrounding text.
   */
  function emitTemplateVarTokens(startOffset: number, text: string): void {
    TEMPLATE_VAR_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = TEMPLATE_VAR_RE.exec(text)) !== null) {
      addToken(startOffset + match.index, match[0], "variable");
    }
  }

  /**
   * Emit tokens for a file path, splitting around ${...} placeholders.
   * Path segments get "string", placeholders get "variable".
   */
  function addFilePathTokens(startOffset: number, text: string): void {
    let lastIndex = 0;
    TEMPLATE_VAR_RE.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = TEMPLATE_VAR_RE.exec(text)) !== null) {
      if (match.index > lastIndex) {
        addToken(
          startOffset + lastIndex,
          text.slice(lastIndex, match.index),
          "string",
        );
      }
      addToken(startOffset + match.index, match[0], "variable");
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
      addToken(startOffset + lastIndex, text.slice(lastIndex), "string");
    }
  }

  function walkNode(node: unknown, keyName?: string): void {
    if (isMap(node)) {
      for (const pair of node.items) {
        if (!isPair(pair)) continue;

        const key = pair.key;
        const value = pair.value;

        // Highlight the key itself if it's a known section key
        if (isScalar(key) && typeof key.value === "string" && key.range) {
          const keyStr = key.value;
          if (sectionKeys.has(keyStr)) {
            addToken(key.range[0], keyStr, "property");
          }
        }

        // Highlight the value based on the key name
        if (isScalar(key) && typeof key.value === "string") {
          const k = key.value;

          if (
            k === "type" &&
            isScalar(value) &&
            typeof value.value === "string" &&
            value.range
          ) {
            if (elementTypeSet.has(value.value)) {
              addToken(value.range[0], value.value, "type");
            }
          } else if (
            k === "comparator" &&
            isScalar(value) &&
            typeof value.value === "string" &&
            value.range
          ) {
            if (comparatorSet.has(value.value)) {
              addToken(value.range[0], value.value, "keyword");
            }
          } else if (
            k === "reference" &&
            isScalar(value) &&
            typeof value.value === "string" &&
            value.range
          ) {
            const refType = value.value.split(".")[0];
            if (referenceTypeSet.has(refType)) {
              addToken(value.range[0], value.value, "variable");
            }
          } else if (
            k === "file" &&
            isScalar(value) &&
            typeof value.value === "string" &&
            value.range
          ) {
            addFilePathTokens(value.range[0], value.value);
          } else if (
            k === "contentType" &&
            isScalar(value) &&
            typeof value.value === "string" &&
            value.range &&
            contentTypeSet.has(value.value)
          ) {
            addToken(value.range[0], value.value, "type");
          } else if (
            k === "style" &&
            isScalar(value) &&
            typeof value.value === "string" &&
            value.range &&
            separatorStyles.has(value.value)
          ) {
            addToken(value.range[0], value.value, "keyword");
          } else if (
            (k === "position" || k === "chatType") &&
            isScalar(value) &&
            typeof value.value === "string" &&
            value.range &&
            enumValues.has(value.value)
          ) {
            addToken(value.range[0], value.value, "keyword");
          }

          // For any other scalar value containing ${...} placeholders,
          // emit variable tokens so template fields are highlighted
          // consistently everywhere they appear.
          if (
            isScalar(value) &&
            typeof value.value === "string" &&
            value.range &&
            ((TEMPLATE_VAR_RE.lastIndex = 0),
            TEMPLATE_VAR_RE.test(value.value)) &&
            k !== "file" // file paths already handled above
          ) {
            emitTemplateVarTokens(value.range[0], value.value);
          }

          // Recurse into the value
          walkNode(value, isScalar(key) ? String(key.value) : undefined);
        } else {
          walkNode(value);
        }
      }
    } else if (isSeq(node)) {
      for (const item of node.items) {
        walkNode(item, keyName);
      }
    }
  }

  walkNode(doc.contents);

  // Sort by position for consistent output
  tokens.sort((a, b) => a.line - b.line || a.startCol - b.startCol);

  return tokens;
}
