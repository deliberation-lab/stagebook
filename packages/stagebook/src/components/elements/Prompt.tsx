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
  /**
   * Slider points (numbers) parsed from the body section. Empty for
   * non-slider types. After #243 slider points and labels share the same
   * body lines (`- 50: Somewhat familiar`); upstream
   * `promptFileSchema.transform` splits them into `sliderPoints` (numbers)
   * and `responseItems` (labels) with the i'th index aligned across both.
   */
  sliderPoints?: number[];
  name: string;
  file?: string;
  shared?: boolean;
  value: unknown;
  save: (key: string, value: unknown, scope?: "player" | "shared") => void;
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
  sliderPoints,
  name,
  file,
  shared = false,
  value,
  save,
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
  // Per-type fields only exist on the discriminated-union branch where
  // they were declared (#243). Safely-narrowed lookups via the type tag.
  const rows = promptType === "openResponse" ? (metadata.rows ?? 5) : 5;
  const minLength =
    promptType === "openResponse" ? metadata.minLength : undefined;
  const maxLength =
    promptType === "openResponse" ? metadata.maxLength : undefined;
  // `shuffle` (renamed from `shuffleOptions` in #243) lives on
  // multipleChoice and listSorter. Sliders never shuffle — points and
  // labels share an i'th-position alignment that scrambling would break.
  const shouldShuffle =
    (promptType === "multipleChoice" || promptType === "listSorter") &&
    metadata.shuffle === true;

  // Initialize responses from responseItems (with optional shuffle)
  if (
    promptType !== "noResponse" &&
    responseItems.length > 0 &&
    (!responses.length ||
      !setEquality(new Set(responseItems), new Set(responses)))
  ) {
    if (shouldShuffle) {
      setResponses([...responseItems].sort(() => 0.5 - Math.random()));
    } else {
      setResponses(responseItems);
    }
  }

  const record = {
    ...metadata,
    name,
    file,
    shared,
    prompt: body,
    responses,
    debugMessages,
  };

  const saveData = useCallback(
    (newValue: unknown, recordData: typeof record) => {
      const updatedRecord = {
        ...recordData,
        value: newValue,
      };
      const scope = shared ? "shared" : "player";
      save(`prompt_${recordData.name}`, updatedRecord, scope);
    },
    [shared, save],
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
            layout={metadata.layout}
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
          layout={metadata.layout}
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
          labelPts={sliderPoints}
          labels={responses}
          value={value as number | undefined}
          onChange={(val) => debouncedSaveInteractive(val, record)}
        />
      )}
    </>
  );
}
