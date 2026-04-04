/* eslint-disable @typescript-eslint/unbound-method */
import React from "react";
import { useScoreContext, useTextContent } from "./ScoreProvider.js";
import { promptFileSchema } from "../schemas/promptFile.js";
import { Separator } from "./form/Separator.js";
import { Display } from "./elements/Display.js";
import { SubmitButton } from "./elements/SubmitButton.js";
import { AudioElement } from "./elements/AudioElement.js";
import { ImageElement } from "./elements/ImageElement.js";
import { KitchenTimer } from "./elements/KitchenTimer.js";
import { TrackedLink, type ResolvedParam } from "./elements/TrackedLink.js";
import { TrainingVideo } from "./elements/TrainingVideo.js";
import { Prompt } from "./elements/Prompt.js";
import { Qualtrics } from "./elements/Qualtrics.js";
import { Loading } from "./form/Loading.js";

// Resolve URL params for TrackedLink using the ScoreProvider's resolve
function useResolvedParams(
  urlParams:
    | Array<{
        key: string;
        value?: unknown;
        reference?: string;
        position?: string;
      }>
    | undefined,
  resolve: (ref: string, pos?: string) => unknown[],
): ResolvedParam[] {
  if (!urlParams) return [];
  return urlParams.map((param) => {
    if (!param.reference) {
      return {
        key: param.key,
        value:
          param.value == null
            ? ""
            : String(param.value as string | number | boolean),
      };
    }
    const values = resolve(param.reference, param.position);
    const picked = values.find((v) => v !== undefined);
    return {
      key: param.key,
      value: picked == null ? "" : String(picked as string | number | boolean),
    };
  });
}

export interface ElementConfig {
  type: string;
  name?: string;
  file?: string;
  style?: "" | "thin" | "regular" | "thick";
  reference?: string;
  position?: string;
  shared?: boolean;
  buttonText?: string;
  url?: string;
  displayText?: string;
  urlParams?: Array<{
    key: string;
    value?: unknown;
    reference?: string;
    position?: string;
  }>;
  width?: number;
  startTime?: number;
  endTime?: number;
  displayTime?: number;
  hideTime?: number;
  warnTimeRemaining?: number;
  surveyName?: string;
  [key: string]: unknown;
}

export interface ElementProps {
  element: ElementConfig;
  onSubmit: () => void;
  stageDuration?: number;
}

export function Element({ element, onSubmit, stageDuration }: ElementProps) {
  const ctx = useScoreContext();
  const {
    resolve,
    save,
    getElapsedTime,
    getAssetURL,
    progressLabel,
    renderSharedNotepad,
    renderDiscussion,
    renderTalkMeter,
    renderSurvey,
    playerId,
    setAllowIdle,
  } = ctx;

  // Wrap save to add consistent metadata to every element's saved data
  const wrappedSave = React.useCallback(
    (key: string, value: unknown, scope?: "player" | "shared") => {
      const enriched =
        value !== null && typeof value === "object" && !Array.isArray(value)
          ? {
              ...value,
              step: progressLabel,
              stageTimeElapsed: getElapsedTime(),
            }
          : value;
      save(key, enriched, scope);
    },
    [save, progressLabel, getElapsedTime],
  );

  // For prompt elements, load the file content
  const promptFile = element.type === "prompt" ? element.file : undefined;
  const {
    data: promptMarkdown,
    isLoading: promptLoading,
    error: promptError,
  } = useTextContent(promptFile ?? "");

  const resolvedParams = useResolvedParams(
    element.type === "trackedLink" ? element.urlParams : undefined,
    resolve,
  );

  switch (element.type) {
    case "audio":
      return (
        <AudioElement
          src={getAssetURL(element.file ?? "")}
          save={wrappedSave}
          name={element.name ?? element.file}
        />
      );

    case "display": {
      const ref = element.reference ?? `prompt.${element.name}`;
      const values = resolve(ref, element.position);
      return (
        <Display reference={ref} position={element.position} values={values} />
      );
    }

    case "image":
      return (
        <ImageElement
          src={getAssetURL(element.file ?? "")}
          width={element.width}
        />
      );

    case "prompt": {
      if (promptError) {
        return (
          <p style={{ color: "#dc2626", fontSize: "0.875rem" }}>
            Error loading prompt: {promptError.message}
          </p>
        );
      }
      if (promptLoading || !promptMarkdown) {
        return <Loading />;
      }
      const parsed = promptFileSchema.safeParse(promptMarkdown);
      if (!parsed.success) {
        return (
          <p
            style={{
              color: "var(--score-danger, #dc2626)",
              fontSize: "0.875rem",
            }}
          >
            Error parsing prompt: {parsed.error.issues[0]?.message}
          </p>
        );
      }
      const { metadata, body, responseItems } = parsed.data;
      const promptName =
        element.name ?? `${progressLabel}_${metadata.name ?? element.file}`;

      // Read current value from state
      const scope = element.shared ? "shared" : "player";
      const currentValues = resolve(`prompt.${promptName}`, scope);
      const currentValue = currentValues[0];

      return (
        <Prompt
          metadata={metadata}
          body={body}
          responseItems={responseItems}
          name={promptName}
          file={element.file}
          shared={element.shared}
          value={currentValue}
          save={wrappedSave}
          resolveURL={getAssetURL}
          renderSharedNotepad={renderSharedNotepad}
        />
      );
    }

    case "separator":
      return <Separator style={element.style} />;

    case "submitButton": {
      const buttonName = element.name ?? progressLabel;
      return (
        <SubmitButton
          onSubmit={onSubmit}
          name={buttonName}
          buttonText={element.buttonText}
          save={wrappedSave}
        />
      );
    }

    case "timer":
      return (
        <KitchenTimer
          startTime={element.startTime ?? element.displayTime ?? 0}
          endTime={element.endTime ?? element.hideTime ?? stageDuration ?? 0}
          warnTimeRemaining={element.warnTimeRemaining}
          getElapsedTime={getElapsedTime}
        />
      );

    case "video":
      return (
        <TrainingVideo
          url={element.url ?? ""}
          getElapsedTime={getElapsedTime}
          onComplete={onSubmit}
          setAllowIdle={setAllowIdle}
          save={wrappedSave}
          name={element.name}
        />
      );

    case "trackedLink":
      return (
        <TrackedLink
          name={element.name ?? ""}
          url={element.url ?? ""}
          displayText={element.displayText ?? ""}
          resolvedParams={resolvedParams}
          save={wrappedSave}
          getElapsedTime={getElapsedTime}
          progressLabel={progressLabel}
          setAllowIdle={setAllowIdle}
        />
      );

    case "talkMeter":
      return renderTalkMeter?.() ?? null;

    case "sharedNotepad":
      return (
        renderSharedNotepad?.({
          padName: element.name ?? "",
        }) ?? null
      );

    case "qualtrics": {
      const qualtricsParams = useResolvedParams(element.urlParams, resolve);
      return (
        <Qualtrics
          url={element.url ?? ""}
          resolvedParams={qualtricsParams}
          participantId={playerId}
          save={wrappedSave}
          onComplete={onSubmit}
        />
      );
    }

    case "survey": {
      const surveyName = element.surveyName ?? "";
      const surveyKey = element.name ?? surveyName;
      return (
        renderSurvey?.({
          surveyName,
          onComplete: (results: unknown) => {
            wrappedSave(`survey_${surveyKey}`, results);
            onSubmit();
          },
        }) ?? null
      );
    }

    case "discussion":
      return renderDiscussion?.(element as never) ?? null;

    default:
      console.warn(`Unknown element type: ${element.type}`);
      return null;
  }
}
