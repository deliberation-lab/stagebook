import React, { useRef, useCallback, useEffect } from "react";
import { isYouTubeURL } from "./mediaPlayer/isYouTubeURL.js";

export interface VideoEvent {
  type: "play" | "pause" | "ended";
  videoTime: number;
  stageTimeElapsed: number;
}

interface VideoRecord {
  name: string;
  url: string;
  startAt?: number;
  stopAt?: number;
  events: VideoEvent[];
  lastVideoTime: number;
}

export interface MediaPlayerProps {
  name: string;
  url: string;
  save: (key: string, value: unknown) => void;
  getElapsedTime: () => number;
  onComplete?: () => void;
  syncToStageTime?: boolean;
  submitOnComplete?: boolean;
  playVideo?: boolean;
  playAudio?: boolean;
  captionsURL?: string;
  startAt?: number;
  stopAt?: number;
  allowScrubOutsideBounds?: boolean;
  frameRate?: number;
  controls?: {
    playPause?: boolean;
    seek?: boolean;
    frameStep?: boolean;
    speed?: boolean;
  };
}

export function MediaPlayer({
  name,
  url,
  save,
  getElapsedTime,
  onComplete,
  syncToStageTime = false,
  submitOnComplete = false,
  playVideo = true,
  playAudio = true,
  startAt,
  stopAt,
  controls,
}: MediaPlayerProps) {
  const youtubeVideoId = isYouTubeURL(url);
  const saveKey = `mediaPlayer_${name}`;

  // Event log accumulated over the session
  const eventsRef = useRef<VideoEvent[]>([]);

  const recordEvent = useCallback(
    (type: VideoEvent["type"], videoTime: number) => {
      const event: VideoEvent = {
        type,
        videoTime,
        stageTimeElapsed: getElapsedTime(),
      };
      eventsRef.current = [...eventsRef.current, event];

      const record: VideoRecord = {
        name,
        url,
        ...(startAt !== undefined && { startAt }),
        ...(stopAt !== undefined && { stopAt }),
        events: eventsRef.current,
        lastVideoTime: videoTime,
      };
      save(saveKey, record);
    },
    [getElapsedTime, name, url, startAt, stopAt, save, saveKey],
  );

  const handlePlay = useCallback(
    (e: React.SyntheticEvent<HTMLVideoElement>) => {
      recordEvent("play", e.currentTarget.currentTime);
    },
    [recordEvent],
  );

  const handlePause = useCallback(
    (e: React.SyntheticEvent<HTMLVideoElement>) => {
      recordEvent("pause", e.currentTarget.currentTime);
    },
    [recordEvent],
  );

  const handleEnded = useCallback(
    (e: React.SyntheticEvent<HTMLVideoElement>) => {
      recordEvent("ended", e.currentTarget.currentTime);
      if (submitOnComplete) {
        onComplete?.();
      }
    },
    [recordEvent, submitOnComplete, onComplete],
  );

  // Determine which controls to show
  const showControls =
    !syncToStageTime &&
    controls !== undefined &&
    (controls.playPause || controls.seek || controls.speed);

  // syncToStageTime: seek to elapsed time on mount
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (syncToStageTime && videoRef.current) {
      const target = getElapsedTime() + (startAt ?? 0);
      videoRef.current.currentTime = target;
    }
  }, []);

  if (youtubeVideoId) {
    const embedUrl = `https://www.youtube.com/embed/${youtubeVideoId}?enablejsapi=1`;
    return (
      <div
        data-testid="mediaPlayer"
        role="region"
        aria-label="Media player"
        style={{ position: "relative" }}
      >
        <div data-testid="mediaPlayer-viewport">
          <iframe
            data-testid="mediaPlayer-youtube"
            src={embedUrl}
            allow="autoplay; encrypted-media"
            allowFullScreen
            style={{ width: "100%", aspectRatio: "16/9", border: "none" }}
            title="Media player"
          />
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="mediaPlayer"
      role="region"
      aria-label="Media player"
      style={{ position: "relative" }}
    >
      <div data-testid="mediaPlayer-viewport" style={{ position: "relative" }}>
        <video
          ref={videoRef}
          data-testid="mediaPlayer-video"
          src={url}
          muted={!playAudio}
          onPlay={handlePlay}
          onPause={handlePause}
          onEnded={handleEnded}
          style={{
            width: "100%",
            aspectRatio: "16/9",
            display: playVideo ? undefined : "none",
          }}
        >
          <track kind="captions" />
        </video>

        {showControls && (
          <div
            data-testid="mediaPlayer-controls"
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              padding: "0.5rem",
              background: "rgba(0,0,0,0.5)",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            {controls?.playPause && (
              <button
                data-testid="mediaPlayer-playPause"
                aria-label="Play / Pause"
                style={{ minWidth: 44, minHeight: 44 }}
                onClick={() => {
                  const v = videoRef.current;
                  if (!v) return;
                  if (v.paused) void v.play();
                  else v.pause();
                }}
              >
                ▶
              </button>
            )}

            {controls?.seek && (
              <input
                data-testid="mediaPlayer-scrubBar"
                type="range"
                role="slider"
                aria-label="Seek"
                aria-valuemin={startAt ?? 0}
                aria-valuemax={stopAt ?? 0}
                aria-valuenow={0}
                style={{ flex: 1 }}
              />
            )}

            {controls?.speed && (
              <button
                data-testid="mediaPlayer-speed"
                aria-label="Playback speed"
                style={{ minWidth: 44, minHeight: 44 }}
              >
                1.0x
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
