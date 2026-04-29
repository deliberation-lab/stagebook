/**
 * Wrapper around `TrackedLink` that captures every `save` call and renders
 * the resulting saves into a hidden `data-testid="save-log"` div as JSON.
 * Component tests read this back to assert event semantics + accumulated
 * `totalTimeAwaySeconds` (issue #232).
 */
import React, { useState } from "react";
import {
  TrackedLink,
  type TrackedLinkProps,
} from "../elements/TrackedLink.js";

export function MockTrackedLink(props: Omit<TrackedLinkProps, "save">) {
  const [saves, setSaves] = useState<{ key: string; value: unknown }[]>([]);
  return (
    <>
      <TrackedLink
        {...props}
        save={(key, value) => setSaves((prev) => [...prev, { key, value }])}
      />
      <div data-testid="save-log" style={{ display: "none" }}>
        {JSON.stringify(saves)}
      </div>
    </>
  );
}
