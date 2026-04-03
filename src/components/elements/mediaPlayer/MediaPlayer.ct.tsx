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

// -- startAt / stopAt scrub bounds --

test("scrub bar aria-valuemin is startAt", async ({ mount }) => {
  const component = await mount(
    <MockMediaPlayer
      url="https://example.com/test.mp4"
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
      url="https://example.com/test.mp4"
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
      url="https://example.com/test.mp4"
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

test("save records stopAt pause event when timeupdate exceeds stopAt", async ({
  mount,
}) => {
  const component = await mount(
    <MockMediaPlayer
      url="https://example.com/test.mp4"
      name="test"
      stopAt={5}
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

  const raw = await component.locator('[data-testid="save-log"]').textContent();
  const saves = JSON.parse(raw ?? "[]") as Array<{
    key: string;
    value: { events: Array<{ type: string }> };
  }>;
  expect(saves.length).toBeGreaterThan(0);
  const lastEvents = saves[saves.length - 1].value.events;
  expect(lastEvents.some((e) => e.type === "stopAt")).toBe(true);
});

// -- captions overlay --

test("no caption overlay when captionsURL is not provided", async ({
  mount,
}) => {
  const component = await mount(
    <MockMediaPlayer url="https://example.com/test.mp4" name="test" />,
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
      url="https://example.com/test.mp4"
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
      url="https://example.com/test.mp4"
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
      url="https://example.com/test.mp4"
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

test("scrub bar step attribute equals stepDuration", async ({ mount }) => {
  const component = await mount(
    <MockMediaPlayer
      url="https://example.com/test.mp4"
      name="test"
      stepDuration={0.1}
      controls={{ seek: true }}
    />,
  );
  await expect(
    component.locator('[data-testid="mediaPlayer-scrubBar"]'),
  ).toHaveAttribute("step", "0.1");
});

test("scrub bar step defaults to 1 when stepDuration is omitted", async ({
  mount,
}) => {
  const component = await mount(
    <MockMediaPlayer
      url="https://example.com/test.mp4"
      name="test"
      controls={{ seek: true }}
    />,
  );
  await expect(
    component.locator('[data-testid="mediaPlayer-scrubBar"]'),
  ).toHaveAttribute("step", "1");
});

// -- Play/pause button state --

test("play button aria-label is Play when paused", async ({ mount }) => {
  const component = await mount(
    <MockMediaPlayer
      url="https://example.com/test.mp4"
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
      url="https://example.com/test.mp4"
      name="test"
      controls={{ playPause: true }}
    />,
  );
  await component
    .locator('[data-testid="mediaPlayer-video"]')
    .evaluate((el) => el.dispatchEvent(new Event("play")));
  await expect(
    component.locator('[data-testid="mediaPlayer-playPause"]'),
  ).toHaveAttribute("aria-label", "Pause");
});

test("play button aria-label returns to Play after pause event", async ({
  mount,
}) => {
  const component = await mount(
    <MockMediaPlayer
      url="https://example.com/test.mp4"
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
      url="https://example.com/test.mp4"
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
      url="https://example.com/test.mp4"
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
      url="https://example.com/test.mp4"
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
      url="https://example.com/test.mp4"
      name="test"
      controls={{ playPause: true }}
    />,
  );
  await component
    .locator('[data-testid="mediaPlayer-video"]')
    .evaluate((el) => {
      el.play = () => {
        el.dispatchEvent(new Event("play"));
        return Promise.resolve();
      };
    });
  await component.locator('[data-testid="mediaPlayer"]').press("Space");
  await expect(
    component.locator('[data-testid="mediaPlayer-playPause"]'),
  ).toHaveAttribute("aria-label", "Pause");
});

test("K key toggles to playing state", async ({ mount }) => {
  const component = await mount(
    <MockMediaPlayer
      url="https://example.com/test.mp4"
      name="test"
      controls={{ playPause: true }}
    />,
  );
  await component
    .locator('[data-testid="mediaPlayer-video"]')
    .evaluate((el) => {
      el.play = () => {
        el.dispatchEvent(new Event("play"));
        return Promise.resolve();
      };
    });
  await component.locator('[data-testid="mediaPlayer"]').press("k");
  await expect(
    component.locator('[data-testid="mediaPlayer-playPause"]'),
  ).toHaveAttribute("aria-label", "Pause");
});

test("ArrowRight seeks forward 5 seconds", async ({ mount }) => {
  const component = await mount(
    <MockMediaPlayer
      url="https://example.com/test.mp4"
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
  expect(ct).toBe(15);
});

test("ArrowLeft seeks backward 5 seconds", async ({ mount }) => {
  const component = await mount(
    <MockMediaPlayer
      url="https://example.com/test.mp4"
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
  expect(ct).toBe(15);
});

test("L key seeks forward 10 seconds", async ({ mount }) => {
  const component = await mount(
    <MockMediaPlayer url="https://example.com/test.mp4" name="test" />,
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
    <MockMediaPlayer url="https://example.com/test.mp4" name="test" />,
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
    <MockMediaPlayer
      url="https://example.com/test.mp4"
      name="test"
      stepDuration={0.5}
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
  await component.locator('[data-testid="mediaPlayer"]').press(".");
  const ct = await video.evaluate((el) => el.currentTime);
  expect(ct).toBeCloseTo(10.5);
});

test("Comma key steps backward by stepDuration", async ({ mount }) => {
  const component = await mount(
    <MockMediaPlayer
      url="https://example.com/test.mp4"
      name="test"
      stepDuration={0.5}
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
  await component.locator('[data-testid="mediaPlayer"]').press(",");
  const ct = await video.evaluate((el) => el.currentTime);
  expect(ct).toBeCloseTo(9.5);
});

test("ArrowLeft clamps to startAt boundary", async ({ mount }) => {
  const component = await mount(
    <MockMediaPlayer
      url="https://example.com/test.mp4"
      name="test"
      startAt={10}
    />,
  );
  const video = component.locator('[data-testid="mediaPlayer-video"]');
  await video.evaluate((el) => {
    let ct = 12;
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
      url="https://example.com/test.mp4"
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
      url="https://example.com/test.mp4"
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
      url="https://example.com/test.mp4"
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
      url="https://example.com/test.mp4"
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
      url="https://example.com/test.mp4"
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
      url="https://example.com/test.mp4"
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
      url="https://example.com/test.mp4"
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
