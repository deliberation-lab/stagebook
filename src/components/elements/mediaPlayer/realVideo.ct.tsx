/**
 * Real-video integration tests for MediaPlayer.
 *
 * These tests load an actual MP4 file via the Vite dev server (which DOES
 * advertise Accept-Ranges: bytes) and exercise seek/step behavior end-to-end.
 *
 * They cover the full pipeline: browser fetch → decode → seek → timeupdate,
 * which is the layer where the bug from issue #32 actually lives.
 */
import { test, expect } from "@playwright/experimental-ct-react";
import { MockMediaPlayer } from "../../testing/MockMediaPlayer.js";

// Served by Vite from /public — see playwright-ct.config.ts.
const FIXTURE_VIDEO = "/sample-video.mp4";

test("real video: loadedmetadata fires and duration is set", async ({
  mount,
}) => {
  const component = await mount(
    <MockMediaPlayer
      url={FIXTURE_VIDEO}
      name="test"
      controls={{ playPause: true, seek: true }}
    />,
  );
  const video = component.locator('[data-testid="mediaPlayer-video"]');
  await expect
    .poll(async () => video.evaluate((el: HTMLVideoElement) => el.readyState))
    .toBeGreaterThanOrEqual(1);
  const duration = await video.evaluate((el: HTMLVideoElement) => el.duration);
  expect(duration).toBeGreaterThan(0);
  expect(Number.isFinite(duration)).toBe(true);
});

test("real video: clicking seekForward advances currentTime by 1s", async ({
  mount,
}) => {
  const component = await mount(
    <MockMediaPlayer
      url={FIXTURE_VIDEO}
      name="test"
      controls={{ seek: true }}
    />,
  );
  const video = component.locator('[data-testid="mediaPlayer-video"]');
  // Wait for metadata
  await expect
    .poll(async () => video.evaluate((el: HTMLVideoElement) => el.readyState))
    .toBeGreaterThanOrEqual(1);

  await component.locator('[data-testid="mediaPlayer-seekForward"]').click();
  // Wait for the seek to settle (browser fires seeked event)
  await expect
    .poll(async () =>
      video.evaluate((el: HTMLVideoElement) => Math.round(el.currentTime)),
    )
    .toBe(1);
});

test("real video: clicking seekForward twice then seekBack returns to 1s", async ({
  mount,
}) => {
  const component = await mount(
    <MockMediaPlayer
      url={FIXTURE_VIDEO}
      name="test"
      controls={{ seek: true }}
    />,
  );
  const video = component.locator('[data-testid="mediaPlayer-video"]');
  await expect
    .poll(async () => video.evaluate((el: HTMLVideoElement) => el.readyState))
    .toBeGreaterThanOrEqual(1);

  await component.locator('[data-testid="mediaPlayer-seekForward"]').click();
  await expect
    .poll(async () =>
      video.evaluate((el: HTMLVideoElement) => Math.round(el.currentTime)),
    )
    .toBe(1);

  await component.locator('[data-testid="mediaPlayer-seekForward"]').click();
  await expect
    .poll(async () =>
      video.evaluate((el: HTMLVideoElement) => Math.round(el.currentTime)),
    )
    .toBe(2);

  await component.locator('[data-testid="mediaPlayer-seekBack"]').click();
  await expect
    .poll(async () =>
      video.evaluate((el: HTMLVideoElement) => Math.round(el.currentTime)),
    )
    .toBe(1);
});

test("real video: stepForward advances by stepDuration", async ({ mount }) => {
  const component = await mount(
    <MockMediaPlayer
      url={FIXTURE_VIDEO}
      name="test"
      controls={{ step: true }}
      stepDuration={0.5}
    />,
  );
  const video = component.locator('[data-testid="mediaPlayer-video"]');
  await expect
    .poll(async () => video.evaluate((el: HTMLVideoElement) => el.readyState))
    .toBeGreaterThanOrEqual(1);

  await component.locator('[data-testid="mediaPlayer-stepForward"]').click();
  await expect
    .poll(async () =>
      video.evaluate((el: HTMLVideoElement) => el.currentTime > 0),
    )
    .toBe(true);
});

// -- Server-side range-request misconfiguration ----------------------------
//
// Reproduces the bug from issue #32: when the asset server returns 200 OK with
// the full body and NO Accept-Ranges header, browsers reject any seek by
// silently snapping currentTime back to 0. SCORE's seek() correctly assigns
// currentTime; the browser undoes it. SCORE should detect this and warn so
// integrators don't waste time debugging the wrong layer.

// -- Load failure fallback --------------------------------------------------

test("renders an error placeholder when the video fails to load", async ({
  mount,
}) => {
  // Point at a URL that will 404 — Vite serves nothing under /missing/.
  const component = await mount(
    <MockMediaPlayer
      url="/missing/no-such-video.mp4"
      name="test"
      controls={{ playPause: true, seek: true }}
    />,
  );
  const error = component.locator('[data-testid="mediaPlayer-error"]');
  await expect(error).toBeVisible();
  await expect(error).toContainText("Video unavailable");
  // Controls should be hidden when load fails
  await expect(
    component.locator('[data-testid="mediaPlayer-controls"]'),
  ).toHaveCount(0);
});

test("audio-only renders an error placeholder when the audio fails to load", async ({
  mount,
}) => {
  const component = await mount(
    <MockMediaPlayer
      url="/missing/no-such-audio.mp4"
      name="test"
      playVideo={false}
      controls={{ playPause: true, seek: true }}
    />,
  );
  const error = component.locator('[data-testid="mediaPlayer-error"]');
  await expect(error).toBeVisible();
  await expect(error).toContainText("Audio unavailable");
});

test("seek silently fails when server doesn't advertise Accept-Ranges", async ({
  mount,
  page,
}) => {
  // Intercept the fixture and strip Accept-Ranges from the response.
  // The browser cannot range-request, so seekable.length will be 0
  // (or seekable.end(0) === 0) once metadata loads.
  await page.route("**/sample-video.mp4", async (route) => {
    const response = await route.fetch();
    const body = await response.body();
    const headers = { ...response.headers() };
    delete headers["accept-ranges"];
    delete headers["content-range"];
    await route.fulfill({
      status: 200,
      headers,
      body,
    });
  });

  const warnings: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "warning") warnings.push(msg.text());
  });

  const component = await mount(
    <MockMediaPlayer
      url={FIXTURE_VIDEO}
      name="test"
      controls={{ seek: true }}
    />,
  );

  const video = component.locator('[data-testid="mediaPlayer-video"]');
  await expect
    .poll(async () => video.evaluate((el: HTMLVideoElement) => el.readyState))
    .toBeGreaterThanOrEqual(1);

  // SCORE should detect the no-range condition (via probing v.seekable
  // after metadata) and warn so the integrator knows where to look.
  await expect
    .poll(() => warnings.some((m) => m.includes("Accept-Ranges")))
    .toBe(true);
});
