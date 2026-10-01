import { expect, test } from "@playwright/test";

test("pick a match, a round, and jump to an event", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText(/isn't endorsed by Riot Games/)).toBeVisible();
  await expect(page.getByText("Sample data")).toBeVisible();

  await page.getByRole("button", { name: /Ascent 13–11 win/ }).click();
  await expect(page.getByRole("heading", { name: "Ascent" })).toBeVisible();
  await expect(page.getByText(/No positions yet/)).toBeVisible();

  await page.getByRole("tab", { name: /^Round 3:/ }).click();
  await expect(page.getByText("Round 03", { exact: true })).toBeVisible();

  await page
    .getByRole("button", { name: /^Jump to/ })
    .first()
    .click();
  await expect(page.getByText(/Known positions · \d:\d\d kill/)).toBeVisible();
  await expect(page.getByRole("img", { name: /minimap with player positions/ })).toBeVisible();

  await page.getByRole("tab", { name: "Economy" }).click();
  await expect(page.getByText("Your team")).toBeVisible();
});

test("3D view builds a blockout and switches to a killer's POV", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto("/");
  await page.getByRole("button", { name: /Ascent 13–11 win/ }).click();
  await page
    .getByRole("button", { name: /^Jump to/ })
    .first()
    .click();
  await page.getByRole("button", { name: "3d" }).click();
  await expect(page.locator("canvas")).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: /Killer's view/ }).click();
  await expect(page.getByRole("radio", { name: "POV" })).toBeChecked();
  await expect(page.getByText(/Where they actually looked isn't in the data/)).toBeVisible();
  // Switching matches tears the canvas down; that must not throw.
  await page.getByRole("button", { name: /Haven/ }).click();
  await expect(page.locator("canvas")).toBeVisible({ timeout: 15_000 });
  expect(errors).toEqual([]);
});

test("the API refuses a match the player was not in", async ({ page }) => {
  const res = await page.request.get("/api/matches/fx-match-0004-not-own");
  expect(res.status()).toBe(404);
});
