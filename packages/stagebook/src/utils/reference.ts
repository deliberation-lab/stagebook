// Path segments that traverse into Object.prototype are rejected to prevent
// accidental exposure of inherited properties (e.g. `constructor`) via
// arbitrary reference strings. Read-only today, but the viewer's
// StateInspector combines path traversal with writes — defence in depth.
const DISALLOWED_PATH_SEGMENTS = new Set([
  "__proto__",
  "constructor",
  "prototype",
]);

export function getNestedValueByPath(
  obj: unknown,
  path: string[] = [],
): unknown {
  return path.reduce((acc: unknown, key: string) => {
    if (acc === null || acc === undefined) return undefined;
    if (DISALLOWED_PATH_SEGMENTS.has(key)) return undefined;
    return (acc as Record<string, unknown>)[key];
  }, obj);
}

export interface ReferenceKeyAndPath {
  referenceKey: string;
  path: string[];
}

export function getReferenceKeyAndPath(reference: string): ReferenceKeyAndPath {
  const segments = reference.split(".");
  const [type, ...rest] = segments;
  let name: string | undefined;
  let path: string[] = [];
  let referenceKey: string | undefined;

  if (["survey", "submitButton", "qualtrics", "timeline"].includes(type)) {
    [name, ...path] = rest;
    referenceKey = `${type}_${name}`;
  } else if (type === "prompt") {
    [name] = rest;
    referenceKey = `${type}_${name}`;
    path = ["value"];
  } else if (type === "trackedLink") {
    [name, ...path] = rest;
    referenceKey = `trackedLink_${name}`;
  } else if (
    ["urlParams", "connectionInfo", "browserInfo", "participantInfo"].includes(
      type,
    )
  ) {
    path = rest;
    referenceKey = type;
  } else if (type === "discussion") {
    [name, ...path] = rest;
    referenceKey = name;
  } else {
    throw new Error(`Invalid reference type: ${type}`);
  }

  if (
    !referenceKey ||
    (!name &&
      [
        "survey",
        "submitButton",
        "qualtrics",
        "timeline",
        "prompt",
        "trackedLink",
        "discussion",
      ].includes(type))
  ) {
    throw new Error(`Reference ${reference} is missing a name segment.`);
  }

  return { referenceKey, path };
}
