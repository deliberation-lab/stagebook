/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import React, { useRef } from "react";
import { useScoreContext } from "./ScoreProvider.js";
import { Element, type ElementConfig } from "./Element.js";
import { TimeConditionalRender } from "./conditions/TimeConditionalRender.js";
import { PositionConditionalRender } from "./conditions/PositionConditionalRender.js";
import { ConditionsConditionalRender } from "./conditions/ConditionsConditionalRender.js";
import { SubmissionConditionalRender } from "./conditions/SubmissionConditionalRender.js";
import { ScrollIndicator } from "./scroll/ScrollIndicator.js";
import { useScrollAwareness } from "./scroll/useScrollAwareness.js";
import type { DiscussionType } from "../schemas/treatment.js";

// Max-width per element type — wider for surveys/qualtrics/video
function maxWidthForElement(element: ElementConfig): string {
  switch (element.type) {
    case "survey":
    case "qualtrics":
      return "64rem"; // ~1024px
    case "video":
      return "56rem"; // ~896px
    default:
      return "42rem"; // ~672px
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
            data-testid={`element-${element.type}${element.name ? `-${element.name}` : ""}`}
            style={{
              margin: "0 auto",
              width: "100%",
              maxWidth: maxWidthForElement(element),
              padding: "0.5rem 1rem",
            }}
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

  // Scroll awareness — shows indicator when content overflows
  const discussionContentRef = useRef<HTMLDivElement>(null);
  const singleColumnRef = useRef<HTMLDivElement>(null);
  const { showIndicator: showDiscussionScrollIndicator } =
    useScrollAwareness(discussionContentRef);
  const { showIndicator: showSingleColumnScrollIndicator } =
    useScrollAwareness(singleColumnRef);

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
      <div
        style={{
          display: "flex",
          height: "100%",
          width: "100%",
          flexDirection: "row",
          alignItems: "stretch",
          gap: "1rem",
          paddingBottom: "1rem",
          paddingLeft: "1.5rem",
          paddingRight: "1.5rem",
          minHeight: "calc(100vh - 4rem)",
        }}
      >
        {/* Discussion column */}
        <div
          data-testid="discussion"
          style={{
            position: "relative",
            flex: 1,
            minWidth: "24rem",
            minHeight: "16rem",
          }}
        >
          {renderDiscussion(stage.discussion)}
        </div>

        {/* Elements column — scrollable independently */}
        <div
          ref={discussionContentRef}
          data-testid="stageContent"
          style={{
            width: "40vw",
            minWidth: "20rem",
            maxWidth: "48rem",
            overflowY: "auto",
            scrollBehavior: "smooth",
            alignSelf: "stretch",
          }}
        >
          {elementsColumn}
          <ScrollIndicator visible={showDiscussionScrollIndicator} />
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
              <div
                style={{
                  display: "flex",
                  height: "100%",
                  width: "100%",
                  flexDirection: "column",
                  paddingBottom: "0.5rem",
                  overflow: "auto",
                }}
              >
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
      <div
        ref={singleColumnRef}
        data-testid="stageContent"
        style={{
          display: "flex",
          height: "100%",
          width: "100%",
          flexDirection: "column",
          paddingBottom: "0.5rem",
          overflow: "auto",
        }}
      >
        {elementsColumn}
        <ScrollIndicator visible={showSingleColumnScrollIndicator} />
      </div>
    </SubmissionConditionalRender>
  );
}
