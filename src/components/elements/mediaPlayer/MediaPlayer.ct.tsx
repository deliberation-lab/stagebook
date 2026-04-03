import { test, expect } from "@playwright/experimental-ct-react";
import { MockMediaPlayer } from "../../testing/MockMediaPlayer.js";

// -- Rendering structure --

test("renders with correct ARIA region", async ({ mount }) => {
  const component = await mount(
    <MockMediaPlayer url="https://example.com/test.mp4" name="test" />,
  );
  const player = component.locator('[data-testid="mediaPlayer"]');
  await expect(player).toBeAttached();
  await expect(player).toHaveAttribute("role", "region");
  await expect(player).toHaveAttribute("aria-label", "Media player");
});

test("renders a video element for direct URL", async ({ mount }) => {
  const component = await mount(
    <MockMediaPlayer url="https://example.com/test.mp4" name="test" />,
  );
  await expect(
    component.locator('[data-testid="mediaPlayer-video"]'),
  ).toBeAttached();
});

test("renders an iframe for YouTube URL", async ({ mount }) => {
  const component = await mount(
    <MockMediaPlayer url="https://youtu.be/QC8iQqtG0hg" name="test" />,
  );
  await expect(
    component.locator('[data-testid="mediaPlayer-youtube"]'),
  ).toBeAttached();
  // No HTML5 video element
  await expect(
    component.locator('[data-testid="mediaPlayer-video"]'),
  ).not.toBeAttached();
});

// -- Controls visibility --

test("no controls shown when controls prop is omitted", async ({ mount }) => {
  const component = await mount(
    <MockMediaPlayer url="https://example.com/test.mp4" name="test" />,
  );
  await expect(
    component.locator('[data-testid="mediaPlayer-controls"]'),
  ).not.toBeAttached();
});

test("play/pause button shown when controls.playPause is true", async ({
  mount,
}) => {
  const component = await mount(
    <MockMediaPlayer
      url="https://example.com/test.mp4"
      name="test"
      controls={{ playPause: true }}
    />,
  );
  await expect(
    component.locator('[data-testid="mediaPlayer-playPause"]'),
  ).toBeVisible();
});

test("scrub bar shown when controls.seek is true", async ({ mount }) => {
  const component = await mount(
    <MockMediaPlayer
      url="https://example.com/test.mp4"
      name="test"
      controls={{ seek: true }}
    />,
  );
  await expect(
    component.locator('[data-testid="mediaPlayer-scrubBar"]'),
  ).toBeVisible();
});

test("speed button shown when controls.speed is true", async ({ mount }) => {
  const component = await mount(
    <MockMediaPlayer
      url="https://example.com/test.mp4"
      name="test"
      controls={{ speed: true }}
    />,
  );
  await expect(
    component.locator('[data-testid="mediaPlayer-speed"]'),
  ).toBeVisible();
});

test("no controls shown when syncToStageTime is true", async ({ mount }) => {
  const component = await mount(
    <MockMediaPlayer
      url="https://example.com/test.mp4"
      name="test"
      syncToStageTime={true}
      controls={{ playPause: true, seek: true }}
    />,
  );
  await expect(
    component.locator('[data-testid="mediaPlayer-controls"]'),
  ).not.toBeAttached();
});

// -- playVideo: false (audio-only mode) --

test("video element is hidden when playVideo is false", async ({ mount }) => {
  const component = await mount(
    <MockMediaPlayer
      url="https://example.com/discussion.mp4"
      name="test"
      playVideo={false}
    />,
  );
  // Video element present for audio but not visible
  const video = component.locator('[data-testid="mediaPlayer-video"]');
  await expect(video).toBeAttached();
  await expect(video).not.toBeVisible();
});

// -- Data recording --

test("save is called with play event data when video plays", async ({
  mount,
}) => {
  const component = await mount(
    <MockMediaPlayer url="https://example.com/test.mp4" name="test_vid" />,
  );

  await component
    .locator('[data-testid="mediaPlayer-video"]')
    .evaluate((el) => el.dispatchEvent(new Event("play")));

  const log = component.locator('[data-testid="save-log"]');
  const raw = await log.textContent();
  const saves = JSON.parse(raw ?? "[]") as Array<{
    key: string;
    value: unknown;
  }>;

  expect(saves).toHaveLength(1);
  expect(saves[0].key).toBe("mediaPlayer_test_vid");
  const record = saves[0].value as {
    events: Array<{
      type: string;
      videoTime: number;
      stageTimeElapsed: number;
    }>;
  };
  expect(record.events).toHaveLength(1);
  expect(record.events[0].type).toBe("play");
  expect(typeof record.events[0].videoTime).toBe("number");
  expect(typeof record.events[0].stageTimeElapsed).toBe("number");
});

test("save is called with pause event data when video pauses", async ({
  mount,
}) => {
  const component = await mount(
    <MockMediaPlayer url="https://example.com/test.mp4" name="test_vid" />,
  );

  await component
    .locator('[data-testid="mediaPlayer-video"]')
    .evaluate((el) => el.dispatchEvent(new Event("pause")));

  const log = component.locator('[data-testid="save-log"]');
  const raw = await log.textContent();
  const saves = JSON.parse(raw ?? "[]") as Array<{
    key: string;
    value: unknown;
  }>;

  expect(saves).toHaveLength(1);
  const record = saves[0].value as {
    events: Array<{ type: string }>;
  };
  expect(record.events[0].type).toBe("pause");
});

test("save log accumulates multiple events", async ({ mount }) => {
  const component = await mount(
    <MockMediaPlayer url="https://example.com/test.mp4" name="test_vid" />,
  );

  const video = component.locator('[data-testid="mediaPlayer-video"]');
  await video.evaluate((el) => el.dispatchEvent(new Event("play")));
  await video.evaluate((el) => el.dispatchEvent(new Event("pause")));

  const raw = await component.locator('[data-testid="save-log"]').textContent();
  const saves = JSON.parse(raw ?? "[]") as Array<{
    key: string;
    value: unknown;
  }>;

  // Two saves, each containing the full record up to that point
  expect(saves).toHaveLength(2);
  const lastRecord = saves[1].value as {
    events: Array<{ type: string }>;
  };
  expect(lastRecord.events).toHaveLength(2);
  expect(lastRecord.events[0].type).toBe("play");
  expect(lastRecord.events[1].type).toBe("pause");
});

// -- submitOnComplete --

test("onComplete not called when submitOnComplete is false", async ({
  mount,
}) => {
  const component = await mount(
    <MockMediaPlayer
      url="https://example.com/test.mp4"
      name="test"
      submitOnComplete={false}
    />,
  );

  await component
    .locator('[data-testid="mediaPlayer-video"]')
    .evaluate((el) => el.dispatchEvent(new Event("ended")));

  const completed = await component
    .locator('[data-testid="completed"]')
    .textContent();
  expect(completed).toBe("false");
});

test("onComplete called when submitOnComplete is true and video ends", async ({
  mount,
}) => {
  const component = await mount(
    <MockMediaPlayer
      url="https://example.com/test.mp4"
      name="test"
      submitOnComplete={true}
    />,
  );

  await component
    .locator('[data-testid="mediaPlayer-video"]')
    .evaluate((el) => el.dispatchEvent(new Event("ended")));

  const completed = await component
    .locator('[data-testid="completed"]')
    .textContent();
  expect(completed).toBe("true");
});
