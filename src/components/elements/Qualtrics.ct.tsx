import { test, expect } from "@playwright/experimental-ct-react";
import { Qualtrics } from "./Qualtrics";

test.describe("Qualtrics", () => {
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
    const iframe = component.locator("iframe");
    const src = await iframe.getAttribute("src");
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
    const iframe = component.locator("iframe");
    const src = await iframe.getAttribute("src");
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
    const iframe = component.locator("iframe");
    const src = await iframe.getAttribute("src");
    expect(src).toContain("sampleId=game-xyz");
  });

  test("renders with correct title", async ({ mount }) => {
    const component = await mount(
      <Qualtrics
        url="https://upenn.qualtrics.com/jfe/form/SV_test123"
        progressLabel="game_0_survey"
        save={() => {}}
        onComplete={() => {}}
      />,
    );
    const iframe = component.locator("iframe");
    await expect(iframe).toHaveAttribute(
      "title",
      "qualtrics_https://upenn.qualtrics.com/jfe/form/SV_test123",
    );
  });
});
