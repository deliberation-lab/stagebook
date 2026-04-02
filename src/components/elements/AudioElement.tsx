import { useEffect } from "react";

export interface AudioElementProps {
  src: string;
  save?: (key: string, value: unknown) => void;
  name?: string;
}

export function AudioElement({ src, save, name }: AudioElementProps) {
  useEffect(() => {
    if (!src) return undefined;

    const key = `audio_${name ?? src}`;
    const sound = new Audio(src);

    const handleCanPlay = () => {
      sound
        .play()
        .then(() => {
          console.log(`[AudioElement] Playing: ${src}`);
          save?.(key, { event: "play", src });
        })
        .catch((err: Error) => {
          console.warn(`[AudioElement] Play failed: ${src}`, err.message);
          save?.(key, { event: "playFailed", src, error: err.message });
        });
    };

    sound.addEventListener("canplaythrough", handleCanPlay);

    return () => {
      sound.removeEventListener("canplaythrough", handleCanPlay);
      sound.pause();
      sound.src = "";
    };
  }, [src, save, name]);

  return null;
}
