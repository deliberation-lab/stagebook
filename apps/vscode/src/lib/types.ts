import type { SourceRange } from "./yamlPositionMap";

export interface Diagnostic {
  message: string;
  severity: "error" | "warning";
  range: SourceRange | null;
}
