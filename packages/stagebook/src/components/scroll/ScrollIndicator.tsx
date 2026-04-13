import React from "react";

export interface ScrollIndicatorProps {
  visible: boolean;
}

export function ScrollIndicator({ visible }: ScrollIndicatorProps) {
  if (!visible) return null;

  return (
    <>
      <style>{`
        @keyframes scrollIndicatorFadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes scrollIndicatorPulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.05); opacity: 0.85; }
        }
      `}</style>
      <div
        style={{
          position: "sticky",
          bottom: 0,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          padding: "0.75rem",
          pointerEvents: "none",
          zIndex: 50,
          animation: "scrollIndicatorFadeIn 0.3s ease-out",
        }}
        aria-hidden="true"
        data-testid="scroll-indicator"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="40"
          height="40"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            backgroundColor: "rgba(229, 231, 235, 0.8)",
            color: "#4b5563",
            borderRadius: "9999px",
            padding: "0.5rem",
            boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
            backdropFilter: "blur(4px)",
            animation: "scrollIndicatorPulse 2s ease-in-out infinite",
          }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>
    </>
  );
}
