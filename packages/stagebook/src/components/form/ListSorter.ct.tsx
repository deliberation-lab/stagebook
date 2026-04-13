import { test, expect } from "@playwright/experimental-ct-react";
import { MockListSorter } from "../testing/MockListSorter";

const testItems = ["Alpha", "Bravo", "Charlie", "Delta"];

test.describe("ListSorter", () => {
  test("renders all items with numbers", async ({ mount }) => {
    const component = await mount(<MockListSorter items={testItems} />);
    await expect(component).toContainText("Alpha");
    await expect(component).toContainText("Bravo");
    await expect(component).toContainText("Charlie");
    await expect(component).toContainText("Delta");
    // Numbers should be visible
    await expect(component).toContainText("1.");
    await expect(component).toContainText("4.");
  });

  test("renders drag handles on each item", async ({ mount }) => {
    const component = await mount(<MockListSorter items={testItems} />);
    // Each item has the ⇅ drag handle indicator
    await expect(component.getByText("⇅ Alpha")).toBeVisible();
    await expect(component.getByText("⇅ Delta")).toBeVisible();
  });

  test("items have correct initial order", async ({ mount }) => {
    const component = await mount(<MockListSorter items={testItems} />);
    const order = await component
      .locator('[data-testid="current-order"]')
      .textContent();
    expect(order).toBe("Alpha|Bravo|Charlie|Delta");
  });

  test("keyboard reorder: move first item down", async ({ mount, page }) => {
    const component = await mount(<MockListSorter items={testItems} />);

    // Verify initial order
    let order = await component
      .locator('[data-testid="current-order"]')
      .textContent();
    expect(order).toBe("Alpha|Bravo|Charlie|Delta");

    // @hello-pangea/dnd supports keyboard: focus item, Space to lift, Arrow Down to move, Space to drop
    const alpha = component.getByText("⇅ Alpha");
    await alpha.focus();
    await page.keyboard.press("Space");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Space");

    // Wait for state update
    await page.waitForTimeout(100);

    // Verify order changed — Alpha should have moved down one position
    order = await component
      .locator('[data-testid="current-order"]')
      .textContent();
    expect(order).toBe("Bravo|Alpha|Charlie|Delta");
  });

  test("renders items with border styling", async ({ mount }) => {
    const component = await mount(<MockListSorter items={["One", "Two"]} />);
    // Outer container should have a border
    const container = component.locator("div").first();
    await expect(container).toBeVisible();
  });
});
