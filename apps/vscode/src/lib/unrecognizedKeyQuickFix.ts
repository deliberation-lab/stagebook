import * as vscode from "vscode";

/**
 * Match the rich "Unrecognized key 'X' on …. Did you mean 'Y'? …"
 * diagnostic produced by stagebook's `safeParseTreatmentFile` wrapper
 * (#123). The first capture group is the bad key; the second is the
 * suggested replacement. We parse from the message text because VS
 * Code's `Diagnostic` doesn't carry the structured `issue.params` —
 * adding an out-of-band channel would be more brittle than parsing a
 * fixed-format string that the same package owns end-to-end.
 *
 * Exported so unit tests can validate the regex matches the messages
 * stagebook emits.
 */
export const UNRECOGNIZED_KEY_DID_YOU_MEAN_RE =
  /^Unrecognized key '([^']+)' on [^.]+\. Did you mean '([^']+)'\?/;

/**
 * Quick-fix provider that offers a "Change to 'X'" action for each
 * `safeParseTreatmentFile` diagnostic that includes a suggestion. The
 * diagnostic's range already points at the bad key (the wrapper
 * appends the bad key to the issue path before `validateTreatment`
 * resolves it), so we just replace the diagnostic's range with the
 * suggestion.
 */
export class UnrecognizedKeyQuickFixProvider
  implements vscode.CodeActionProvider
{
  static readonly providedCodeActionKinds = [vscode.CodeActionKind.QuickFix];

  provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range,
  ): vscode.CodeAction[] {
    const diagnostics = vscode.languages
      .getDiagnostics(document.uri)
      .filter(
        (d) =>
          d.source === "stagebook" &&
          UNRECOGNIZED_KEY_DID_YOU_MEAN_RE.test(d.message) &&
          d.range.intersection(range),
      );

    const actions: vscode.CodeAction[] = [];
    for (const diagnostic of diagnostics) {
      const match = UNRECOGNIZED_KEY_DID_YOU_MEAN_RE.exec(diagnostic.message);
      if (!match) continue;
      const [, , suggestion] = match;

      const action = new vscode.CodeAction(
        `Change to '${suggestion}'`,
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
