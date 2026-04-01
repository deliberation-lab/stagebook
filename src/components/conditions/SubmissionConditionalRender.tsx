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
        <div className="text-center">
          <Loading />
        </div>
      );
    }
    return (
      <div className="text-center text-gray-400 pointer-events-none">
        Please wait for other participant(s) to finish this stage.
      </div>
    );
  }

  return <>{children}</>;
}
