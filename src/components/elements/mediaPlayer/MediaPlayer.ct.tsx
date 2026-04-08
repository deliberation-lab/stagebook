import { test, expect } from "@playwright/experimental-ct-react";
import { MockMediaPlayer } from "../../testing/MockMediaPlayer.js";

// -- Rendering structure --

test("renders with correct ARIA region", async ({ mount }) => {
  const component = await mount(
    <MockMediaPlayer url="/sample-video.mp4" name="test" />,
  );
  const player = component.locator('[data-testid="mediaPlayer"]');
  await expect(player).toBeAttached();
  await expect(player).toHaveAttribute("role", "region");
  await expect(player).toHaveAttribute("aria-label", "Media player");
});

test("renders a video element for direct URL", async ({ mount }) => {
  const component = await mount(
    <MockMediaPlayer url="/sample-video.mp4" name="test" />,
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

// -- YouTube IFrame API integration --

// Injects a synchronous mock window.YT into the page so YouTubePlayer's
// createYouTubePlayer() takes the sync path. Tests then fire onReady /
// onStateChange via page.evaluate() to simulate the real API callbacks.

type PWT = import("@playwright/test").Page;

async function installYTMock(page: PWT) {
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    w.__ytOnReady = null;
    w.__ytOnStateChange = null;
    w.__ytCurrentTime = 0;
    w.__ytDuration = 60;
    w.__ytState = 2; // PAUSED
    w.__ytPlayCalled = 0;
    w.__ytPauseCalled = 0;
    w.__ytLastSeek = null;

    w.YT = {
      PlayerState: {
        UNSTARTED: -1,
        ENDED: 0,
        PLAYING: 1,
        PAUSED: 2,
        BUFFERING: 3,
        CUED: 5,
      },
      Player: function (
        _el: unknown,
        opts: {
          events?: {
            onReady?: () => void;
            onStateChange?: (e: { data: number }) => void;
          };
        },
      ) {
        w.__ytOnReady = opts.events?.onReady ?? null;
        w.__ytOnStateChange = opts.events?.onStateChange ?? null;
        return {
          playVideo() {
            w.__ytPlayCalled++;
          },
          pauseVideo() {
            w.__ytPauseCalled++;
          },
          seekTo(t: number) {
            w.__ytLastSeek = t;
          },
          getCurrentTime() {
            return w.__ytCurrentTime;
          },
          getDuration() {
            return w.__ytDuration;
          },
          getPlayerState() {
            return w.__ytState;
          },
          destroy() {},
        };
      },
    };
  });
}

// Fires the YT onReady callback, waiting first for the Player constructor to have
// run (useEffect is async — it may not have run yet when mount() resolves).
async function fireYTOnReady(page: PWT) {
  // Poll until createYouTubePlayer's useEffect has run and registered __ytOnReady
  await expect
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .poll(() => page.evaluate(() => (window as any).__ytOnReady !== null))
    .toBe(true);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await page.evaluate(() => (window as any).__ytOnReady?.());
}

test("YouTube: play button shown after IFrame API ready", async ({
  mount,
  page,
}) => {
  await installYTMock(page);
  const component = await mount(
    <MockMediaPlayer
      url="https://youtu.be/QC8iQqtG0hg"
      name="test"
      controls={{ playPause: true, seek: true }}
    />,
  );
  await fireYTOnReady(page);
  await expect(
    component.locator('[data-testid="mediaPlayer-playPause"]'),
  ).toBeVisible();
  await expect(
    component.locator('[data-testid="mediaPlayer-seekBack"]'),
  ).toBeVisible();
  await expect(
    component.locator('[data-testid="mediaPlayer-seekForward"]'),
  ).toBeVisible();
});

test("YouTube: play button aria-label becomes Pause after PLAYING state", async ({
  mount,
  page,
}) => {
  await installYTMock(page);
  const component = await mount(
    <MockMediaPlayer
      url="https://youtu.be/QC8iQqtG0hg"
      name="test"
      controls={{ playPause: true }}
    />,
  );
  await fireYTOnReady(page);
  // Hover to keep controls visible while playing
  await component
    .locator('[data-testid="mediaPlayer"]')
    .dispatchEvent("mouseover", { bubbles: true });
  // Simulate YouTube state change to PLAYING
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    w.__ytState = 1;
    w.__ytOnStateChange?.({ data: 1 });
  });
  await expect(
    component.locator('[data-testid="mediaPlayer-playPause"]'),
  ).toHaveAttribute("aria-label", "Pause");
});

test("YouTube: clicking play button calls player.playVideo()", async ({
  mount,
  page,
}) => {
  await installYTMock(page);
  // seek: true exposes time display as a sync point for setDuration (= setYtHandle batch)
  const component = await mount(
    <MockMediaPlayer
      url="https://youtu.be/QC8iQqtG0hg"
      name="test"
      controls={{ playPause: true, seek: true }}
    />,
  );
  await fireYTOnReady(page);
  // setDuration(60) is called in the same onHandleReady batch as setYtHandle; wait for it
  await expect(
    component.locator('[data-testid="mediaPlayer-time"]'),
  ).toContainText("1:00");
  const btn = component.locator('[data-testid="mediaPlayer-playPause"]');
  await btn.click();
  await expect
    .poll(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => page.evaluate(() => (window as any).__ytPlayCalled as number),
    )
    .toBeGreaterThan(0);
});

test("YouTube: clicking pause button calls player.pauseVideo()", async ({
  mount,
  page,
}) => {
  await installYTMock(page);
  const component = await mount(
    <MockMediaPlayer
      url="https://youtu.be/QC8iQqtG0hg"
      name="test"
      controls={{ playPause: true }}
    />,
  );
  await fireYTOnReady(page);
  // Put player into playing state so button shows "Pause"
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    w.__ytState = 1;
    w.__ytOnStateChange?.({ data: 1 });
  });
  // Hover to keep controls visible while playing; aria-label "Pause" confirms isPaused=false
  await component
    .locator('[data-testid="mediaPlayer"]')
    .dispatchEvent("mouseover", { bubbles: true });
  await expect(
    component.locator('[data-testid="mediaPlayer-playPause"]'),
  ).toHaveAttribute("aria-label", "Pause");
  await component.locator('[data-testid="mediaPlayer-playPause"]').click();
  const callCount = await page.evaluate(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    () => (window as any).__ytPauseCalled as number,
  );
  expect(callCount).toBeGreaterThan(0);
});

test("YouTube: seekBack button calls player.seekTo(currentTime - 1)", async ({
  mount,
  page,
}) => {
  await installYTMock(page);
  const component = await mount(
    <MockMediaPlayer
      url="https://youtu.be/QC8iQqtG0hg"
      name="test"
      controls={{ seek: true }}
    />,
  );
  // Set currentTime before firing onReady so the handle captures it
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await page.evaluate(() => ((window as any).__ytCurrentTime = 30));
  await fireYTOnReady(page);
  // aria-valuemax = 60 (= __ytDuration) once setDuration(60) has been committed
  await expect(
    component.locator('[data-testid="mediaPlayer-scrubBar"]'),
  ).toHaveAttribute("aria-valuemax", "60");
  const btn = component.locator('[data-testid="mediaPlayer-seekBack"]');
  await btn.click();
  await expect
    .poll(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => page.evaluate(() => (window as any).__ytLastSeek as number | null),
    )
    .toBe(29);
});

test("YouTube: save() called with play event when state changes to PLAYING", async ({
  mount,
  page,
}) => {
  await installYTMock(page);
  const component = await mount(
    <MockMediaPlayer
      url="https://youtu.be/QC8iQqtG0hg"
      name="coding_video"
      controls={{ playPause: true }}
    />,
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await page.evaluate(() => ((window as any).__ytCurrentTime = 5));
  await fireYTOnReady(page);
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    w.__ytState = 1;
    w.__ytOnStateChange?.({ data: 1 });
  });
  // Wait for React to flush and MockMediaPlayer to update the save-log
  const saveLog = component.locator('[data-testid="save-log"]');
  await expect
    .poll(async () => {
      const text = await saveLog.textContent();
      return text ?? "";
    })
    .toMatch(/"type":"play"/);
  const saveText = await saveLog.textContent();
  const saves = JSON.parse(saveText ?? "[]") as Array<{
    key: string;
    value: { events: Array<{ type: string; videoTime: number }> };
  }>;
  const lastRecord = saves[saves.length - 1].value;
  expect(lastRecord.events.at(-1)?.type).toBe("play");
  expect(lastRecord.events.at(-1)?.videoTime).toBe(5);
});

test("YouTube: no video element rendered", async ({ mount, page }) => {
  await installYTMock(page);
  const component = await mount(
    <MockMediaPlayer url="https://youtu.be/QC8iQqtG0hg" name="test" />,
  );
  await expect(
    component.locator('[data-testid="mediaPlayer-video"]'),
  ).not.toBeAttached();
});

// -- Controls visibility --

// Real fixture video served by Vite from /public.
const FIXTURE_VIDEO = "/sample-video.mp4";

// Visual inspection test: all controls enabled together using the real fixture.
// Run with `--ui` to interact — click play/pause, drag the scrub bar, etc.
test("all controls shown together", async ({ mount }) => {
  const component = await mount(
    <MockMediaPlayer
      url={FIXTURE_VIDEO}
      name="test"
      controls={{ playPause: true, seek: true, step: true, speed: true }}
      stepDuration={5}
    />,
  );

  // Controls visible on mount (paused state)
  await expect(
    component.locator('[data-testid="mediaPlayer-seekBack"]'),
  ).toBeVisible();
  await expect(
    component.locator('[data-testid="mediaPlayer-stepBack"]'),
  ).toBeVisible();
  await expect(
    component.locator('[data-testid="mediaPlayer-playPause"]'),
  ).toBeVisible();
  await expect(
    component.locator('[data-testid="mediaPlayer-stepForward"]'),
  ).toBeVisible();
  await expect(
    component.locator('[data-testid="mediaPlayer-seekForward"]'),
  ).toBeVisible();
  await expect(
    component.locator('[data-testid="mediaPlayer-speed"]'),
  ).toBeVisible();
  await expect(
    component.locator('[data-testid="mediaPlayer-scrubBar"]'),
  ).toBeVisible();
});

test("no controls shown when controls prop is omitted", async ({ mount }) => {
  const component = await mount(
    <MockMediaPlayer url="/sample-video.mp4" name="test" />,
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
      url="/sample-video.mp4"
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
      url="/sample-video.mp4"
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
      url="/sample-video.mp4"
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
      url="/sample-video.mp4"
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
    <MockMediaPlayer url="/sample-video.mp4" name="test_vid" />,
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
    <MockMediaPlayer url="/sample-video.mp4" name="test_vid" />,
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
    <MockMediaPlayer url="/sample-video.mp4" name="test_vid" />,
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
      url="/sample-video.mp4"
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
      url="/sample-video.mp4"
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

// -- startAt / stopAt scrub bounds --

test("scrub bar aria-valuemin is startAt", async ({ mount }) => {
  const component = await mount(
    <MockMediaPlayer
      url="/sample-video.mp4"
      name="test"
      startAt={10}
      stopAt={90}
      controls={{ seek: true }}
    />,
  );
  const scrub = component.locator('[data-testid="mediaPlayer-scrubBar"]');
  await expect(scrub).toHaveAttribute("aria-valuemin", "10");
});

test("scrub bar aria-valuemax is stopAt", async ({ mount }) => {
  const component = await mount(
    <MockMediaPlayer
      url="/sample-video.mp4"
      name="test"
      startAt={10}
      stopAt={90}
      controls={{ seek: true }}
    />,
  );
  const scrub = component.locator('[data-testid="mediaPlayer-scrubBar"]');
  await expect(scrub).toHaveAttribute("aria-valuemax", "90");
});

test("scrub bar defaults to 0/Infinity when startAt/stopAt omitted", async ({
  mount,
}) => {
  const component = await mount(
    <MockMediaPlayer
      url="/sample-video.mp4"
      name="test"
      controls={{ seek: true }}
    />,
  );
  const scrub = component.locator('[data-testid="mediaPlayer-scrubBar"]');
  await expect(scrub).toHaveAttribute("aria-valuemin", "0");
  // Without stopAt and no loaded metadata, max should be 0 or unset — not NaN
  const max = await scrub.getAttribute("aria-valuemax");
  expect(isNaN(Number(max))).toBe(false);
});

// -- stopAt enforcement --

test("save records stopAt event when timeupdate exceeds stopAt", async ({
  mount,
}) => {
  const component = await mount(
    <MockMediaPlayer url="/sample-video.mp4" name="test" stopAt={5} />,
  );

  await component
    .locator('[data-testid="mediaPlayer-video"]')
    .evaluate((el) => {
      Object.defineProperty(el, "currentTime", {
        get: () => 6,
        configurable: true,
      });
      el.dispatchEvent(new Event("timeupdate"));
    });

  const raw = await component.locator('[data-testid="save-log"]').textContent();
  const saves = JSON.parse(raw ?? "[]") as Array<{
    key: string;
    value: { events: Array<{ type: string }> };
  }>;
  expect(saves.length).toBeGreaterThan(0);
  const lastEvents = saves[saves.length - 1].value.events;
  // Should record exactly one "stopAt" event — distinct from natural "ended"
  expect(lastEvents).toHaveLength(1);
  expect(lastEvents[0].type).toBe("stopAt");
});

test("onComplete called when submitOnComplete is true and stopAt is reached", async ({
  mount,
}) => {
  const component = await mount(
    <MockMediaPlayer
      url="/sample-video.mp4"
      name="test"
      stopAt={5}
      submitOnComplete={true}
    />,
  );

  await component
    .locator('[data-testid="mediaPlayer-video"]')
    .evaluate((el) => {
      Object.defineProperty(el, "currentTime", {
        get: () => 6,
        configurable: true,
      });
      el.dispatchEvent(new Event("timeupdate"));
    });

  const completed = await component
    .locator('[data-testid="completed"]')
    .textContent();
  expect(completed).toBe("true");
});

// -- captions overlay --

test("no caption overlay when captionsURL is not provided", async ({
  mount,
}) => {
  const component = await mount(
    <MockMediaPlayer url="/sample-video.mp4" name="test" />,
  );
  await expect(
    component.locator('[data-testid="mediaPlayer-caption"]'),
  ).not.toBeAttached();
});

test("caption overlay shows active cue text on timeupdate", async ({
  mount,
  page,
}) => {
  const vtt = `WEBVTT\n\n00:00.000 --> 00:10.000\nHello world\n`;
  await page.route("**/captions.vtt", (route) =>
    route.fulfill({ body: vtt, contentType: "text/vtt" }),
  );

  const component = await mount(
    <MockMediaPlayer
      url="/sample-video.mp4"
      name="test"
      captionsURL="https://example.com/captions.vtt"
    />,
  );

  // Wait for VTT fetch to complete
  await page.waitForFunction(() => {
    // poll until the caption element appears or we decide it isn't coming
    return true; // just a small pause for the fetch
  });

  await component
    .locator('[data-testid="mediaPlayer-video"]')
    .evaluate((el) => {
      Object.defineProperty(el, "currentTime", {
        get: () => 5,
        configurable: true,
      });
      el.dispatchEvent(new Event("timeupdate"));
    });

  await expect(
    component.locator('[data-testid="mediaPlayer-caption"]'),
  ).toContainText("Hello world");
});

test("caption overlay clears when no cue is active", async ({
  mount,
  page,
}) => {
  const vtt = `WEBVTT\n\n00:05.000 --> 00:10.000\nHello world\n`;
  await page.route("**/captions.vtt", (route) =>
    route.fulfill({ body: vtt, contentType: "text/vtt" }),
  );

  const component = await mount(
    <MockMediaPlayer
      url="/sample-video.mp4"
      name="test"
      captionsURL="https://example.com/captions.vtt"
    />,
  );

  // At t=1, no cue is active
  await component
    .locator('[data-testid="mediaPlayer-video"]')
    .evaluate((el) => {
      Object.defineProperty(el, "currentTime", {
        get: () => 1,
        configurable: true,
      });
      el.dispatchEvent(new Event("timeupdate"));
    });

  await expect(
    component.locator('[data-testid="mediaPlayer-caption"]'),
  ).not.toBeAttached();
});

// -- Scrub bar state tracking --

test("scrub bar aria-valuenow tracks currentTime on timeupdate", async ({
  mount,
}) => {
  const component = await mount(
    <MockMediaPlayer
      url="/sample-video.mp4"
      name="test"
      controls={{ seek: true }}
    />,
  );

  await component
    .locator('[data-testid="mediaPlayer-video"]')
    .evaluate((el) => {
      Object.defineProperty(el, "currentTime", {
        get: () => 7.5,
        configurable: true,
      });
      el.dispatchEvent(new Event("timeupdate"));
    });

  await expect(
    component.locator('[data-testid="mediaPlayer-scrubBar"]'),
  ).toHaveAttribute("aria-valuenow", "7.5");
});

test("scrub bar data-step equals stepDuration", async ({ mount }) => {
  const component = await mount(
    <MockMediaPlayer
      url="/sample-video.mp4"
      name="test"
      stepDuration={0.1}
      controls={{ seek: true }}
    />,
  );
  await expect(
    component.locator('[data-testid="mediaPlayer-scrubBar"]'),
  ).toHaveAttribute("data-step", "0.1");
});

test("scrub bar data-step defaults to 1 when stepDuration is omitted", async ({
  mount,
}) => {
  const component = await mount(
    <MockMediaPlayer
      url="/sample-video.mp4"
      name="test"
      controls={{ seek: true }}
    />,
  );
  await expect(
    component.locator('[data-testid="mediaPlayer-scrubBar"]'),
  ).toHaveAttribute("data-step", "1");
});

// Helper: set up a video element with a controllable currentTime / paused state
async function setupVideoMock(
  video: import("@playwright/test").Locator,
  opts: { duration?: number; playing?: boolean } = {},
) {
  await video.evaluate((el, { duration = 100, playing = false }) => {
    let ct = 0;
    let paused = !playing;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const v = el as any;
    Object.defineProperty(el, "currentTime", {
      get: () => ct,
      set: (s: number) => {
        ct = s;
      },
      configurable: true,
    });
    Object.defineProperty(el, "duration", {
      get: () => duration,
      configurable: true,
    });
    Object.defineProperty(el, "paused", {
      get: () => paused,
      configurable: true,
    });
    v.pause = () => {
      paused = true;
      el.dispatchEvent(new Event("pause"));
    };
    v.play = () => {
      paused = false;
      el.dispatchEvent(new Event("play"));
      return Promise.resolve();
    };
    el.dispatchEvent(new Event("loadedmetadata"));
  }, opts);
}

test("scrub bar: pointerdown seeks video to clicked position", async ({
  mount,
}) => {
  const component = await mount(
    <MockMediaPlayer
      url="/sample-video.mp4"
      name="test"
      controls={{ seek: true }}
    />,
  );
  const video = component.locator('[data-testid="mediaPlayer-video"]');
  await setupVideoMock(video);
  const scrub = component.locator('[data-testid="mediaPlayer-scrubBar"]');
  const box = await scrub.boundingBox();
  if (!box) throw new Error("scrub bar not found");
  await scrub.dispatchEvent("pointerdown", {
    clientX: box.x + box.width * 0.5,
    clientY: box.y + box.height * 0.5,
    buttons: 1,
    pointerId: 1,
  });
  // Seek happens immediately on pointerdown
  const ct = await video.evaluate((el) => el.currentTime);
  expect(ct).toBeCloseTo(50, 0);
});

test("scrub bar: pointermove seeks video during drag", async ({ mount }) => {
  const component = await mount(
    <MockMediaPlayer
      url="/sample-video.mp4"
      name="test"
      controls={{ seek: true }}
    />,
  );
  const video = component.locator('[data-testid="mediaPlayer-video"]');
  await setupVideoMock(video);
  const scrub = component.locator('[data-testid="mediaPlayer-scrubBar"]');
  const box = await scrub.boundingBox();
  if (!box) throw new Error("scrub bar not found");
  await scrub.dispatchEvent("pointerdown", {
    clientX: box.x + box.width * 0.1,
    clientY: box.y + box.height * 0.5,
    buttons: 1,
    pointerId: 1,
  });
  await scrub.dispatchEvent("pointermove", {
    clientX: box.x + box.width * 0.75,
    clientY: box.y + box.height * 0.5,
    buttons: 1,
    pointerId: 1,
  });
  // seek updates in real-time during drag
  expect(await video.evaluate((el) => el.currentTime)).toBeCloseTo(75, 0);
});

test("scrub bar: pauses video on grab while playing, resumes on release", async ({
  mount,
}) => {
  const component = await mount(
    <MockMediaPlayer
      url="/sample-video.mp4"
      name="test"
      controls={{ seek: true }}
    />,
  );
  const video = component.locator('[data-testid="mediaPlayer-video"]');
  // Set up as currently playing (paused=false)
  await setupVideoMock(video, { playing: true });
  const scrub = component.locator('[data-testid="mediaPlayer-scrubBar"]');
  const box = await scrub.boundingBox();
  if (!box) throw new Error("scrub bar not found");

  // Grab scrubbar while playing → should auto-pause
  await scrub.dispatchEvent("pointerdown", {
    clientX: box.x + box.width * 0.5,
    clientY: box.y + box.height * 0.5,
    buttons: 1,
    pointerId: 1,
  });
  // video.paused should now be true and a "pause" event recorded
  const pausedAfterDown = await video.evaluate((el) => el.paused);
  expect(pausedAfterDown).toBe(true);
  const saveLog = component.locator('[data-testid="save-log"]');
  const rawAfterDown = await saveLog.textContent();
  const savesAfterDown = JSON.parse(rawAfterDown ?? "[]") as Array<{
    value: { events: Array<{ type: string }> };
  }>;
  expect(savesAfterDown.at(-1)?.value.events.at(-1)?.type).toBe("pause");

  // Release → should resume
  await scrub.dispatchEvent("pointerup", {
    clientX: box.x + box.width * 0.5,
    clientY: box.y + box.height * 0.5,
    pointerId: 1,
  });
  const pausedAfterUp = await video.evaluate((el) => el.paused);
  expect(pausedAfterUp).toBe(false);
  const rawAfterUp = await saveLog.textContent();
  const savesAfterUp = JSON.parse(rawAfterUp ?? "[]") as Array<{
    value: { events: Array<{ type: string }> };
  }>;
  expect(savesAfterUp.at(-1)?.value.events.at(-1)?.type).toBe("play");
});

test("scrub bar: no play/pause events when scrubbing from paused state", async ({
  mount,
}) => {
  const component = await mount(
    <MockMediaPlayer
      url="/sample-video.mp4"
      name="test"
      controls={{ seek: true }}
    />,
  );
  const video = component.locator('[data-testid="mediaPlayer-video"]');
  await setupVideoMock(video, { playing: false });
  const scrub = component.locator('[data-testid="mediaPlayer-scrubBar"]');
  const box = await scrub.boundingBox();
  if (!box) throw new Error("scrub bar not found");
  await scrub.dispatchEvent("pointerdown", {
    clientX: box.x + box.width * 0.3,
    clientY: box.y + box.height * 0.5,
    buttons: 1,
    pointerId: 1,
  });
  await scrub.dispatchEvent("pointermove", {
    clientX: box.x + box.width * 0.7,
    clientY: box.y + box.height * 0.5,
    buttons: 1,
    pointerId: 1,
  });
  await scrub.dispatchEvent("pointerup", {
    clientX: box.x + box.width * 0.7,
    clientY: box.y + box.height * 0.5,
    pointerId: 1,
  });
  // No save events should have been recorded (scrubbing while paused = no events)
  const raw = await component.locator('[data-testid="save-log"]').textContent();
  const saves = JSON.parse(raw ?? "[]") as Array<unknown>;
  expect(saves).toHaveLength(0);
});

// -- Play/pause button state --

test("play button aria-label is Play when paused", async ({ mount }) => {
  const component = await mount(
    <MockMediaPlayer
      url="/sample-video.mp4"
      name="test"
      controls={{ playPause: true }}
    />,
  );
  await expect(
    component.locator('[data-testid="mediaPlayer-playPause"]'),
  ).toHaveAttribute("aria-label", "Play");
});

test("play button aria-label becomes Pause after play event", async ({
  mount,
}) => {
  const component = await mount(
    <MockMediaPlayer
      url="/sample-video.mp4"
      name="test"
      controls={{ playPause: true }}
    />,
  );
  const player = component.locator('[data-testid="mediaPlayer"]');
  await component
    .locator('[data-testid="mediaPlayer-video"]')
    .evaluate((el) => el.dispatchEvent(new Event("play")));
  // Hover to reveal controls (hidden while playing)
  await player.evaluate((el) =>
    el.dispatchEvent(new MouseEvent("mouseover", { bubbles: true })),
  );
  await expect(
    component.locator('[data-testid="mediaPlayer-playPause"]'),
  ).toHaveAttribute("aria-label", "Pause");
});

test("play button aria-label returns to Play after pause event", async ({
  mount,
}) => {
  const component = await mount(
    <MockMediaPlayer
      url="/sample-video.mp4"
      name="test"
      controls={{ playPause: true }}
    />,
  );
  const video = component.locator('[data-testid="mediaPlayer-video"]');
  await video.evaluate((el) => el.dispatchEvent(new Event("play")));
  await video.evaluate((el) => el.dispatchEvent(new Event("pause")));
  await expect(
    component.locator('[data-testid="mediaPlayer-playPause"]'),
  ).toHaveAttribute("aria-label", "Play");
});

// -- Speed control --

test("speed button shows 1x initially", async ({ mount }) => {
  const component = await mount(
    <MockMediaPlayer
      url="/sample-video.mp4"
      name="test"
      controls={{ speed: true }}
    />,
  );
  await expect(
    component.locator('[data-testid="mediaPlayer-speed"]'),
  ).toContainText("1\u00d7");
});

test("speed button cycles to next speed on click", async ({ mount }) => {
  const component = await mount(
    <MockMediaPlayer
      url="/sample-video.mp4"
      name="test"
      controls={{ speed: true }}
    />,
  );
  await component.locator('[data-testid="mediaPlayer-speed"]').click();
  await expect(
    component.locator('[data-testid="mediaPlayer-speed"]'),
  ).not.toContainText("1\u00d7");
});

test("speed button wraps back to first speed after cycling through all", async ({
  mount,
}) => {
  const component = await mount(
    <MockMediaPlayer
      url="/sample-video.mp4"
      name="test"
      controls={{ speed: true }}
    />,
  );
  const btn = component.locator('[data-testid="mediaPlayer-speed"]');
  // SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2]; starts at 1× (idx 2)
  // 6 clicks cycles through all 6 speeds and lands back at 1×
  for (let i = 0; i < 6; i++) await btn.click();
  await expect(btn).toContainText("1\u00d7");
});

// -- Keyboard shortcuts --

test("Space key toggles to playing state", async ({ mount }) => {
  const component = await mount(
    <MockMediaPlayer
      url="/sample-video.mp4"
      name="test"
      controls={{ playPause: true }}
    />,
  );
  const player = component.locator('[data-testid="mediaPlayer"]');
  await component
    .locator('[data-testid="mediaPlayer-video"]')
    .evaluate((el) => {
      el.play = () => {
        el.dispatchEvent(new Event("play"));
        return Promise.resolve();
      };
    });
  await player.press("Space");
  // Hover to reveal controls (hidden while playing)
  await player.evaluate((el) =>
    el.dispatchEvent(new MouseEvent("mouseover", { bubbles: true })),
  );
  await expect(
    component.locator('[data-testid="mediaPlayer-playPause"]'),
  ).toHaveAttribute("aria-label", "Pause");
});

test("K key toggles to playing state", async ({ mount }) => {
  const component = await mount(
    <MockMediaPlayer
      url="/sample-video.mp4"
      name="test"
      controls={{ playPause: true }}
    />,
  );
  const player = component.locator('[data-testid="mediaPlayer"]');
  await component
    .locator('[data-testid="mediaPlayer-video"]')
    .evaluate((el) => {
      el.play = () => {
        el.dispatchEvent(new Event("play"));
        return Promise.resolve();
      };
    });
  await player.press("k");
  // Hover to reveal controls (hidden while playing)
  await player.evaluate((el) =>
    el.dispatchEvent(new MouseEvent("mouseover", { bubbles: true })),
  );
  await expect(
    component.locator('[data-testid="mediaPlayer-playPause"]'),
  ).toHaveAttribute("aria-label", "Pause");
});

test("ArrowRight seeks forward 1 second", async ({ mount }) => {
  const component = await mount(
    <MockMediaPlayer
      url="/sample-video.mp4"
      name="test"
      controls={{ seek: true }}
    />,
  );
  const video = component.locator('[data-testid="mediaPlayer-video"]');
  await video.evaluate((el) => {
    let ct = 10;
    Object.defineProperty(el, "currentTime", {
      get: () => ct,
      set: (v: number) => {
        ct = v;
      },
      configurable: true,
    });
    Object.defineProperty(el, "duration", {
      get: () => 60,
      configurable: true,
    });
  });
  await component.locator('[data-testid="mediaPlayer"]').press("ArrowRight");
  const ct = await video.evaluate((el) => el.currentTime);
  expect(ct).toBe(11);
});

test("ArrowLeft seeks backward 1 second", async ({ mount }) => {
  const component = await mount(
    <MockMediaPlayer
      url="/sample-video.mp4"
      name="test"
      controls={{ seek: true }}
    />,
  );
  const video = component.locator('[data-testid="mediaPlayer-video"]');
  await video.evaluate((el) => {
    let ct = 20;
    Object.defineProperty(el, "currentTime", {
      get: () => ct,
      set: (v: number) => {
        ct = v;
      },
      configurable: true,
    });
    Object.defineProperty(el, "duration", {
      get: () => 60,
      configurable: true,
    });
  });
  await component.locator('[data-testid="mediaPlayer"]').press("ArrowLeft");
  const ct = await video.evaluate((el) => el.currentTime);
  expect(ct).toBe(19);
});

test("L key seeks forward 10 seconds", async ({ mount }) => {
  const component = await mount(
    <MockMediaPlayer url="/sample-video.mp4" name="test" />,
  );
  const video = component.locator('[data-testid="mediaPlayer-video"]');
  await video.evaluate((el) => {
    let ct = 5;
    Object.defineProperty(el, "currentTime", {
      get: () => ct,
      set: (v: number) => {
        ct = v;
      },
      configurable: true,
    });
    Object.defineProperty(el, "duration", {
      get: () => 60,
      configurable: true,
    });
  });
  await component.locator('[data-testid="mediaPlayer"]').press("l");
  const ct = await video.evaluate((el) => el.currentTime);
  expect(ct).toBe(15);
});

test("J key seeks backward 10 seconds", async ({ mount }) => {
  const component = await mount(
    <MockMediaPlayer url="/sample-video.mp4" name="test" />,
  );
  const video = component.locator('[data-testid="mediaPlayer-video"]');
  await video.evaluate((el) => {
    let ct = 30;
    Object.defineProperty(el, "currentTime", {
      get: () => ct,
      set: (v: number) => {
        ct = v;
      },
      configurable: true,
    });
    Object.defineProperty(el, "duration", {
      get: () => 60,
      configurable: true,
    });
  });
  await component.locator('[data-testid="mediaPlayer"]').press("j");
  const ct = await video.evaluate((el) => el.currentTime);
  expect(ct).toBe(20);
});

test("Period key steps forward by stepDuration", async ({ mount }) => {
  const component = await mount(
    <MockMediaPlayer url="/sample-video.mp4" name="test" stepDuration={0.5} />,
  );
  const video = component.locator('[data-testid="mediaPlayer-video"]');
  await video.evaluate((el) => {
    let ct = 10;
    Object.defineProperty(el, "currentTime", {
      get: () => ct,
      set: (v: number) => {
        ct = v;
      },
      configurable: true,
    });
    Object.defineProperty(el, "duration", {
      get: () => 60,
      configurable: true,
    });
  });
  await component.locator('[data-testid="mediaPlayer"]').press(".");
  const ct = await video.evaluate((el) => el.currentTime);
  expect(ct).toBeCloseTo(10.5);
});

test("Comma key steps backward by stepDuration", async ({ mount }) => {
  const component = await mount(
    <MockMediaPlayer url="/sample-video.mp4" name="test" stepDuration={0.5} />,
  );
  const video = component.locator('[data-testid="mediaPlayer-video"]');
  await video.evaluate((el) => {
    let ct = 10;
    Object.defineProperty(el, "currentTime", {
      get: () => ct,
      set: (v: number) => {
        ct = v;
      },
      configurable: true,
    });
    Object.defineProperty(el, "duration", {
      get: () => 60,
      configurable: true,
    });
  });
  await component.locator('[data-testid="mediaPlayer"]').press(",");
  const ct = await video.evaluate((el) => el.currentTime);
  expect(ct).toBeCloseTo(9.5);
});

test("ArrowLeft clamps to startAt boundary", async ({ mount }) => {
  // ct=10.5, startAt=10: seek(-1) → max(9.5, 10) = 10
  const component = await mount(
    <MockMediaPlayer url="/sample-video.mp4" name="test" startAt={10} />,
  );
  const video = component.locator('[data-testid="mediaPlayer-video"]');
  await video.evaluate((el) => {
    let ct = 10.5;
    Object.defineProperty(el, "currentTime", {
      get: () => ct,
      set: (v: number) => {
        ct = v;
      },
      configurable: true,
    });
    Object.defineProperty(el, "duration", {
      get: () => 60,
      configurable: true,
    });
  });
  await component.locator('[data-testid="mediaPlayer"]').press("ArrowLeft");
  const ct = await video.evaluate((el) => el.currentTime);
  expect(ct).toBe(10);
});

// -- Speed keyboard shortcuts --

test("Greater-than key speeds up playback", async ({ mount }) => {
  const component = await mount(
    <MockMediaPlayer
      url="/sample-video.mp4"
      name="test"
      controls={{ speed: true }}
    />,
  );
  // Start at 1×; > should advance to 1.25×
  await component.locator('[data-testid="mediaPlayer"]').press("Shift+Period");
  await expect(
    component.locator('[data-testid="mediaPlayer-speed"]'),
  ).toContainText("1.25\u00d7");
});

test("Less-than key slows down playback", async ({ mount }) => {
  const component = await mount(
    <MockMediaPlayer
      url="/sample-video.mp4"
      name="test"
      controls={{ speed: true }}
    />,
  );
  // Start at 1×; < should step back to 0.75×
  await component.locator('[data-testid="mediaPlayer"]').press("Shift+Comma");
  await expect(
    component.locator('[data-testid="mediaPlayer-speed"]'),
  ).toContainText("0.75\u00d7");
});

test("Less-than key clamps at minimum speed", async ({ mount }) => {
  const component = await mount(
    <MockMediaPlayer
      url="/sample-video.mp4"
      name="test"
      controls={{ speed: true }}
    />,
  );
  // Press < many times; should stay at 0.5×
  for (let i = 0; i < 10; i++)
    await component.locator('[data-testid="mediaPlayer"]').press("Shift+Comma");
  await expect(
    component.locator('[data-testid="mediaPlayer-speed"]'),
  ).toContainText("0.5\u00d7");
});

test("Greater-than key clamps at maximum speed", async ({ mount }) => {
  const component = await mount(
    <MockMediaPlayer
      url="/sample-video.mp4"
      name="test"
      controls={{ speed: true }}
    />,
  );
  // Press > many times; should stay at 2×
  for (let i = 0; i < 10; i++)
    await component
      .locator('[data-testid="mediaPlayer"]')
      .press("Shift+Period");
  await expect(
    component.locator('[data-testid="mediaPlayer-speed"]'),
  ).toContainText("2\u00d7");
});

// -- controls.step buttons --

test("step buttons shown when controls.step is true", async ({ mount }) => {
  const component = await mount(
    <MockMediaPlayer
      url="/sample-video.mp4"
      name="test"
      controls={{ step: true }}
    />,
  );
  await expect(
    component.locator('[data-testid="mediaPlayer-stepBack"]'),
  ).toBeVisible();
  await expect(
    component.locator('[data-testid="mediaPlayer-stepForward"]'),
  ).toBeVisible();
});

test("step forward button advances by stepDuration", async ({ mount }) => {
  const component = await mount(
    <MockMediaPlayer
      url="/sample-video.mp4"
      name="test"
      stepDuration={0.5}
      controls={{ step: true }}
    />,
  );
  const video = component.locator('[data-testid="mediaPlayer-video"]');
  await video.evaluate((el) => {
    let ct = 10;
    Object.defineProperty(el, "currentTime", {
      get: () => ct,
      set: (v: number) => {
        ct = v;
      },
      configurable: true,
    });
    Object.defineProperty(el, "duration", {
      get: () => 60,
      configurable: true,
    });
  });
  await component.locator('[data-testid="mediaPlayer-stepForward"]').click();
  const ct = await video.evaluate((el) => el.currentTime);
  expect(ct).toBeCloseTo(10.5);
});

test("step back button retreats by stepDuration", async ({ mount }) => {
  const component = await mount(
    <MockMediaPlayer
      url="/sample-video.mp4"
      name="test"
      stepDuration={0.5}
      controls={{ step: true }}
    />,
  );
  const video = component.locator('[data-testid="mediaPlayer-video"]');
  await video.evaluate((el) => {
    let ct = 10;
    Object.defineProperty(el, "currentTime", {
      get: () => ct,
      set: (v: number) => {
        ct = v;
      },
      configurable: true,
    });
    Object.defineProperty(el, "duration", {
      get: () => 60,
      configurable: true,
    });
  });
  await component.locator('[data-testid="mediaPlayer-stepBack"]').click();
  const ct = await video.evaluate((el) => el.currentTime);
  expect(ct).toBeCloseTo(9.5);
});

// -- seekBack / seekForward buttons --

test("seekBack button shown when controls.seek is true", async ({ mount }) => {
  const component = await mount(
    <MockMediaPlayer
      url="/sample-video.mp4"
      name="test"
      controls={{ seek: true }}
    />,
  );
  await expect(
    component.locator('[data-testid="mediaPlayer-seekBack"]'),
  ).toBeVisible();
});

test("seekForward button shown when controls.seek is true", async ({
  mount,
}) => {
  const component = await mount(
    <MockMediaPlayer
      url="/sample-video.mp4"
      name="test"
      controls={{ seek: true }}
    />,
  );
  await expect(
    component.locator('[data-testid="mediaPlayer-seekForward"]'),
  ).toBeVisible();
});

test("seekBack button tap seeks -1 second", async ({ mount }) => {
  const component = await mount(
    <MockMediaPlayer
      url="/sample-video.mp4"
      name="test"
      controls={{ seek: true }}
    />,
  );
  const video = component.locator('[data-testid="mediaPlayer-video"]');
  await video.evaluate((el) => {
    let ct = 10;
    Object.defineProperty(el, "currentTime", {
      get: () => ct,
      set: (v: number) => {
        ct = v;
      },
      configurable: true,
    });
    Object.defineProperty(el, "duration", {
      get: () => 60,
      configurable: true,
    });
  });
  await component.locator('[data-testid="mediaPlayer-seekBack"]').click();
  const ct = await video.evaluate((el) => el.currentTime);
  expect(ct).toBe(9);
});

test("seekForward button tap seeks +1 second", async ({ mount }) => {
  const component = await mount(
    <MockMediaPlayer
      url="/sample-video.mp4"
      name="test"
      controls={{ seek: true }}
    />,
  );
  const video = component.locator('[data-testid="mediaPlayer-video"]');
  await video.evaluate((el) => {
    let ct = 10;
    Object.defineProperty(el, "currentTime", {
      get: () => ct,
      set: (v: number) => {
        ct = v;
      },
      configurable: true,
    });
    Object.defineProperty(el, "duration", {
      get: () => 60,
      configurable: true,
    });
  });
  await component.locator('[data-testid="mediaPlayer-seekForward"]').click();
  const ct = await video.evaluate((el) => el.currentTime);
  expect(ct).toBe(11);
});

// -- allowScrubOutsideBounds --

test("scrub bar clamped to startAt/stopAt by default", async ({ mount }) => {
  const component = await mount(
    <MockMediaPlayer
      url="/sample-video.mp4"
      name="test"
      startAt={10}
      stopAt={50}
      controls={{ seek: true }}
    />,
  );
  const scrub = component.locator('[data-testid="mediaPlayer-scrubBar"]');
  await expect(scrub).toHaveAttribute("aria-valuemin", "10");
  await expect(scrub).toHaveAttribute("aria-valuemax", "50");
});

test("scrub bar full duration when allowScrubOutsideBounds is true", async ({
  mount,
}) => {
  const component = await mount(
    <MockMediaPlayer
      url="/sample-video.mp4"
      name="test"
      startAt={10}
      stopAt={50}
      allowScrubOutsideBounds={true}
      controls={{ seek: true }}
    />,
  );

  // Simulate loadedmetadata so duration is known
  await component
    .locator('[data-testid="mediaPlayer-video"]')
    .evaluate((el) => {
      Object.defineProperty(el, "duration", {
        get: () => 120,
        configurable: true,
      });
      el.dispatchEvent(new Event("loadedmetadata"));
    });

  const scrub = component.locator('[data-testid="mediaPlayer-scrubBar"]');
  await expect(scrub).toHaveAttribute("aria-valuemin", "0");
  await expect(scrub).toHaveAttribute("aria-valuemax", "120");
});

// -- Buffered range --

test("buffered range element present when controls.seek is true", async ({
  mount,
}) => {
  const component = await mount(
    <MockMediaPlayer
      url="/sample-video.mp4"
      name="test"
      controls={{ seek: true }}
    />,
  );
  await expect(
    component.locator('[data-testid="mediaPlayer-buffered"]'),
  ).toBeAttached();
});

test("buffered range width updates on progress event", async ({ mount }) => {
  const component = await mount(
    <MockMediaPlayer
      url="/sample-video.mp4"
      name="test"
      controls={{ seek: true }}
    />,
  );

  const video = component.locator('[data-testid="mediaPlayer-video"]');

  // Set duration first and fire loadedmetadata so duration state is populated
  await video.evaluate((el) => {
    Object.defineProperty(el, "duration", {
      get: () => 100,
      configurable: true,
    });
    el.dispatchEvent(new Event("loadedmetadata"));
  });

  await video.evaluate((el) => {
    // Mock buffered TimeRanges: buffered 0–60
    Object.defineProperty(el, "buffered", {
      get: () => ({
        length: 1,
        start: () => 0,
        end: () => 60,
      }),
      configurable: true,
    });
    el.dispatchEvent(new Event("progress"));
  });

  const buffered = component.locator('[data-testid="mediaPlayer-buffered"]');
  const width = await buffered.evaluate(
    (el) => (el as HTMLElement).style.width,
  );
  expect(width).toBe("60%");
});

// -- Hold-to-scrub (arrow keys) --

test("holding ArrowRight enters fast-forward (playbackRate=2)", async ({
  mount,
}) => {
  const component = await mount(
    <MockMediaPlayer
      url="/sample-video.mp4"
      name="test"
      controls={{ seek: true }}
    />,
  );

  const video = component.locator('[data-testid="mediaPlayer-video"]');
  await video.evaluate((el) => {
    el.play = () => {
      el.dispatchEvent(new Event("play"));
      return Promise.resolve();
    };
    let ct = 10;
    Object.defineProperty(el, "currentTime", {
      get: () => ct,
      set: (v: number) => {
        ct = v;
      },
      configurable: true,
    });
    Object.defineProperty(el, "duration", {
      get: () => 60,
      configurable: true,
    });
  });

  // Simulate 15 repeated keydown events (browser auto-repeat)
  await component.locator('[data-testid="mediaPlayer"]').evaluate((el) => {
    for (let i = 0; i < 15; i++) {
      el.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "ArrowRight",
          repeat: true,
          bubbles: true,
        }),
      );
    }
  });

  const rate = await video.evaluate((el) => el.playbackRate);
  expect(rate).toBe(2);
});

test("releasing ArrowRight after fast-forward restores playback rate", async ({
  mount,
}) => {
  const component = await mount(
    <MockMediaPlayer
      url="/sample-video.mp4"
      name="test"
      controls={{ seek: true }}
    />,
  );

  const video = component.locator('[data-testid="mediaPlayer-video"]');
  await video.evaluate((el) => {
    el.play = () => {
      el.dispatchEvent(new Event("play"));
      return Promise.resolve();
    };
    let ct = 10;
    Object.defineProperty(el, "currentTime", {
      get: () => ct,
      set: (v: number) => {
        ct = v;
      },
      configurable: true,
    });
    Object.defineProperty(el, "duration", {
      get: () => 60,
      configurable: true,
    });
  });

  const player = component.locator('[data-testid="mediaPlayer"]');

  // Enter fast-forward
  await player.evaluate((el) => {
    for (let i = 0; i < 15; i++) {
      el.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "ArrowRight",
          repeat: true,
          bubbles: true,
        }),
      );
    }
  });

  // Release
  await player.evaluate((el) => {
    el.dispatchEvent(
      new KeyboardEvent("keyup", { key: "ArrowRight", bubbles: true }),
    );
  });

  const rate = await video.evaluate((el) => el.playbackRate);
  expect(rate).toBe(1);
});

// -- Hold-to-scrub (seekForward button) --

test("holding seekForward button enters fast-forward after threshold", async ({
  mount,
  page,
}) => {
  const component = await mount(
    <MockMediaPlayer
      url="/sample-video.mp4"
      name="test"
      controls={{ seek: true }}
    />,
  );

  const player = component.locator('[data-testid="mediaPlayer"]');
  const video = component.locator('[data-testid="mediaPlayer-video"]');
  await video.evaluate((el) => {
    el.play = () => {
      el.dispatchEvent(new Event("play"));
      return Promise.resolve();
    };
    let ct = 10;
    Object.defineProperty(el, "currentTime", {
      get: () => ct,
      set: (v: number) => {
        ct = v;
      },
      configurable: true,
    });
    Object.defineProperty(el, "duration", {
      get: () => 60,
      configurable: true,
    });
  });

  // Hover over player so controls remain visible when video starts playing
  await player.evaluate((el) =>
    el.dispatchEvent(new MouseEvent("mouseover", { bubbles: true })),
  );

  // Hold mousedown without releasing
  await component
    .locator('[data-testid="mediaPlayer-seekForward"]')
    .dispatchEvent("mousedown");
  await page.waitForTimeout(600); // past 500ms threshold

  const rate = await video.evaluate((el) => el.playbackRate);
  expect(rate).toBe(2);

  // Cleanup: release
  await component
    .locator('[data-testid="mediaPlayer-seekForward"]')
    .dispatchEvent("mouseup");
});

// -- Hover-to-reveal controls --

test("controls are visible when paused (initial state)", async ({ mount }) => {
  const component = await mount(
    <MockMediaPlayer
      url="/sample-video.mp4"
      name="test"
      controls={{ playPause: true, seek: true }}
    />,
  );
  const controls = component.locator('[data-testid="mediaPlayer-controls"]');
  await expect(controls).toBeVisible();
});

test("controls become visible on hover while playing", async ({
  mount,
  page,
}) => {
  const component = await mount(
    <MockMediaPlayer
      url="/sample-video.mp4"
      name="test"
      controls={{ playPause: true }}
    />,
  );
  const player = component.locator('[data-testid="mediaPlayer"]');
  const video = component.locator('[data-testid="mediaPlayer-video"]');
  const controls = component.locator('[data-testid="mediaPlayer-controls"]');

  // Simulate play while not hovered (dispatch mouseout first so isHovered = false)
  await player.evaluate((el) => {
    el.dispatchEvent(
      new MouseEvent("mouseout", {
        bubbles: true,
        relatedTarget: document.body,
      }),
    );
  });
  await video.evaluate((el) => {
    el.dispatchEvent(new Event("play"));
  });

  // Playing + not hovered → controls not in DOM
  await expect(controls).not.toBeAttached();

  // Dispatch mouseover → isHovered = true → controls visible
  await player.evaluate((el) => {
    el.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
  });
  await expect(controls).toBeVisible();

  // Dispatch mouseout → isHovered = false → controls hidden again
  await player.evaluate((el) => {
    el.dispatchEvent(
      new MouseEvent("mouseout", {
        bubbles: true,
        relatedTarget: document.body,
      }),
    );
  });
  await expect(controls).not.toBeAttached();
});

// -- Time display --

test("time display updates after loadedmetadata and timeupdate", async ({
  mount,
}) => {
  const component = await mount(
    <MockMediaPlayer
      url="/sample-video.mp4"
      name="test"
      controls={{ seek: true }}
    />,
  );
  const video = component.locator('[data-testid="mediaPlayer-video"]');

  // Set duration via loadedmetadata
  await video.evaluate((el) => {
    Object.defineProperty(el, "duration", {
      get: () => 125,
      configurable: true,
    });
    el.dispatchEvent(new Event("loadedmetadata"));
  });

  // Advance currentTime via timeupdate
  await video.evaluate((el) => {
    Object.defineProperty(el, "currentTime", {
      get: () => 65,
      configurable: true,
    });
    el.dispatchEvent(new Event("timeupdate"));
  });

  await expect(
    component.locator('[data-testid="mediaPlayer-time"]'),
  ).toContainText("1:05 / 2:05");
});

// -- Audio-only layout (playVideo: false) --

test("audio-only: controls always visible while playing (no hover needed)", async ({
  mount,
}) => {
  const component = await mount(
    <MockMediaPlayer
      url="https://example.com/test.mp3"
      name="test"
      playVideo={false}
      controls={{ playPause: true, seek: true }}
    />,
  );
  const player = component.locator('[data-testid="mediaPlayer"]');
  const video = component.locator('[data-testid="mediaPlayer-video"]');

  // Move mouse away and simulate play
  await player.evaluate((el) =>
    el.dispatchEvent(
      new MouseEvent("mouseout", {
        bubbles: true,
        relatedTarget: document.body,
      }),
    ),
  );
  await video.evaluate((el) => el.dispatchEvent(new Event("play")));

  // Controls should be visible without hovering (no video to obscure)
  await expect(
    component.locator('[data-testid="mediaPlayer-controls"]'),
  ).toBeVisible();
});

test("audio-only: no video viewport element", async ({ mount }) => {
  const component = await mount(
    <MockMediaPlayer
      url="https://example.com/test.mp3"
      name="test"
      playVideo={false}
      controls={{ playPause: true }}
    />,
  );
  await expect(
    component.locator('[data-testid="mediaPlayer-viewport"]'),
  ).not.toBeAttached();
});
