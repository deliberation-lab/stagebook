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
import { findClosestMatch } from "./lib/levenshtein";
import { fillTemplates, treatmentFileSchema } from "stagebook";
import { parse as parseYaml } from "yaml";

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

// --- File Path Quick-Fix ---

class FilePathQuickFixProvider implements vscode.CodeActionProvider {
  static readonly providedCodeActionKinds = [vscode.CodeActionKind.QuickFix];

  // Cache workspace file paths to avoid re-globbing on every cursor move
  private cachedPaths: string[] = [];
  private cacheTimestamp = 0;
  private static readonly CACHE_TTL_MS = 5000;

  async provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range,
  ): Promise<vscode.CodeAction[]> {
    const diagnostics = vscode.languages
      .getDiagnostics(document.uri)
      .filter(
        (d) =>
          d.source === "stagebook" &&
          d.message.startsWith("File not found:") &&
          d.range.intersection(range),
      );

    if (diagnostics.length === 0 || !vscode.workspace.workspaceFolders?.length)
      return [];

    const actions: vscode.CodeAction[] = [];
    const workspaceFolder =
      vscode.workspace.getWorkspaceFolder(document.uri) ??
      vscode.workspace.workspaceFolders[0];

    // Refresh the cached file list if stale
    const now = Date.now();
    if (now - this.cacheTimestamp > FilePathQuickFixProvider.CACHE_TTL_MS) {
      const allFiles = await vscode.workspace.findFiles(
        new vscode.RelativePattern(
          workspaceFolder,
          "**/*.{prompt.md,md,yaml,jpg,jpeg,png,mp3,mp4}",
        ),
        "**/node_modules/**",
        5000,
      );
      this.cachedPaths = allFiles.map((f) =>
        path
          .relative(workspaceFolder.uri.fsPath, f.fsPath)
          .split(path.sep)
          .join("/"),
      );
      this.cacheTimestamp = now;
    }

    for (const diagnostic of diagnostics) {
      const badPath = diagnostic.message.replace("File not found: ", "");
      const suggestion = findClosestMatch(badPath, this.cachedPaths);
      if (!suggestion) continue;

      const action = new vscode.CodeAction(
        `Did you mean: ${suggestion}?`,
        vscode.CodeActionKind.QuickFix,
      );
      action.edit = new vscode.WorkspaceEdit();
      action.edit.replace(document.uri, diagnostic.range, suggestion);
      action.isPreferred = true;
      action.diagnostics = [diagnostic];
      actions.push(action);
    }

    return actions;
  }
}

// --- File Path Autocomplete ---

class FilePathCompletionProvider implements vscode.CompletionItemProvider {
  async provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): Promise<vscode.CompletionItem[] | undefined> {
    const line = document.lineAt(position).text;
    const prefix = line.substring(0, position.character);

    // Trigger after "file:" anywhere in the line (handles "- file:", indented, etc.)
    if (!/\bfile:\s/.test(prefix)) return undefined;

    if (!vscode.workspace.workspaceFolders?.length) return undefined;

    const workspaceFolder =
      vscode.workspace.getWorkspaceFolder(document.uri) ??
      vscode.workspace.workspaceFolders[0];

    // Get the partial path the user has typed so far
    const fileValueMatch = prefix.match(/\bfile:\s+(.*)/);
    const partial = fileValueMatch?.[1] ?? "";

    // Sanitize glob metacharacters in user input
    const sanitized = partial.replace(/[*?[\]{}]/g, "\\$&");
    const globPattern = sanitized
      ? `**/${sanitized}*`
      : "**/*.{prompt.md,md,yaml}";
    const files = await vscode.workspace.findFiles(
      new vscode.RelativePattern(workspaceFolder, globPattern),
      "**/node_modules/**",
      50,
    );

    // Find the end of the value (stop at comment or end of line)
    const valueEndMatch = line.substring(position.character).match(/\s+#/);
    const valueEnd = valueEndMatch
      ? position.character + valueEndMatch.index!
      : line.length;

    return files.map((fileUri) => {
      const relativePath = path
        .relative(workspaceFolder.uri.fsPath, fileUri.fsPath)
        .split(path.sep)
        .join("/");
      const item = new vscode.CompletionItem(
        relativePath,
        vscode.CompletionItemKind.File,
      );
      item.insertText = relativePath;
      // Replace only the value portion (not trailing comments)
      const valueStart = prefix.lastIndexOf("file:") + "file:".length;
      const whitespaceAfterColon =
        prefix.substring(valueStart).match(/^\s*/)?.[0] ?? " ";
      item.range = new vscode.Range(
        position.line,
        valueStart + whitespaceAfterColon.length,
        position.line,
        valueEnd,
      );
      return item;
    });
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

// --- Stage Preview Webview ---

function getWebviewContent(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
): string {
  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, "dist", "webview.js"),
  );
  const nonce = getNonce();
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; img-src ${webview.cspSource} data:; font-src ${webview.cspSource};">
  <style>
    :root {
      --viewer-sidebar-width: 280px;
      --stagebook-primary: #3b82f6;
      --stagebook-primary-hover: #2563eb;
      --stagebook-text: #1f2937;
      --stagebook-text-secondary: #374151;
      --stagebook-text-muted: #6b7280;
      --stagebook-text-faint: #9ca3af;
      --stagebook-border: #d1d5db;
      --stagebook-bg-muted: #f9fafb;
      --stagebook-bg-track: #e5e7eb;
      --stagebook-prompt-max-width: 36rem;
      --stagebook-prompt-text-size: 1rem;
      --stagebook-prompt-line-height: 1.5;
      --stagebook-prompt-h1-size: 1.875rem;
      --stagebook-prompt-h2-size: 1.5rem;
      --stagebook-prompt-h3-size: 1.25rem;
      --stagebook-prompt-h1-weight: 700;
      --stagebook-prompt-h2-weight: 600;
      --stagebook-prompt-h3-weight: 600;
      --stagebook-link: #2563eb;
      --stagebook-code-bg: rgba(0, 0, 0, 0.06);
      --stagebook-code-font: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      --stagebook-blockquote-border: #d1d5db;
      --stagebook-blockquote-bg: #f9fafb;
    }
    body {
      margin: 0;
      padding: 0;
      background-color: #ffffff;
      color: var(--stagebook-text);
      font-family: ui-sans-serif, system-ui, sans-serif;
      -webkit-font-smoothing: antialiased;
      font-size: 14px;
      line-height: 1.5;
    }
    /* Reset VS Code webview defaults */
    code, pre {
      font-family: var(--stagebook-code-font);
      background-color: var(--stagebook-code-bg);
      color: var(--stagebook-text);
    }
    pre {
      padding: 0.75rem 1rem;
      border-radius: 0.375rem;
      overflow-x: auto;
    }
    code {
      padding: 0.125rem 0.25rem;
      border-radius: 0.25rem;
      font-size: 0.875em;
    }
    /* Form resets */
    input[type="checkbox"], input[type="radio"] {
      appearance: none;
      width: 1rem; height: 1rem;
      border: 1px solid var(--stagebook-border);
      border-radius: 0.125rem;
      background-color: #fff;
      vertical-align: middle;
      cursor: pointer;
    }
    input[type="radio"] { border-radius: 9999px; }
    input[type="checkbox"]:checked, input[type="radio"]:checked {
      background-color: var(--stagebook-primary);
      border-color: var(--stagebook-primary);
      background-image: url("data:image/svg+xml,%3csvg viewBox='0 0 16 16' fill='white' xmlns='http://www.w3.org/2000/svg'%3e%3cpath d='M12.207 4.793a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0l-2-2a1 1 0 011.414-1.414L6.5 9.086l4.293-4.293a1 1 0 011.414 0z'/%3e%3c/svg%3e");
      background-size: 100% 100%; background-position: center; background-repeat: no-repeat;
    }
    input[type="radio"]:checked {
      background-image: url("data:image/svg+xml,%3csvg viewBox='0 0 16 16' fill='white' xmlns='http://www.w3.org/2000/svg'%3e%3ccircle cx='8' cy='8' r='3'/%3e%3c/svg%3e");
    }
    table { border-collapse: collapse; margin: 1rem 0; width: 100%; max-width: var(--stagebook-prompt-max-width); }
    th, td { border: 1px solid var(--stagebook-border); padding: 0.5rem 0.75rem; text-align: left; font-size: 0.875rem; }
    th { background-color: var(--stagebook-bg-muted); font-weight: 500; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}

function getNonce(): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let nonce = "";
  for (let i = 0; i < 32; i++) {
    nonce += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return nonce;
}

function parseTreatmentForPreview(source: string) {
  let obj: unknown;
  try {
    obj = parseYaml(source);
  } catch {
    return null;
  }
  if (typeof obj !== "object" || obj === null) return null;
  const record = obj as Record<string, unknown>;
  const templates = (record.templates ?? []) as unknown[];

  let expanded = record;
  if (templates.length > 0) {
    try {
      const { result } = fillTemplates({
        obj: record,
        templates,
        allowUnresolved: true,
      });
      expanded = result as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  const parsed = treatmentFileSchema.safeParse(expanded);
  if (!parsed.success) return null;
  return parsed.data;
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

  // Register file path quick-fix provider
  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider(
      "treatmentsYaml",
      new FilePathQuickFixProvider(),
      {
        providedCodeActionKinds:
          FilePathQuickFixProvider.providedCodeActionKinds,
      },
    ),
  );

  // Register file path autocomplete provider
  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      "treatmentsYaml",
      new FilePathCompletionProvider(),
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

  // Register stage preview webview command
  let previewPanel: vscode.WebviewPanel | undefined;
  // Mutable state updated on each command invocation — avoids stale closures
  let currentTreatment: ReturnType<typeof parseTreatmentForPreview> = null;
  let currentWorkspaceFolder: vscode.WorkspaceFolder | undefined;

  context.subscriptions.push(
    vscode.commands.registerCommand("stagebook.previewStage", () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || !isTreatmentsYaml(editor.document)) {
        vscode.window.showWarningMessage("Open a .treatments.yaml file first.");
        return;
      }

      const source = editor.document.getText();
      currentTreatment = parseTreatmentForPreview(source);
      if (!currentTreatment) {
        vscode.window.showErrorMessage(
          "Could not parse treatment file for preview.",
        );
        return;
      }

      currentWorkspaceFolder =
        vscode.workspace.getWorkspaceFolder(editor.document.uri) ??
        vscode.workspace.workspaceFolders?.[0];

      if (!currentWorkspaceFolder) {
        vscode.window.showErrorMessage(
          "No workspace folder found. Open a folder first.",
        );
        return;
      }

      if (previewPanel) {
        previewPanel.reveal(vscode.ViewColumn.Beside);
      } else {
        previewPanel = vscode.window.createWebviewPanel(
          "stagebook.stagePreview",
          "Stage Preview",
          vscode.ViewColumn.Beside,
          {
            enableScripts: true,
            localResourceRoots: [
              vscode.Uri.joinPath(context.extensionUri, "dist"),
              ...(vscode.workspace.workspaceFolders?.map((f) => f.uri) ?? []),
            ],
          },
        );
        previewPanel.onDidDispose(() => {
          previewPanel = undefined;
        });

        // Handle messages from the webview
        previewPanel.webview.onDidReceiveMessage(async (msg) => {
          if (
            msg.type === "ready" &&
            currentTreatment &&
            currentWorkspaceFolder
          ) {
            const baseUri = previewPanel!.webview
              .asWebviewUri(currentWorkspaceFolder.uri)
              .toString();
            previewPanel?.webview.postMessage({
              type: "treatment",
              treatmentFile: currentTreatment,
              introIndex: 0,
              treatmentIndex: 0,
              webviewBaseUri: baseUri,
            });
          } else if (msg.type === "readFile" && currentWorkspaceFolder) {
            // Guard against path traversal
            const filePath = String(msg.path);
            if (filePath.includes("..") || path.isAbsolute(filePath)) {
              previewPanel?.webview.postMessage({
                type: "fileContent",
                requestId: msg.requestId,
                error: `Invalid path: ${filePath}`,
              });
              return;
            }
            try {
              const fileUri = vscode.Uri.joinPath(
                currentWorkspaceFolder.uri,
                filePath,
              );
              const content = await vscode.workspace.fs.readFile(fileUri);
              previewPanel?.webview.postMessage({
                type: "fileContent",
                requestId: msg.requestId,
                content: new TextDecoder().decode(content),
              });
            } catch {
              previewPanel?.webview.postMessage({
                type: "fileContent",
                requestId: msg.requestId,
                error: `Failed to read: ${filePath}`,
              });
            }
          }
        });
      }

      previewPanel.webview.html = getWebviewContent(
        previewPanel.webview,
        context.extensionUri,
      );
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
