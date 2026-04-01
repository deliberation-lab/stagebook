import React, { useState, useEffect } from "react";
import { Button } from "../form/Button.js";
import { Loading } from "../form/Loading.js";

export interface TrainingVideoProps {
  url: string;
  getElapsedTime: () => number;
  onComplete: () => void;
  setAllowIdle?: (allow: boolean) => void;
}

export function TrainingVideo({
  url,
  getElapsedTime,
  onComplete,
  setAllowIdle,
}: TrainingVideoProps) {
  const [elapsedOnLoad, setElapsedOnLoad] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);

  // Allow idle while video is playing (participant is watching, not interacting)
  useEffect(() => {
    setAllowIdle?.(true);
    return () => setAllowIdle?.(false);
  }, [setAllowIdle]);

  useEffect(() => {
    // Test if autoplay will work
    const testAudio = new Audio("1sec_silence.mp3");
    const promise = testAudio.play();
    if (promise !== undefined) {
      promise
        .then(() => {
          setPlaying(true);
        })
        .catch(() => {
          setPlaying(false);
        });
    }

    const rawElapsed = getElapsedTime();
    let timeElapsed = Math.floor(rawElapsed);
    if (timeElapsed < 5) {
      timeElapsed = 0;
    }
    setElapsedOnLoad(timeElapsed);
  }, []);

  const handleEnded = () => {
    const delay = setTimeout(() => onComplete(), 1000);
    return () => clearTimeout(delay);
  };

  return (
    <div className="text-center">
      <h4>Please take a moment to watch the following video</h4>

      {!playing && (
        <div className="text-center">
          <h4>Video is hidden on page refresh.</h4>
          <Button onClick={() => setPlaying(true)}>
            Click to continue the video
          </Button>
        </div>
      )}

      {playing && (
        <div
          className="min-w-sm max-h-[85vh] aspect-video relative mx-auto"
          data-element="trainingVideo"
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
