import { test, expect } from "@playwright/experimental-ct-react";
import { TrainingVideo } from "./TrainingVideo";

test("renders video heading", async ({ mount }) => {
  const component = await mount(
    <TrainingVideo
      url="https://example.com/video.mp4"
      getElapsedTime={() => 0}
      onComplete={() => {}}
    />,
  );
  await expect(component).toContainText("watch the following video");
});

test("shows play button when autoplay is blocked", async ({ mount }) => {
  // In Playwright's test browser, autoplay is typically blocked
  const component = await mount(
    <TrainingVideo
      url="https://example.com/video.mp4"
      getElapsedTime={() => 0}
      onComplete={() => {}}
    />,
  );
  // Should show play button since autoplay test will fail in test env
  await expect(component.locator("button")).toBeVisible({ timeout: 3000 });
  await expect(component).toContainText("Click to continue");
});
