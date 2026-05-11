/**
 * Pre-hydration semantic checks.
 *
 * Runs on the merged source (root file + loaded imports) before any
 * template expansion. Catches a class of authoring errors that would
 * otherwise:
 *   - throw a generic mid-hydration error far from the actual fix site
 *     ("Template not found"), or
 *   - cause an infinite loop / stack overflow during hydration, or
 *   - silently produce wrong output that surprises the user at runtime.
 *
 * In scope for this module:
 *   1. Unknown template name — every `template: X` invocation references
 *      a template defined in this file or its imports.
 *   2. Circular template invocations — no template-A-invokes-B-invokes-A
 *      cycles.
 *
 * Parameterized invocations (e.g. `template: ${arm}_pre`) are skipped:
 * their concrete identity depends on call-site bindings that aren't
 * known until hydration. Falsely flagging them would false-positive on
 * every broadcast-driven file; conversely, a parameterized invocation
 * that doesn't resolve at runtime surfaces as a clear hydration error.
 *
 * Position-free by design — issues carry JSON paths into the original
 * source. The consumer (in-editor validator) maps those paths to YAML
 * positions via its own AST mapper. Mirrors `validateReferences.ts`.
 *
 * See #321 for the broader validation pipeline this is part of.
 */

export type Path = (string | number)[];

export interface PreHydrationIssue {
  code: "unknown-template" | "circular-template";
  message: string;
  path: Path;
}

export interface PreHydrationInput {
  /** Parsed root file object. */
  root: Record<string, unknown>;
  /** Templates contributed by imports (post-`resolveImports`), or empty. */
  importedTemplates?: unknown[];
}

const FIELD_PLACEHOLDER_REGEX = /\$\{[a-zA-Z0-9_]+\}/;

function hasFieldPlaceholder(s: string): boolean {
  return FIELD_PLACEHOLDER_REGEX.test(s);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function templateName(template: unknown): string | undefined {
  if (!isRecord(template)) return undefined;
  const name = template.name;
  return typeof name === "string" && name.length > 0 ? name : undefined;
}

/** Walk `node` rooted at `path`, calling `visit` for every record. */
function walkRecords(
  node: unknown,
  path: Path,
  visit: (record: Record<string, unknown>, path: Path) => void,
): void {
  if (Array.isArray(node)) {
    node.forEach((item, i) => walkRecords(item, [...path, i], visit));
    return;
  }
  if (!isRecord(node)) return;
  visit(node, path);
  for (const [key, value] of Object.entries(node)) {
    walkRecords(value, [...path, key], visit);
  }
}

export function collectPreHydrationIssues({
  root,
  importedTemplates = [],
}: PreHydrationInput): PreHydrationIssue[] {
  const issues: PreHydrationIssue[] = [];

  // Build the set of known template names from root + imports. Both
  // sources contribute equally; the host's import-loading + merging step
  // (`resolveImports`) has already vetted for duplicates by the time we
  // get here.
  const rootTemplates = Array.isArray(root.templates) ? root.templates : [];
  const knownNames = new Set<string>();
  for (const tmpl of rootTemplates) {
    const name = templateName(tmpl);
    if (name !== undefined) knownNames.add(name);
  }
  for (const tmpl of importedTemplates) {
    const name = templateName(tmpl);
    if (name !== undefined) knownNames.add(name);
  }

  // Pass 1: every `template: X` invocation must resolve. Skip
  // parameterized names (they're handled at hydration).
  walkRecords(root, [], (record, path) => {
    const tName = record.template;
    if (typeof tName !== "string") return;
    if (hasFieldPlaceholder(tName)) return;
    if (knownNames.has(tName)) return;
    issues.push({
      code: "unknown-template",
      message: `Template '${tName}' is not defined in this file or its imports.`,
      path: [...path, "template"],
    });
  });

  // Pass 2: cycle detection over the static call graph.
  //
  // For each template T, find every `template: X` invocation in T's
  // body where X is a known concrete name. That's the edge T → X.
  // Run depth-first search and emit one issue per detected cycle.
  // Parameterized invocations don't contribute edges (we can't know
  // their target statically).
  const adjacency = new Map<string, Set<string>>();
  const collectEdgesFor = (source: unknown): void => {
    const from = templateName(source);
    if (from === undefined) return;
    const targets = new Set<string>();
    const content = isRecord(source) ? source.content : undefined;
    walkRecords(content, [], (record) => {
      const tName = record.template;
      if (typeof tName !== "string") return;
      if (hasFieldPlaceholder(tName)) return;
      if (!knownNames.has(tName)) return;
      targets.add(tName);
    });
    adjacency.set(from, targets);
  };
  for (const source of rootTemplates) collectEdgesFor(source);
  for (const source of importedTemplates) collectEdgesFor(source);

  const reportedCycleSignatures = new Set<string>();
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const stack: string[] = [];

  function dfs(node: string): void {
    if (visited.has(node)) return;
    if (visiting.has(node)) {
      // Found a back edge — extract the cycle slice from the stack.
      const cycleStart = stack.indexOf(node);
      const cycle = stack.slice(cycleStart);
      reportCycle(cycle);
      return;
    }
    visiting.add(node);
    stack.push(node);
    const neighbors = adjacency.get(node);
    if (neighbors) {
      for (const n of neighbors) dfs(n);
    }
    stack.pop();
    visiting.delete(node);
    visited.add(node);
  }

  function reportCycle(cycle: string[]): void {
    // Normalize the cycle so the same loop reported via different starts
    // doesn't surface as multiple issues.
    const sorted = [...cycle].sort();
    const signature = sorted.join("→");
    if (reportedCycleSignatures.has(signature)) return;
    reportedCycleSignatures.add(signature);

    // Locate the first edge in the cycle inside the root file so the
    // diagnostic points at something the user can edit. If the cycle
    // is entirely inside imported templates, fall back to the root
    // file's first invocation of the first cycle node.
    const head = cycle[0];
    const next = cycle.length > 1 ? cycle[1] : cycle[0];
    const cyclePath = locateCycleAnchorPath(root, head, next);

    const description =
      cycle.length === 1
        ? `Template '${head}' invokes itself.`
        : `Templates form an invocation cycle: ${[...cycle, head].join(" → ")}.`;
    issues.push({
      code: "circular-template",
      message: `${description} Hydration would loop indefinitely — break the cycle by removing one of the invocations.`,
      path: cyclePath,
    });
  }

  for (const name of adjacency.keys()) dfs(name);

  return issues;
}

/**
 * Find a source path for a cycle diagnostic. Prefer a location in the
 * root file (the user's editable surface) over imports.
 */
function locateCycleAnchorPath(
  root: Record<string, unknown>,
  head: string,
  next: string,
): Path {
  let firstHeadInvocation: Path | undefined;
  let edgeWithinHead: Path | undefined;

  walkRecords(root, [], (record, path) => {
    if (record.template === head && firstHeadInvocation === undefined) {
      firstHeadInvocation = [...path, "template"];
    }
  });

  const rootTemplates = Array.isArray(root.templates) ? root.templates : [];
  rootTemplates.forEach((tmpl, i) => {
    if (templateName(tmpl) !== head) return;
    const content = isRecord(tmpl) ? tmpl.content : undefined;
    walkRecords(content, [], (record, path) => {
      if (record.template === next && edgeWithinHead === undefined) {
        edgeWithinHead = ["templates", i, "content", ...path, "template"];
      }
    });
  });

  return edgeWithinHead ?? firstHeadInvocation ?? ["templates"];
}
