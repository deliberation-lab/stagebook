import { test, expect } from "@playwright/experimental-ct-react";
import { AudioElement } from "./AudioElement";

test("renders nothing visually (audio is invisible)", async ({ mount }) => {
  const component = await mount(
    <AudioElement src="https://example.com/chime.mp3" />,
  );
  // AudioElement renders null — no visible output
  await expect(component).toBeAttached();
});
