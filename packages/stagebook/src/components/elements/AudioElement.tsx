import { useEffect, useRef } from "react";

export interface AudioElementProps {
  src: string;
  save?: (key: string, value: unknown) => void;
  name?: string;
}

export function AudioElement({ src, save, name }: AudioElementProps) {
  // Ref `save` so the effect below isn't torn down and re-set up whenever
  // the parent passes a fresh save callback (#105).
  const saveRef = useRef(save);
  saveRef.current = save;

  useEffect(() => {
    if (!src) return undefined;

    const key = `audio_${name ?? src}`;
    const sound = new Audio(src);

    const handleCanPlay = () => {
      sound
        .play()
        .then(() => {
          console.log(`[AudioElement] Playing: ${src}`);
          saveRef.current?.(key, { event: "play", src });
        })
        .catch((err: Error) => {
          console.warn(`[AudioElement] Play failed: ${src}`, err.message);
          saveRef.current?.(key, {
            event: "playFailed",
            src,
            error: err.message,
          });
        });
    };

    sound.addEventListener("canplaythrough", handleCanPlay);

    return () => {
      sound.removeEventListener("canplaythrough", handleCanPlay);
      sound.pause();
      sound.src = "";
    };
  }, [src, name]);

  return null;
}
