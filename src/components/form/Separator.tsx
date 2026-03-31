import React from "react";

export interface SeparatorProps {
  style?: "" | "thin" | "regular" | "thick";
}

export function Separator({ style = "" }: SeparatorProps) {
  return (
    <div>
      {style === "thin" && <hr className="h-1px my-4 w-full bg-gray-400" />}
      {(style === "" || style === "regular") && (
        <hr className="h-3px my-4 w-full bg-gray-400" />
      )}
      {style === "thick" && <hr className="h-5px my-4 w-full bg-gray-500" />}
    </div>
  );
}
