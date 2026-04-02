import React, { useState } from "react";
import { SubmitButton } from "../elements/SubmitButton.js";

export interface MockSubmitButtonProps {
  name?: string;
  buttonText?: string;
}

export function MockSubmitButton({
  name = "testSubmit",
  buttonText,
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
