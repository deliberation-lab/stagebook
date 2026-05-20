import { test, expect } from "@playwright/experimental-ct-react";
import { ScrollIndicator } from "./ScrollIndicator";

test.describe("ScrollIndicator", () => {
  test("renders when visible", async ({ mount }) => {
    const component = await mount(<ScrollIndicator visible={true} />);
    await expect(
      component.locator('[data-testid="scroll-indicator"]'),
    ).toBeVisible();
  });

  test("renders nothing when not visible", async ({ mount }) => {
    const component = await mount(<ScrollIndicator visible={false} />);
    await expect(
      component.locator('[data-testid="scroll-indicator"]'),
    ).toHaveCount(0);
  });

  test("has aria-hidden for accessibility", async ({ mount }) => {
    const component = await mount(<ScrollIndicator visible={true} />);
    await expect(
      component.locator('[data-testid="scroll-indicator"]'),
    ).toHaveAttribute("aria-hidden", "true");
  });

  test("renders down-arrow SVG", async ({ mount }) => {
    const component = await mount(<ScrollIndicator visible={true} />);
    await expect(component.locator("svg")).toBeVisible();
  });

  // ----------- UI polish (#394) -----------

  test("svg background uses --stagebook-scroll-indicator-bg token", async ({
    mount,
  }) => {
    // Polish: the hardcoded rgba(229,231,235,0.8) is now backed by a
    // CSS variable so hosts can retune without overriding selectors.
    const component = await mount(<ScrollIndicator visible={true} />);
    const inlineBg = await component
      .locator("svg")
      .evaluate((el) => (el as SVGElement).style.backgroundColor);
    // The inline style references the var() with the default rgba.
    // Different browsers serialize var(...) slightly differently;
    // the contract is that the inline string contains the variable
    // name.
    expect(inlineBg).toContain("--stagebook-scroll-indicator-bg");
  });

  test("svg color uses --stagebook-scroll-indicator-fg token", async ({
    mount,
  }) => {
    const component = await mount(<ScrollIndicator visible={true} />);
    const inlineColor = await component
      .locator("svg")
      .evaluate((el) => (el as SVGElement).style.color);
    expect(inlineColor).toContain("--stagebook-scroll-indicator-fg");
  });

  test("CSS variable override changes the indicator background", async ({
    mount,
  }) => {
    const component = await mount(
      <div
        style={
          {
            "--stagebook-scroll-indicator-bg": "rgb(0, 128, 0)",
          } as React.CSSProperties
        }
      >
        <ScrollIndicator visible={true} />
      </div>,
    );
    const computed = await component
      .locator("svg")
      .evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(computed).toBe("rgb(0, 128, 0)");
  });

  test("prefers-reduced-motion: animations disabled", async ({
    mount,
    page,
  }) => {
    // Polish: the indicator's fade-in slide and the perpetual pulse
    // both vestibular-trigger for users who opted into reduced
    // motion. Under the media query both should resolve to
    // `animation: none`.
    await page.emulateMedia({ reducedMotion: "reduce" });
    const component = await mount(<ScrollIndicator visible={true} />);
    const wrapperAnimation = await component
      .locator('[data-testid="scroll-indicator"]')
      .evaluate((el) => getComputedStyle(el).animationName);
    const svgAnimation = await component
      .locator("svg")
      .evaluate((el) => getComputedStyle(el).animationName);
    expect(wrapperAnimation).toBe("none");
    expect(svgAnimation).toBe("none");
  });

  test("default media: animations are active (negative-case companion)", async ({
    mount,
    page,
  }) => {
    // Catches future changes that accidentally disable animations
    // outside the reduced-motion path (e.g. a typo in the media
    // query).
    await page.emulateMedia({ reducedMotion: "no-preference" });
    const component = await mount(<ScrollIndicator visible={true} />);
    const wrapperAnimation = await component
      .locator('[data-testid="scroll-indicator"]')
      .evaluate((el) => getComputedStyle(el).animationName);
    const svgAnimation = await component
      .locator("svg")
      .evaluate((el) => getComputedStyle(el).animationName);
    expect(wrapperAnimation).not.toBe("none");
    expect(svgAnimation).not.toBe("none");
  });

  test("two ScrollIndicator instances get unique keyframe scopes", async ({
    mount,
  }) => {
    // Polish: `@keyframes scrollIndicatorFadeIn` (and `Pulse`) used
    // to be global identifiers. If a host had a same-named keyframe,
    // the last definition would win. Now each instance scopes its
    // keyframes via useId, so two indicators (or a host's existing
    // keyframes) can coexist.
    const component = await mount(
      <div>
        <ScrollIndicator visible={true} />
        <ScrollIndicator visible={true} />
      </div>,
    );
    const animationNames = await component
      .locator('[data-testid="scroll-indicator"]')
      .evaluateAll((els) =>
        els.map((el) => getComputedStyle(el as HTMLElement).animationName),
      );
    expect(animationNames).toHaveLength(2);
    expect(animationNames[0]).not.toBe(animationNames[1]);
  });
});
