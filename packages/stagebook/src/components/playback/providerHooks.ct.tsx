import { test, expect } from "@playwright/experimental-ct-react";
import {
  NotFoundStory,
  RegisteredHandleStory,
  WrongNameStory,
  UnmountStory,
  MediaPlayerInProviderStory,
} from "./playbackStories.js";
import { MockMediaPlayer } from "../testing/MockMediaPlayer.js";

test("usePlayback returns not-found before anything is registered", async ({
  mount,
}) => {
  const component = await mount(<NotFoundStory />);
  await expect(component.locator('[data-testid="status"]')).toContainText(
    "not-found",
  );
});

test("usePlayback finds handle registered by useRegisterPlayback", async ({
  mount,
}) => {
  const component = await mount(<RegisteredHandleStory />);
  await expect(component.locator('[data-testid="status"]')).toContainText(
    "found",
  );
  await expect(component.locator('[data-testid="currentTime"]')).toContainText(
    "5",
  );
  await expect(component.locator('[data-testid="duration"]')).toContainText(
    "30",
  );
});

test("usePlayback returns not-found for a different name", async ({
  mount,
}) => {
  const component = await mount(<WrongNameStory />);
  await expect(component.locator('[data-testid="status"]')).toContainText(
    "not-found",
  );
});

test("handle is unregistered when registrar unmounts", async ({ mount }) => {
  const component = await mount(<UnmountStory show={true} />);
  await expect(component.locator('[data-testid="status"]')).toContainText(
    "found",
  );
  await component.update(<UnmountStory show={false} />);
  await expect(component.locator('[data-testid="status"]')).toContainText(
    "not-found",
  );
});

test("useRegisterPlayback is safe without a PlaybackProvider", async ({
  mount,
}) => {
  const component = await mount(
    <MockMediaPlayer url="https://example.com/test.mp4" name="solo" />,
  );
  await expect(component.locator('[data-testid="mediaPlayer"]')).toBeAttached();
});

test("MediaPlayer registers its handle in the PlaybackProvider", async ({
  mount,
}) => {
  const component = await mount(<MediaPlayerInProviderStory />);
  await expect(component.locator('[data-testid="present"]')).toContainText(
    "yes",
  );
});
