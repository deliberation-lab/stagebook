import { test, expect } from "@playwright/experimental-ct-react";
import { Slider } from "./Slider";

test("renders without thumb initially (no anchoring)", async ({ mount }) => {
  const component = await mount(<Slider min={0} max={100} interval={1} />);
  // No range input should be in the DOM until user clicks
  await expect(component.locator('input[type="range"]')).toHaveCount(0);
  // Instruction text should be visible
  await expect(component).toContainText("Click the bar to select a value");
});

test("shows range input after clicking the track", async ({ mount }) => {
  const component = await mount(<Slider min={0} max={100} interval={1} />);
  // Dispatch a click event on the track (element may be thin/outside viewport)
  await component
    .locator('[role="presentation"]')
    .dispatchEvent("click", { clientX: 150, clientY: 5 });
  // Now the range input should be in the DOM
  await expect(component.locator('input[type="range"]')).toHaveCount(1);
  // Instruction text should be gone
  await expect(component).not.toContainText("Click the bar");
});

test("renders range input when pre-set value is provided", async ({
  mount,
}) => {
  const component = await mount(
    <Slider min={0} max={100} interval={1} value={50} />,
  );
  // Range input should be present with the value
  await expect(component.locator('input[type="range"]')).toHaveCount(1);
  await expect(component.locator('input[type="range"]')).toHaveValue("50");
});

test("renders labels at specified points", async ({ mount }) => {
  const component = await mount(
    <Slider
      min={0}
      max={100}
      interval={10}
      labelPts={[0, 50, 100]}
      labels={["Low", "Mid", "High"]}
    />,
  );
  await expect(component).toContainText("Low");
  await expect(component).toContainText("Mid");
  await expect(component).toContainText("High");
});

test("renders tick marks at label points", async ({ mount }) => {
  const component = await mount(
    <Slider
      min={0}
      max={100}
      interval={10}
      labelPts={[0, 50, 100]}
      labels={["Low", "Mid", "High"]}
    />,
  );
  // 3 tick marks with bg-gray-400 class
  await expect(component.locator(".bg-gray-400")).toHaveCount(3);
});
