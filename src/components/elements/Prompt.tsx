import React, { useState, useCallback, useRef } from "react";
import { Markdown } from "../form/Markdown.js";
import { RadioGroup } from "../form/RadioGroup.js";
import { CheckboxGroup } from "../form/CheckboxGroup.js";
import { TextArea, type DebugMessage } from "../form/TextArea.js";
import { Slider } from "../form/Slider.js";
import { ListSorter } from "../form/ListSorter.js";
import type { MetadataType } from "../../schemas/promptFile.js";

function setEquality(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  return Array.from(a).every((item) => b.has(item));
}

export interface PromptProps {
  metadata: MetadataType;
  body: string;
  responseItems: string[];
  name: string;
  shared?: boolean;
  value: unknown;
  progressLabel: string;
  permalink?: string;
  save: (key: string, value: unknown, scope?: "player" | "shared") => void;
  getElapsedTime: () => number;
  resolveURL?: (path: string) => string;
  renderSharedNotepad?: (config: {
    padName: string;
    defaultText?: string;
    rows?: number;
  }) => React.ReactNode;
}

export function Prompt({
  metadata,
  body,
  responseItems,
  name,
  shared = false,
  value,
  progressLabel,
  permalink,
  save,
  getElapsedTime,
  resolveURL,
  renderSharedNotepad,
}: PromptProps) {
  const [responses, setResponses] = useState<string[]>([]);
  const [debugMessages, setDebugMessages] = useState<DebugMessage[]>([]);
  const debounceTextRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debounceInteractiveRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const promptType = metadata.type;
  const rows = metadata.rows ?? 5;
  const minLength = metadata.minLength ?? undefined;
  const maxLength = metadata.maxLength ?? undefined;

  // Initialize responses from responseItems (with optional shuffle)
  if (
    promptType !== "noResponse" &&
    responseItems.length > 0 &&
    (!responses.length ||
      !setEquality(new Set(responseItems), new Set(responses)))
  ) {
    if (metadata.shuffleOptions) {
      setResponses([...responseItems].sort(() => 0.5 - Math.random()));
    } else {
      setResponses(responseItems);
    }
  }

  const record = {
    ...metadata,
    permalink,
    name,
    shared,
    step: progressLabel,
    prompt: body,
    responses,
    debugMessages,
  };

  const saveData = useCallback(
    (newValue: unknown, recordData: typeof record) => {
      const updatedRecord = {
        ...recordData,
        value: newValue,
        stageTimeElapsed: getElapsedTime(),
      };
      const scope = shared ? "shared" : "player";
      save(`prompt_${recordData.name}`, updatedRecord, scope);
    },
    [shared, save, getElapsedTime],
  );

  const debouncedSaveText = useCallback(
    (newValue: unknown, recordData: typeof record) => {
      if (debounceTextRef.current) clearTimeout(debounceTextRef.current);
      debounceTextRef.current = setTimeout(
        () => saveData(newValue, recordData),
        2000,
      );
    },
    [saveData],
  );

  const debouncedSaveInteractive = useCallback(
    (newValue: unknown, recordData: typeof record) => {
      if (debounceInteractiveRef.current)
        clearTimeout(debounceInteractiveRef.current);
      debounceInteractiveRef.current = setTimeout(
        () => saveData(newValue, recordData),
        50,
      );
    },
    [saveData],
  );

  return (
    <>
      <Markdown text={body} resolveURL={resolveURL} />

      {promptType === "multipleChoice" &&
        (metadata.select === "single" || metadata.select === undefined) && (
          <RadioGroup
            options={responses.map((choice) => ({
              key: choice,
              value: choice,
            }))}
            value={value as string | undefined}
            onChange={(e) => debouncedSaveInteractive(e.target.value, record)}
          />
        )}

      {promptType === "multipleChoice" && metadata.select === "multiple" && (
        <CheckboxGroup
          options={responses.map((choice) => ({
            key: choice,
            value: choice,
          }))}
          value={(value as string[]) ?? []}
          onChange={(newSelection) =>
            debouncedSaveInteractive(newSelection, record)
          }
        />
      )}

      {promptType === "openResponse" && !shared && (
        <TextArea
          defaultText={responses.join("\n")}
          onChange={(val) => debouncedSaveText(val, record)}
          onDebugMessage={(message) =>
            setDebugMessages((prev) => [...prev, message])
          }
          value={value as string | undefined}
          rows={rows}
          showCharacterCount={!!(minLength || maxLength)}
          minLength={minLength}
          maxLength={maxLength}
        />
      )}

      {promptType === "openResponse" &&
        shared &&
        renderSharedNotepad?.({
          padName: name,
          defaultText: responses.join("\n"),
          rows,
        })}

      {promptType === "listSorter" && (
        <ListSorter
          items={(value as string[]) ?? responses}
          onChange={(newOrder) => debouncedSaveInteractive(newOrder, record)}
        />
      )}

      {promptType === "slider" && (
        <Slider
          min={metadata.min}
          max={metadata.max}
          interval={metadata.interval}
          labelPts={metadata.labelPts}
          labels={responses}
          value={value as number | undefined}
          onChange={(val) => debouncedSaveInteractive(val, record)}
        />
      )}
    </>
  );
}
