import React from "react";
import { Button } from "../form/Button.js";

export interface SubmitButtonProps {
  onSubmit: () => void;
  name: string;
  buttonText?: string;
  save: (key: string, value: unknown) => void;
  getElapsedTime: () => number;
}

export function SubmitButton({
  onSubmit,
  name,
  buttonText = "Next",
  save,
  getElapsedTime,
}: SubmitButtonProps) {
  const handleClick = () => {
    save(`submitButton_${name}`, { time: getElapsedTime() });
    onSubmit();
  };

  return (
    <div className="mt-4">
      <Button onClick={handleClick}>{buttonText}</Button>
    </div>
  );
}
