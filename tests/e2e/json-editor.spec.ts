import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

async function openPreview(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "JSON preview" }).click();
  return page.getByLabel("JSON preview content");
}

async function clickTreeNode(page: import("@playwright/test").Page, name: RegExp) {
  const node = page.getByRole("button", { name });
  const box = await node.boundingBox();
  if (!box) throw new Error(`Tree node not found: ${name}`);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.up();
}

test("commits selected value on blur and supports undo redo", async ({ page }) => {
  await clickTreeNode(page, /string name Sample project/);
  await page.getByLabel("Selected node value").fill("Changed project");

  const preview = await openPreview(page);
  await expect(preview).toContainText('"name": "Changed project"');

  await page.getByRole("button", { name: "Undo" }).click();
  await expect(preview).toContainText('"name": "Sample project"');

  await page.getByRole("button", { name: "Redo" }).click();
  await expect(preview).toContainText('"name": "Changed project"');
});

test("rejects an empty object key on blur and restores the previous key", async ({ page }) => {
  await clickTreeNode(page, /string owner Ada/);
  const keyInput = page.getByLabel("Selected node key");

  await keyInput.fill("");
  await page.getByLabel("Selected node value").click();

  await expect(page.getByText("Key cannot be empty.")).toBeVisible();
  await expect(keyInput).toHaveValue("owner");

  const preview = await openPreview(page);
  await expect(preview).toContainText('"owner": "Ada"');
});

test("renames an object key and can undo the rename", async ({ page }) => {
  await clickTreeNode(page, /string owner Ada/);
  const keyInput = page.getByLabel("Selected node key");

  await keyInput.fill("maintainer");
  await page.getByLabel("Selected node value").click();

  const preview = await openPreview(page);
  await expect(preview).toContainText('"maintainer": "Ada"');
  await expect(preview).not.toContainText('"owner": "Ada"');

  await page.getByRole("button", { name: "Undo" }).click();
  await expect(preview).toContainText('"owner": "Ada"');
});

test("reorders array items with drag and drop", async ({ page }) => {
  const alpha = page.getByRole("button", { name: /string 0 alpha/ });
  const beta = page.getByRole("button", { name: /string 1 beta/ });

  await beta.dragTo(alpha);

  const preview = await openPreview(page);
  await expect(preview).toContainText(/"tags": \[\s+"beta",\s+"alpha"\s+\]/);
});
