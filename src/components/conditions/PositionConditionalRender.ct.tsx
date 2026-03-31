import { test, expect } from "@playwright/experimental-ct-react";
import { PositionConditionalRender } from "./PositionConditionalRender";

test("renders children when position is undefined (intro step)", async ({
  mount,
}) => {
  const component = await mount(
    <PositionConditionalRender position={undefined}>
      <p>Visible</p>
    </PositionConditionalRender>,
  );
  await expect(component).toContainText("Visible");
});

test("renders children when position is in showToPositions", async ({
  mount,
}) => {
  const component = await mount(
    <PositionConditionalRender showToPositions={[0, 2]} position={0}>
      <p>Shown</p>
    </PositionConditionalRender>,
  );
  await expect(component).toContainText("Shown");
});

test("hides children when position is not in showToPositions", async ({
  mount,
}) => {
  const component = await mount(
    <PositionConditionalRender showToPositions={[0, 2]} position={1}>
      <p>Hidden</p>
    </PositionConditionalRender>,
  );
  await expect(component).not.toContainText("Hidden");
});

test("hides children when position is in hideFromPositions", async ({
  mount,
}) => {
  const component = await mount(
    <PositionConditionalRender hideFromPositions={[1]} position={1}>
      <p>Hidden</p>
    </PositionConditionalRender>,
  );
  await expect(component).not.toContainText("Hidden");
});

test("renders children when position is not in hideFromPositions", async ({
  mount,
}) => {
  const component = await mount(
    <PositionConditionalRender hideFromPositions={[1]} position={0}>
      <p>Shown</p>
    </PositionConditionalRender>,
  );
  await expect(component).toContainText("Shown");
});
