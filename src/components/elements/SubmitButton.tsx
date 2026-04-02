import React from "react";
import { Button } from "../form/Button.js";

export interface SubmitButtonProps {
  onSubmit: () => void;
  name: string;
  buttonText?: string;
  save: (key: string, value: unknown) => void;
}

export function SubmitButton({
  onSubmit,
  name,
  buttonText = "Next",
  save,
}: SubmitButtonProps) {
  const handleClick = () => {
    save(`submitButton_${name}`, {});
    onSubmit();
  };

  return (
    <div style={{ marginTop: "1rem" }}>
      <Button onClick={handleClick} data-testid="submitButton">
        {buttonText}
      </Button>
    </div>
  );
}
