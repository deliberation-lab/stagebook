import * as path from "path";
import * as vscode from "vscode";
import {
  validateTreatmentSource,
  type Diagnostic,
} from "./lib/validateTreatment";
import { validatePromptSource } from "./lib/validatePrompt";
import { pathToRange } from "./lib/yamlPositionMap";
import {
  computeSemanticTokens,
  type SemanticTokenType,
} from "./lib/semanticTokens";
import { expandTreatmentSource } from "./lib/expandTreatment";

const diagnosticCollection =
  vscode.languages.createDiagnosticCollection("stagebook");

const DEBOUNCE_MS = 300;
const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

/** Version counter per document URI — used to discard stale async results. */
const validationVersions = new Map<string, number>();

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
  const uriKey = document.uri.toString();
  const version = (validationVersions.get(uriKey) ?? 0) + 1;
  validationVersions.set(uriKey, version);

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
    checkFileReferences(
      document,
      result.parsedObj,
      source,
      vscodeDiagnostics,
      version,
    );
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
  version: number,
  objPath: (string | number)[] = [],
): void {
  if (Array.isArray(obj)) {
    obj.forEach((item, i) =>
      checkFileReferences(document, item, source, diagnostics, version, [
        ...objPath,
        i,
      ]),
    );
    return;
  }

  if (typeof obj !== "object" || obj === null) return;

  const record = obj as Record<string, unknown>;

  if (typeof record.file === "string" && record.file.length > 0) {
    const filePath = record.file;
    const workspaceFolder =
      vscode.workspace.getWorkspaceFolder(document.uri) ??
      vscode.workspace.workspaceFolders![0];
    const fileUri = vscode.Uri.joinPath(workspaceFolder.uri, filePath);

    // Guard against path traversal (check before template placeholder skip)
    const base = workspaceFolder.uri.fsPath + path.sep;
    if (
      fileUri.fsPath !== workspaceFolder.uri.fsPath &&
      !fileUri.fsPath.startsWith(base)
    ) {
      diagnostics.push(
        makeFileDiagnostic(
          source,
          [...objPath, "file"],
          `File path escapes workspace: ${filePath}`,
          vscode.DiagnosticSeverity.Error,
        ),
      );
      diagnosticCollection.set(document.uri, diagnostics);
      return;
    }

    // Skip file existence check if the path contains template placeholders
    if (/\$\{[a-zA-Z0-9_]+\}/.test(filePath)) return;

    const uriKey = document.uri.toString();
    vscode.workspace.fs.stat(fileUri).then(
      () => {
        // File exists — .prompt.md extension is enforced by the schema
        // (promptFilePathSchema), so no redundant check needed here.
      },
      () => {
        if (validationVersions.get(uriKey) !== version) return;

        diagnostics.push(
          makeFileDiagnostic(
            source,
            [...objPath, "file"],
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
    checkFileReferences(document, value, source, diagnostics, version, [
      ...objPath,
      key,
    ]);
  }
}

function makeFileDiagnostic(
  source: string,
  objPath: (string | number)[],
  message: string,
  severity: vscode.DiagnosticSeverity,
): vscode.Diagnostic {
  const range = pathToRange(source, objPath);
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

function validatePromptFile(document: vscode.TextDocument): void {
  const source = document.getText();
  const result = validatePromptSource(source);

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
}

// Standard VS Code semantic token types — every theme colors these
const semanticTokenTypes: SemanticTokenType[] = [
  "type",
  "keyword",
  "variable",
  "string",
  "property",
];

const tokenLegend = new vscode.SemanticTokensLegend(semanticTokenTypes);

class TreatmentSemanticTokenProvider
  implements vscode.DocumentSemanticTokensProvider
{
  provideDocumentSemanticTokens(
    document: vscode.TextDocument,
  ): vscode.SemanticTokens {
    const builder = new vscode.SemanticTokensBuilder(tokenLegend);
    const source = document.getText();
    const tokens = computeSemanticTokens(source);

    for (const token of tokens) {
      builder.push(
        new vscode.Range(
          token.line,
          token.startCol,
          token.line,
          token.startCol + token.length,
        ),
        token.tokenType,
      );
    }

    return builder.build();
  }
}

// --- Expanded Templates Preview ---

const EXPANDED_SCHEME = "stagebook-expanded";

class ExpandedTemplatesProvider implements vscode.TextDocumentContentProvider {
  private _onDidChange = new vscode.EventEmitter<vscode.Uri>();
  readonly onDidChange = this._onDidChange.event;

  provideTextDocumentContent(uri: vscode.Uri): string {
    const sourceUri = vscode.Uri.parse(decodeURIComponent(uri.query));
    const sourceDoc = vscode.workspace.textDocuments.find(
      (d) => d.uri.toString() === sourceUri.toString(),
    );
    if (!sourceDoc) {
      return "# Source document not found. Please reopen the preview.";
    }

    const result = expandTreatmentSource(sourceDoc.getText());
    if (result.error) {
      const commentedError = result.error
        .split(/\r?\n/)
        .map((line) => `# ${line}`)
        .join("\n");
      return `# Template expansion error:\n${commentedError}`;
    }
    return result.yaml;
  }

  refreshForSource(sourceUri: vscode.Uri): void {
    const expandedUri = vscode.Uri.parse(
      `${EXPANDED_SCHEME}:${sourceUri.path} (expanded)?${encodeURIComponent(sourceUri.toString())}`,
    );
    this._onDidChange.fire(expandedUri);
  }
}

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(diagnosticCollection);

  // Register semantic token provider for treatment files
  context.subscriptions.push(
    vscode.languages.registerDocumentSemanticTokensProvider(
      { language: "treatmentsYaml" },
      new TreatmentSemanticTokenProvider(),
      tokenLegend,
    ),
  );

  // Register expanded templates content provider
  const expandedProvider = new ExpandedTemplatesProvider();
  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider(
      EXPANDED_SCHEME,
      expandedProvider,
    ),
  );

  // Register the expand command
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "stagebook.previewExpandedTemplates",
      async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor || !isTreatmentsYaml(editor.document)) {
          vscode.window.showWarningMessage(
            "Open a .treatments.yaml file first.",
          );
          return;
        }

        const sourceUri = editor.document.uri;
        const expandedUri = vscode.Uri.parse(
          `${EXPANDED_SCHEME}:${sourceUri.path} (expanded)?${encodeURIComponent(sourceUri.toString())}`,
        );

        const doc = await vscode.workspace.openTextDocument(expandedUri);
        await vscode.window.showTextDocument(doc, {
          viewColumn: vscode.ViewColumn.Beside,
          preview: true,
          preserveFocus: true,
        });
        // Set language for syntax highlighting
        await vscode.languages.setTextDocumentLanguage(doc, "yaml");
      },
    ),
  );

  // Auto-refresh the expanded preview when the source changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((e) => {
      if (isTreatmentsYaml(e.document)) {
        expandedProvider.refreshForSource(e.document.uri);
      }
    }),
  );

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

  // Clean up timers and diagnostics when documents close
  context.subscriptions.push(
    vscode.workspace.onDidCloseTextDocument((document) => {
      const key = document.uri.toString();
      const timer = debounceTimers.get(key);
      if (timer) clearTimeout(timer);
      debounceTimers.delete(key);
      validationVersions.delete(key);
      diagnosticCollection.delete(document.uri);
    }),
  );
}

export function deactivate(): void {}
