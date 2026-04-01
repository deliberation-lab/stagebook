import { test, expect } from "@playwright/experimental-ct-react";
import { Qualtrics } from "./Qualtrics";
import { MockQualtrics } from "../testing/MockQualtrics";

test.describe("Qualtrics", () => {
  test.describe("URL building", () => {
    test("renders iframe with survey URL", async ({ mount }) => {
      const component = await mount(
        <Qualtrics
          url="https://upenn.qualtrics.com/jfe/form/SV_test123"
          progressLabel="game_0_survey"
          save={() => {}}
          onComplete={() => {}}
        />,
      );
      const iframe = component.locator("iframe");
      await expect(iframe).toBeVisible();
      const src = await iframe.getAttribute("src");
      expect(src).toContain("https://upenn.qualtrics.com/jfe/form/SV_test123");
    });

    test("appends resolved URL params", async ({ mount }) => {
      const component = await mount(
        <Qualtrics
          url="https://upenn.qualtrics.com/jfe/form/SV_test123"
          resolvedParams={[
            { key: "condition", value: "topicA" },
            { key: "prolificId", value: "P123" },
          ]}
          progressLabel="game_0_survey"
          save={() => {}}
          onComplete={() => {}}
        />,
      );
      const src = await component.locator("iframe").getAttribute("src");
      expect(src).toContain("condition=topicA");
      expect(src).toContain("prolificId=P123");
    });

    test("appends participantId as deliberationId", async ({ mount }) => {
      const component = await mount(
        <Qualtrics
          url="https://upenn.qualtrics.com/jfe/form/SV_test123"
          participantId="player-abc"
          progressLabel="game_0_survey"
          save={() => {}}
          onComplete={() => {}}
        />,
      );
      const src = await component.locator("iframe").getAttribute("src");
      expect(src).toContain("deliberationId=player-abc");
    });

    test("appends groupId as sampleId", async ({ mount }) => {
      const component = await mount(
        <Qualtrics
          url="https://upenn.qualtrics.com/jfe/form/SV_test123"
          groupId="game-xyz"
          progressLabel="game_0_survey"
          save={() => {}}
          onComplete={() => {}}
        />,
      );
      const src = await component.locator("iframe").getAttribute("src");
      expect(src).toContain("sampleId=game-xyz");
    });
  });

  test.describe("Completion flow", () => {
    test("saves data and completes on QualtricsEOS message", async ({
      mount,
      page,
    }) => {
      const component = await mount(
        <MockQualtrics url="https://upenn.qualtrics.com/jfe/form/SV_test123" />,
      );

      // Verify not completed yet
      await expect(
        component.locator('[data-testid="qualtrics-completed"]'),
      ).toHaveText("false");

      // Simulate Qualtrics end-of-survey postMessage
      await page.evaluate(() => {
        window.postMessage("QualtricsEOS|SV_test123|sess_abc456", "*");
      });

      // Wait for state update
      await expect(
        component.locator('[data-testid="qualtrics-completed"]'),
      ).toHaveText("true");

      // Verify save was called with correct key
      await expect(
        component.locator('[data-testid="qualtrics-saved-key"]'),
      ).toHaveText("qualtricsDataReady");

      // Verify saved value contains survey and session IDs
      const savedValue = await component
        .locator('[data-testid="qualtrics-saved-value"]')
        .textContent();
      const parsed = JSON.parse(savedValue!);
      expect(parsed.surveyId).toBe("SV_test123");
      expect(parsed.sessionId).toBe("sess_abc456");
      expect(parsed.step).toBe("game_0_qualtrics");
    });
  });
});
