/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import React from "react";
import { useScoreContext } from "./ScoreProvider.js";
import { Element, type ElementConfig } from "./Element.js";
import { TimeConditionalRender } from "./conditions/TimeConditionalRender.js";
import { PositionConditionalRender } from "./conditions/PositionConditionalRender.js";
import { ConditionsConditionalRender } from "./conditions/ConditionsConditionalRender.js";
import { SubmissionConditionalRender } from "./conditions/SubmissionConditionalRender.js";
import type { DiscussionType } from "../schemas/treatment.js";

// Max-width per element type — wider for surveys/qualtrics/video
function layoutClassForElement(element: ElementConfig): string {
  switch (element.type) {
    case "survey":
    case "qualtrics":
      return "max-w-5xl";
    case "video":
      return "max-w-4xl";
    default:
      return "max-w-2xl";
  }
}

export interface StageConfig {
  name: string;
  duration?: number;
  elements: ElementConfig[];
  discussion?: DiscussionType;
}

export interface StageProps {
  stage: StageConfig;
  onSubmit: () => void;
}

function WrappedElement({
  element,
  onSubmit,
  stageDuration,
}: {
  element: ElementConfig;
  onSubmit: () => void;
  stageDuration?: number;
}) {
  const { getElapsedTime, position, resolve } = useScoreContext();

  return (
    <TimeConditionalRender
      displayTime={element.displayTime}
      hideTime={element.hideTime}
      getElapsedTime={getElapsedTime}
    >
      <PositionConditionalRender
        showToPositions={element.showToPositions as number[] | undefined}
        hideFromPositions={element.hideFromPositions as number[] | undefined}
        position={position}
      >
        <ConditionsConditionalRender
          conditions={(element.conditions as never[]) ?? []}
          resolve={resolve}
        >
          <div
            className={`mx-auto w-full px-4 py-2 ${layoutClassForElement(element)}`}
          >
            <Element
              element={element}
              onSubmit={onSubmit}
              stageDuration={stageDuration}
            />
          </div>
        </ConditionsConditionalRender>
      </PositionConditionalRender>
    </TimeConditionalRender>
  );
}

function ElementsColumn({
  elements,
  onSubmit,
  stageDuration,
}: {
  elements: ElementConfig[];
  onSubmit: () => void;
  stageDuration?: number;
}) {
  return (
    <>
      {elements.map((element, i) => (
        <WrappedElement
          key={element.name ?? `element-${i}`}
          element={element}
          onSubmit={onSubmit}
          stageDuration={stageDuration}
        />
      ))}
    </>
  );
}

// Check whether the current position should see the discussion
function positionAllowsDiscussion(
  discussion: DiscussionType | undefined,
  position: number | undefined,
): boolean {
  if (!discussion) return false;
  if (position === undefined) return false;

  const show = discussion.showToPositions;
  const hide = discussion.hideFromPositions;

  if (show && !show.includes(position)) return false;
  if (hide && hide.includes(position)) return false;

  return true;
}

export function Stage({ stage, onSubmit }: StageProps) {
  const ctx = useScoreContext();
  const { isSubmitted, playerCount, position, resolve, renderDiscussion } = ctx;

  const showDiscussion = positionAllowsDiscussion(stage.discussion, position);

  const elementsColumn = (
    <ElementsColumn
      elements={stage.elements}
      onSubmit={onSubmit}
      stageDuration={stage.duration}
    />
  );

  // Two-column layout: discussion on left, elements on right
  if (showDiscussion && renderDiscussion && stage.discussion) {
    const discussionConditions = stage.discussion.conditions;

    const discussionPage = (
      <div className="flex h-full w-full flex-col gap-4 pb-4 md:flex-row md:items-stretch md:px-6 md:min-h-[calc(100vh-4rem)]">
        {/* Discussion column */}
        <div className="relative w-full min-h-64 md:flex-1 md:min-w-96">
          {renderDiscussion(stage.discussion)}
        </div>

        {/* Elements column — scrollable independently */}
        <div className="w-full px-4 md:w-[40vw] md:min-w-80 md:max-w-3xl md:px-0 md:overflow-auto md:scroll-smooth md:self-stretch">
          {elementsColumn}
        </div>
      </div>
    );

    return (
      <SubmissionConditionalRender
        isSubmitted={isSubmitted}
        playerCount={playerCount}
      >
        {discussionConditions && discussionConditions.length > 0 ? (
          <ConditionsConditionalRender
            conditions={discussionConditions as never[]}
            resolve={resolve}
            fallback={
              <div className="flex h-full w-full flex-col pb-2 overflow-auto">
                {elementsColumn}
              </div>
            }
          >
            {discussionPage}
          </ConditionsConditionalRender>
        ) : (
          discussionPage
        )}
      </SubmissionConditionalRender>
    );
  }

  // Single-column layout: elements only
  return (
    <SubmissionConditionalRender
      isSubmitted={isSubmitted}
      playerCount={playerCount}
    >
      <div className="flex h-full w-full flex-col pb-2 overflow-auto">
        {elementsColumn}
      </div>
    </SubmissionConditionalRender>
  );
}
