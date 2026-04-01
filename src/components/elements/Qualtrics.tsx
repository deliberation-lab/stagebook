import React, { useEffect, useMemo } from "react";

export interface ResolvedParam {
  key: string;
  value: string;
}

export interface QualtricsProps {
  url: string;
  resolvedParams?: ResolvedParam[];
  participantId?: string;
  groupId?: string;
  progressLabel: string;
  save: (key: string, value: unknown) => void;
  onComplete: () => void;
}

export function Qualtrics({
  url,
  resolvedParams = [],
  participantId = "",
  groupId = "",
  progressLabel,
  save,
  onComplete,
}: QualtricsProps) {
  // Listen for Qualtrics end-of-survey message.
  // Validates origin to prevent spoofed messages from non-Qualtrics sources.
  // Checks *.qualtrics.com to handle datacenter redirects.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      // Validate origin — only accept messages from Qualtrics domains
      try {
        const originHost = new URL(event.origin).hostname;
        if (!originHost.endsWith("qualtrics.com")) return;
      } catch {
        return;
      }

      const data: unknown = event.data;
      if (typeof data === "string" && data.startsWith("QualtricsEOS")) {
        const [, surveyId, sessionId] = data.split("|");
        save("qualtricsDataReady", {
          step: progressLabel,
          surveyURL: url,
          surveyId,
          sessionId,
        });
        onComplete();
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [url, progressLabel, save, onComplete]);

  // Build the full URL with resolved params + standard identifiers
  const fullURL = useMemo(() => {
    const urlObj = new URL(url);
    resolvedParams.forEach(({ key, value }) =>
      urlObj.searchParams.append(key, value),
    );
    if (participantId) {
      urlObj.searchParams.append("deliberationId", participantId);
    }
    if (groupId) {
      urlObj.searchParams.append("sampleId", groupId);
    }
    return urlObj.toString();
  }, [url, resolvedParams, participantId, groupId]);

  return (
    <div
      style={{
        height: "100%",
        minWidth: "800px",
        maxWidth: "56rem",
        overflowX: "auto",
      }}
    >
      <iframe
        title={`qualtrics_${url}`}
        src={fullURL}
        style={{
          position: "relative",
          height: "100%",
          minHeight: "100vh",
          width: "100%",
          border: "none",
        }}
      />
    </div>
  );
}
