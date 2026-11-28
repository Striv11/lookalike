import { expect, test } from "@playwright/test";
import { grayPng, sceneA, sceneB } from "./png";

const files = [
  { name: "a-big.png", mimeType: "image/png", buffer: grayPng(256, 256, sceneA) },
  { name: "a-small.png", mimeType: "image/png", buffer: grayPng(96, 96, sceneA) },
  { name: "b.png", mimeType: "image/png", buffer: grayPng(200, 200, sceneB) },
  { name: "broken.png", mimeType: "image/png", buffer: Buffer.from("not an image") },
];

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("shows the empty state with no horizontal overflow", async ({ page }) => {
  await expect(page.getByText("Drop a folder of photos here")).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
});

test("groups a resized duplicate, ignores the odd one out and reports the broken file", async ({
  page,
}) => {
  await page.locator("#pick-files").setInputFiles(files);
  await expect(page.locator(".group")).toHaveCount(1);
  const thumbs = page.locator(".group .thumb");
  await expect(thumbs).toHaveCount(2);
  await expect(page.locator(".group")).not.toContainText("b.png");
  await expect(page.getByText("1 unreadable files")).toBeVisible();
  // best pick (most pixels) is kept, the other is marked for removal
  await expect(page.locator('.thumb:has-text("a-big.png")')).toHaveClass(/keep/);
  await expect(page.locator('.thumb:has-text("a-small.png")')).toHaveClass(/remove/);
  await expect(page.locator("#removals")).toHaveText("1 marked for removal");
});

test("clicking and keyboard toggle marks; R resets the group", async ({ page }) => {
  await page.locator("#pick-files").setInputFiles(files);
  const small = page.locator('.thumb:has-text("a-small.png")');
  await small.click();
  await expect(page.locator('.thumb:has-text("a-small.png")')).toHaveClass(/keep/);
  await expect(page.locator("#removals")).toHaveText("0 marked for removal");
  await page.locator('.thumb:has-text("a-big.png")').focus();
  await page.keyboard.press("k");
  await expect(page.locator('.thumb:has-text("a-big.png")')).toHaveClass(/remove/);
  await page.keyboard.press("r");
  await expect(page.locator('.thumb:has-text("a-big.png")')).toHaveClass(/keep/);
  await expect(page.locator('.thumb:has-text("a-small.png")')).toHaveClass(/remove/);
});

test("exports the review as CSV", async ({ page }) => {
  await page.locator("#pick-files").setInputFiles(files);
  await expect(page.locator(".group")).toHaveCount(1);
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.locator("#export").click(),
  ]);
  expect(download.suggestedFilename()).toBe("lookalike-review.csv");
  const path = await download.path();
  const text = (await import("node:fs")).readFileSync(path, "utf8");
  expect(text).toContain("a-big.png");
  expect(text).toContain("a-small.png");
});

test("theme toggle cycles and sets data-theme", async ({ page }) => {
  const root = page.locator("html");
  await page.locator("#theme").click();
  await expect(root).toHaveAttribute("data-theme", "light");
  await page.locator("#theme").click();
  await expect(root).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(root).toHaveAttribute("data-theme", "dark");
  await page.locator("#theme").click();
  await expect(root).not.toHaveAttribute("data-theme", /.*/);
});

test("pick buttons are keyboard-focusable and open the file chooser", async ({ page }) => {
  const folder = page.getByRole("button", { name: "Choose folder" });
  await folder.focus();
  await expect(folder).toBeFocused();
  const [chooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.keyboard.press("Enter"),
  ]);
  await chooser.setFiles(files.slice(0, 2).map((f) => ({ ...f })));
  await expect(page.locator(".group")).toHaveCount(1);
});

test("marks are exposed as checkboxes with a checked state", async ({ page }) => {
  await page.locator("#pick-files").setInputFiles(files);
  const big = page.getByRole("checkbox", { name: "a-big.png: keep" });
  await expect(big).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("checkbox", { name: "a-small.png: remove" })).toHaveAttribute(
    "aria-checked",
    "false",
  );
});
