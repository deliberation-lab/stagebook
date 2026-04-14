import React from "react";

interface SkeletonPlaceholderProps {
  type: string;
  config?: Record<string, unknown>;
}

export function SkeletonPlaceholder({
  type,
  config,
}: SkeletonPlaceholderProps) {
  const labels: Record<string, string> = {
    discussion:
      "Discussion element — requires live session with multiple participants",
    survey: "Survey element — requires external survey platform",
    sharedNotepad:
      "Shared notepad — requires live session with multiple participants",
    talkMeter: "Talk meter — requires live audio session",
    qualtrics: "Qualtrics survey — requires external integration",
  };

  const label = labels[type] ?? `${type} — platform-coupled element`;

  return (
    <div style={containerStyle}>
      <div style={iconStyle}>&#9641;</div>
      <p style={labelStyle}>{label}</p>
      {config && Object.keys(config).length > 0 && (
        <details style={detailsStyle}>
          <summary style={summaryStyle}>Configuration</summary>
          <pre style={preStyle}>{JSON.stringify(config, null, 2)}</pre>
        </details>
      )}
    </div>
  );
}

/**
 * Create the platform-coupled renderer functions for the mock context.
 */
export function createSkeletonRenderers() {
  return {
    renderDiscussion: (config: Record<string, unknown>) => (
      <SkeletonPlaceholder type="discussion" config={config} />
    ),
    renderSurvey: (config: {
      surveyName: string;
      onComplete: (results: unknown) => void;
    }) => (
      <SkeletonPlaceholder
        type="survey"
        config={{ surveyName: config.surveyName }}
      />
    ),
    renderSharedNotepad: (config: { padName: string }) => (
      <SkeletonPlaceholder
        type="sharedNotepad"
        config={{ padName: config.padName }}
      />
    ),
    renderTalkMeter: () => <SkeletonPlaceholder type="talkMeter" />,
  };
}

// --- Styles ---

const containerStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "0.5rem",
  padding: "2rem",
  border: "2px dashed #d1d5db",
  borderRadius: "0.5rem",
  backgroundColor: "#f9fafb",
  minHeight: "8rem",
};

const iconStyle: React.CSSProperties = {
  fontSize: "1.5rem",
  color: "#9ca3af",
};

const labelStyle: React.CSSProperties = {
  fontSize: "0.8125rem",
  color: "#6b7280",
  textAlign: "center" as const,
  margin: 0,
};

const detailsStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: "24rem",
};

const summaryStyle: React.CSSProperties = {
  fontSize: "0.75rem",
  color: "#9ca3af",
  cursor: "pointer",
};

const preStyle: React.CSSProperties = {
  fontSize: "0.6875rem",
  color: "#6b7280",
  backgroundColor: "white",
  padding: "0.5rem",
  borderRadius: "0.25rem",
  border: "1px solid #e5e7eb",
  overflow: "auto",
  maxHeight: "10rem",
};
