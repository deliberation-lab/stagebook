import { useEffect } from "react";

export interface AudioElementProps {
  src: string;
}

export function AudioElement({ src }: AudioElementProps) {
  useEffect(() => {
    if (!src) return undefined;

    const sound = new Audio(src);

    const handleCanPlay = () => {
      sound.play().catch((err) => {
        console.warn("[AudioElement] Play failed:", err);
      });
    };

    sound.addEventListener("canplaythrough", handleCanPlay);

    return () => {
      sound.removeEventListener("canplaythrough", handleCanPlay);
      sound.pause();
      sound.src = "";
    };
  }, [src]);

  return null;
}
