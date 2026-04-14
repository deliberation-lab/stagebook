import * as vscode from "vscode";

const diagnosticCollection =
  vscode.languages.createDiagnosticCollection("stagebook");

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

function validateTreatmentFile(_document: vscode.TextDocument): void {
  // TODO (#75): validate with stagebook's treatmentFileSchema
  // TODO (#74): map Zod error paths to YAML source positions
}

function validatePromptFile(_document: vscode.TextDocument): void {
  // TODO (#76): validate with stagebook's promptFileSchema
}

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(diagnosticCollection);

  // Validate the active document on activation
  if (vscode.window.activeTextEditor) {
    validateDocument(vscode.window.activeTextEditor.document);
  }

  // Validate on open
  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument((document) => {
      validateDocument(document);
    }),
  );

  // Validate on edit
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((event) => {
      validateDocument(event.document);
    }),
  );

  // Validate on editor focus change
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor) {
        validateDocument(editor.document);
      }
    }),
  );
}

export function deactivate(): void {
  diagnosticCollection.dispose();
}
