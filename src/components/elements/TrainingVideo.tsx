import React, { useState, useEffect } from "react";
import { Button } from "../form/Button.js";
import { Loading } from "../form/Loading.js";

export interface TrainingVideoProps {
  url: string;
  getElapsedTime: () => number;
  onComplete: () => void;
  setAllowIdle?: (allow: boolean) => void;
  save?: (key: string, value: unknown) => void;
  name?: string;
}

export function TrainingVideo({
  url,
  getElapsedTime,
  onComplete,
  setAllowIdle,
  save,
  name,
}: TrainingVideoProps) {
  const [elapsedOnLoad, setElapsedOnLoad] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const key = `video_${name ?? url}`;

  // Allow idle while video is playing
  useEffect(() => {
    setAllowIdle?.(true);
    return () => setAllowIdle?.(false);
  }, [setAllowIdle]);

  useEffect(() => {
    const testAudio = new Audio("1sec_silence.mp3");
    const promise = testAudio.play();
    if (promise !== undefined) {
      promise
        .then(() => {
          setPlaying(true);
          console.log(`[TrainingVideo] Autoplay succeeded: ${url}`);
          save?.(key, { event: "autoplaySucceeded", url });
        })
        .catch(() => {
          setPlaying(false);
          console.warn(`[TrainingVideo] Autoplay blocked: ${url}`);
          save?.(key, { event: "autoplayBlocked", url });
        });
    }

    const rawElapsed = getElapsedTime();
    let timeElapsed = Math.floor(rawElapsed);
    if (timeElapsed < 5) {
      timeElapsed = 0;
    }
    setElapsedOnLoad(timeElapsed);
  }, []);

  const handleManualPlay = () => {
    setPlaying(true);
    console.log(`[TrainingVideo] Manual play: ${url}`);
    save?.(key, { event: "manualPlay", url });
  };

  const handleEnded = () => {
    console.log(`[TrainingVideo] Video ended: ${url}`);
    save?.(key, { event: "ended", url });
    const delay = setTimeout(() => onComplete(), 1000);
    return () => clearTimeout(delay);
  };

  return (
    <div
      data-testid="trainingVideo-wrapper"
      data-state={playing ? "playing" : "blocked"}
      style={{ textAlign: "center" }}
    >
      <h4>Please take a moment to watch the following video</h4>

      {!playing && (
        <div style={{ textAlign: "center" }}>
          <h4>Video is hidden on page refresh.</h4>
          <Button onClick={handleManualPlay}>
            Click to continue the video
          </Button>
        </div>
      )}

      {playing && (
        <div
          data-testid="trainingVideo"
          style={{
            minWidth: "24rem",
            maxHeight: "85vh",
            aspectRatio: "16/9",
            position: "relative",
            margin: "0 auto",
          }}
        >
          {elapsedOnLoad !== null ? (
            <video
              src={url}
              autoPlay={playing}
              onEnded={handleEnded}
              style={{ width: "100%", height: "100%", pointerEvents: "none" }}
            >
              <track kind="captions" />
            </video>
          ) : (
            <Loading />
          )}
        </div>
      )}
    </div>
  );
}
