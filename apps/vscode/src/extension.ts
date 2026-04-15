import * as vscode from "vscode";
import {
  validateTreatmentSource,
  type Diagnostic,
} from "./lib/validateTreatment";
import { pathToRange } from "./lib/yamlPositionMap";

const diagnosticCollection =
  vscode.languages.createDiagnosticCollection("stagebook");

const DEBOUNCE_MS = 300;
const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

function isTreatmentsYaml(document: vscode.TextDocument): boolean {
  return (
    document.languageId === "treatmentsYaml" ||
    document.fileName.endsWith(".treatments.yaml")
  );
}

function isStagebookPrompt(document: vscode.TextDocument): boolean {
  return (
    document.languageId === "stagebookPrompt" ||
    document.fileName.endsWith(".prompt.md")
  );
}

function validateDocument(document: vscode.TextDocument): void {
  if (isTreatmentsYaml(document)) {
    validateTreatmentFile(document);
  } else if (isStagebookPrompt(document)) {
    validatePromptFile(document);
  } else {
    diagnosticCollection.delete(document.uri);
  }
}

function validateDocumentDebounced(document: vscode.TextDocument): void {
  const key = document.uri.toString();
  const existing = debounceTimers.get(key);
  if (existing) clearTimeout(existing);

  debounceTimers.set(
    key,
    setTimeout(() => {
      debounceTimers.delete(key);
      validateDocument(document);
    }, DEBOUNCE_MS),
  );
}

function toSeverity(
  severity: Diagnostic["severity"],
): vscode.DiagnosticSeverity {
  return severity === "warning"
    ? vscode.DiagnosticSeverity.Warning
    : vscode.DiagnosticSeverity.Error;
}

function toVscodeRange(range: Diagnostic["range"]): vscode.Range {
  if (!range) {
    return new vscode.Range(0, 0, 0, 0);
  }
  return new vscode.Range(
    range.startLine,
    range.startCol,
    range.endLine,
    range.endCol,
  );
}

function validateTreatmentFile(document: vscode.TextDocument): void {
  const source = document.getText();
  const result = validateTreatmentSource(source);

  const vscodeDiagnostics = result.diagnostics.map((d) => {
    const diag = new vscode.Diagnostic(
      toVscodeRange(d.range),
      d.message,
      toSeverity(d.severity),
    );
    diag.source = "stagebook";
    return diag;
  });

  diagnosticCollection.set(document.uri, vscodeDiagnostics);

  // File existence checking (async — updates diagnostics after stat)
  if (
    result.parsedObj &&
    typeof result.parsedObj === "object" &&
    vscode.workspace.workspaceFolders?.length
  ) {
    checkFileReferences(document, result.parsedObj, source, vscodeDiagnostics);
  }
}

/**
 * Walk the parsed treatment object looking for `file:` fields.
 * Check that referenced files exist and have the right extension.
 */
function checkFileReferences(
  document: vscode.TextDocument,
  obj: unknown,
  source: string,
  diagnostics: vscode.Diagnostic[],
  path: (string | number)[] = [],
): void {
  if (Array.isArray(obj)) {
    obj.forEach((item, i) =>
      checkFileReferences(document, item, source, diagnostics, [...path, i]),
    );
    return;
  }

  if (typeof obj !== "object" || obj === null) return;

  const record = obj as Record<string, unknown>;

  if (typeof record.file === "string" && record.file.length > 0) {
    const filePath = record.file;

    // Skip if the path contains template placeholders
    if (/\$\{[a-zA-Z0-9_]+\}/.test(filePath)) return;

    const workspaceFolder = vscode.workspace.workspaceFolders![0];
    const fileUri = vscode.Uri.joinPath(workspaceFolder.uri, filePath);

    // Guard against path traversal
    if (!fileUri.fsPath.startsWith(workspaceFolder.uri.fsPath)) {
      diagnostics.push(
        makeFileDiagnostic(
          source,
          [...path, "file"],
          `File path escapes workspace: ${filePath}`,
          vscode.DiagnosticSeverity.Error,
        ),
      );
      diagnosticCollection.set(document.uri, diagnostics);
      return;
    }

    vscode.workspace.fs.stat(fileUri).then(
      () => {
        // File exists — check extension for prompt elements
        if (record.type === "prompt" && !filePath.endsWith(".prompt.md")) {
          diagnostics.push(
            makeFileDiagnostic(
              source,
              [...path, "file"],
              `Prompt file should have .prompt.md extension: ${filePath}`,
              vscode.DiagnosticSeverity.Warning,
            ),
          );
          diagnosticCollection.set(document.uri, diagnostics);
        }
      },
      () => {
        diagnostics.push(
          makeFileDiagnostic(
            source,
            [...path, "file"],
            `File not found: ${filePath}`,
            vscode.DiagnosticSeverity.Error,
          ),
        );
        diagnosticCollection.set(document.uri, diagnostics);
      },
    );
  }

  for (const [key, value] of Object.entries(record)) {
    if (key === "file") continue;
    checkFileReferences(document, value, source, diagnostics, [...path, key]);
  }
}

function makeFileDiagnostic(
  source: string,
  path: (string | number)[],
  message: string,
  severity: vscode.DiagnosticSeverity,
): vscode.Diagnostic {
  const range = pathToRange(source, path);
  const vscodeRange = range
    ? new vscode.Range(
        range.startLine,
        range.startCol,
        range.endLine,
        range.endCol,
      )
    : new vscode.Range(0, 0, 0, 0);

  const diag = new vscode.Diagnostic(vscodeRange, message, severity);
  diag.source = "stagebook";
  return diag;
}

function validatePromptFile(_document: vscode.TextDocument): void {
  // TODO (#76): validate with stagebook's promptFileSchema
}

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(diagnosticCollection);

  // Validate the active document on activation (no debounce)
  if (vscode.window.activeTextEditor) {
    validateDocument(vscode.window.activeTextEditor.document);
  }

  // Validate on open (no debounce)
  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument((document) => {
      validateDocument(document);
    }),
  );

  // Validate on edit (debounced)
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((event) => {
      validateDocumentDebounced(event.document);
    }),
  );

  // Validate on editor focus change (no debounce)
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor) {
        validateDocument(editor.document);
      }
    }),
  );
}

export function deactivate(): void {}
