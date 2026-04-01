import React, { useCallback, useEffect, useMemo, useRef } from "react";

function ExternalLinkIcon() {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <path d="M11.5 2a.75.75 0 0 0 0 1.5h3.19L9.97 8.22a.75.75 0 1 0 1.06 1.06l4.72-4.72v3.19a.75.75 0 0 0 1.5 0V2.75A.75.75 0 0 0 16.5 2h-5z" />
      <path d="M5.25 4A2.25 2.25 0 0 0 3 6.25v8.5A2.25 2.25 0 0 0 5.25 17h8.5A2.25 2.25 0 0 0 16 14.75V11.5a.75.75 0 0 0-1.5 0v3.25c0 .414-.336.75-.75.75h-8.5a.75.75 0 0 1-.75-.75v-8.5c0-.414.336-.75.75-.75H9.5a.75.75 0 0 0 0-1.5H5.25z" />
    </svg>
  );
}

export interface ResolvedParam {
  key: string;
  value: string;
}

export interface TrackedLinkProps {
  name: string;
  url: string;
  displayText: string;
  resolvedParams?: ResolvedParam[];
  save: (key: string, value: unknown) => void;
  getElapsedTime: () => number;
  progressLabel: string;
}

interface LinkEvent {
  type: string;
  timestamp: number;
  stage: string;
  stageTimeSeconds: number;
  timeAwaySeconds?: number;
}

interface LinkRecord {
  name: string;
  url: string;
  displayText: string;
  events: LinkEvent[];
  totalTimeAwaySeconds: number;
  lastEventType?: string;
  lastTimeAwaySeconds?: number;
  lastUpdated?: number;
}

export function TrackedLink({
  name,
  url,
  displayText,
  resolvedParams = [],
  save,
  getElapsedTime,
  progressLabel,
}: TrackedLinkProps) {
  const awayTrackerRef = useRef<{ startedAt: number; clickAt: number } | null>(
    null,
  );
  const lastClickRef = useRef<number | null>(null);
  const recordRef = useRef<LinkRecord>({
    name,
    url,
    displayText,
    events: [],
    totalTimeAwaySeconds: 0,
  });
  const recordKey = `trackedLink_${name}`;

  const buildEvent = useCallback(
    (type: string, extra: Record<string, unknown> = {}): LinkEvent => ({
      type,
      timestamp: Date.now(),
      stage: progressLabel,
      stageTimeSeconds: getElapsedTime(),
      ...extra,
    }),
    [getElapsedTime, progressLabel],
  );

  const logEvent = useCallback(
    (type: string, extra?: Record<string, unknown>) => {
      const event = buildEvent(type, extra);
      const prev = recordRef.current;
      const updatedEvents = [...prev.events, event];
      const totalTimeAwaySeconds =
        prev.totalTimeAwaySeconds + (event.timeAwaySeconds ?? 0);

      const updated: LinkRecord = {
        ...prev,
        events: updatedEvents,
        lastEventType: event.type,
        lastTimeAwaySeconds: event.timeAwaySeconds ?? prev.lastTimeAwaySeconds,
        totalTimeAwaySeconds,
        lastUpdated: event.timestamp,
      };
      recordRef.current = updated;
      save(recordKey, updated);
    },
    [buildEvent, recordKey, save],
  );

  const href = useMemo(() => {
    if (!resolvedParams.length) return url;
    const params = new URLSearchParams();
    resolvedParams.forEach(({ key, value }) => {
      params.append(key, value ?? "");
    });
    const queryString = params.toString();
    if (!queryString) return url;
    return url.includes("?")
      ? `${url}&${queryString}`
      : `${url}?${queryString}`;
  }, [resolvedParams, url]);

  const handleClick = useCallback(() => {
    lastClickRef.current = Date.now();
    logEvent("click");
  }, [logEvent]);

  const handleBlur = useCallback(() => {
    if (awayTrackerRef.current || !lastClickRef.current) return;
    awayTrackerRef.current = {
      startedAt: Date.now(),
      clickAt: lastClickRef.current,
    };
    lastClickRef.current = null;
    logEvent("blur");
  }, [logEvent]);

  const handleFocus = useCallback(() => {
    const awayContext = awayTrackerRef.current;
    if (awayContext) {
      awayTrackerRef.current = null;
      const timeAwaySeconds = (Date.now() - awayContext.startedAt) / 1000;
      logEvent("focus", { timeAwaySeconds });
    } else {
      logEvent("focus");
    }
  }, [logEvent]);

  useEffect(() => {
    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);
    return () => {
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
    };
  }, [handleBlur, handleFocus]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
      <a
        href={href}
        target="_blank"
        rel="noreferrer noopener"
        onClick={handleClick}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.5rem",
          color: "var(--score-primary, #3b82f6)",
          fontWeight: 600,
          textDecoration: "none",
        }}
      >
        <span>{displayText}</span>
        <ExternalLinkIcon />
      </a>
      <p
        style={{
          fontSize: "0.75rem",
          color: "var(--score-text-muted, #6b7280)",
          margin: 0,
        }}
      >
        Link opens in a new tab. Return to this tab to complete the study.
      </p>
    </div>
  );
}
