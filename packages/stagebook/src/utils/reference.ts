export function getNestedValueByPath(
  obj: unknown,
  path: string[] = [],
): unknown {
  return path.reduce(
    (acc: unknown, key: string) =>
      acc !== null && acc !== undefined
        ? (acc as Record<string, unknown>)[key]
        : undefined,
    obj,
  );
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
  } else if (["urlParams", "connectionInfo", "browserInfo"].includes(type)) {
    path = rest;
    referenceKey = type;
  } else if (["participantInfo", "discussion"].includes(type)) {
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
        "participantInfo",
        "discussion",
      ].includes(type))
  ) {
    throw new Error(`Reference ${reference} is missing a name segment.`);
  }

  return { referenceKey, path };
}
