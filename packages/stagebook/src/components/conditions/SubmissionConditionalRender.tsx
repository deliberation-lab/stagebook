import React from "react";
import { Loading } from "../form/Loading.js";

export interface SubmissionConditionalRenderProps {
  isSubmitted: boolean;
  playerCount: number | undefined;
  children: React.ReactNode;
}

export function SubmissionConditionalRender({
  isSubmitted,
  playerCount,
  children,
}: SubmissionConditionalRenderProps) {
  if (isSubmitted) {
    if (!playerCount || playerCount <= 1) {
      return (
        <div
          data-testid="submission-state"
          data-state="loading"
          style={{ textAlign: "center" }}
        >
          <Loading />
        </div>
      );
    }
    return (
      <div
        data-testid="submission-state"
        data-state="waiting"
        style={{ textAlign: "center", color: "#9ca3af", pointerEvents: "none" }}
      >
        Please wait for other participant(s) to finish this stage.
      </div>
    );
  }

  return <>{children}</>;
}
