import React, { useState } from "react";
import { SubmitButton } from "../elements/SubmitButton.js";

export interface MockSubmitButtonProps {
  name?: string;
  buttonText?: string;
  elapsedTime?: number;
}

export function MockSubmitButton({
  name = "testSubmit",
  buttonText,
  elapsedTime = 42.5,
}: MockSubmitButtonProps) {
  const [submitted, setSubmitted] = useState(false);
  const [savedData, setSavedData] = useState<{
    key: string;
    value: unknown;
  } | null>(null);

  return (
    <div>
      <SubmitButton
        onSubmit={() => setSubmitted(true)}
        name={name}
        buttonText={buttonText}
        save={(key, value) => setSavedData({ key, value })}
        getElapsedTime={() => elapsedTime}
      />
      <div data-testid="submit-submitted" style={{ display: "none" }}>
        {submitted ? "true" : "false"}
      </div>
      <div data-testid="submit-saved-key" style={{ display: "none" }}>
        {savedData?.key ?? ""}
      </div>
      <div data-testid="submit-saved-value" style={{ display: "none" }}>
        {savedData ? JSON.stringify(savedData.value) : ""}
      </div>
    </div>
  );
}
