/**
 * Renders two buttons side by side — one default, one with theme override.
 * Makes the color difference visually obvious in the Playwright UI.
 */
import React from "react";
import { Button } from "../form/Button.js";

export function SideBySideButtons() {
  return (
    <div style={{ display: "flex", gap: "1rem", padding: "2rem" }}>
      <style>{`
        .orange-theme {
          --score-primary: #ea580c !important;
        }
      `}</style>
      <div>
        <p
          style={{
            marginBottom: "0.5rem",
            fontSize: "0.75rem",
            color: "#6b7280",
          }}
        >
          Default theme (blue)
        </p>
        <Button>Default Blue</Button>
      </div>
      <div className="orange-theme">
        <p
          style={{
            marginBottom: "0.5rem",
            fontSize: "0.75rem",
            color: "#6b7280",
          }}
        >
          Overridden theme (orange)
        </p>
        <Button>Custom Orange</Button>
      </div>
    </div>
  );
}
