import { test, expect } from '@playwright/test';

test('happy path: pick settings, roll, see result, copy seed', async ({ page, context }) => {
  await page.goto('/');

  // Pick the five required settings (selects are associated via <label for=>,
  // so use getByLabel rather than aria-label which the form doesn't set).
  await page.getByLabel('Climate').selectOption('Temperate');
  await page.getByLabel('Environment').selectOption('Forest');
  await page.getByLabel('Season').selectOption('Summer');
  await page.getByLabel('Time of day').selectOption('Day');
  await page.getByLabel('Region').selectOption('Frontier');

  // Roll button should now be enabled
  const rollBtn = page.locator('button.roll');
  await expect(rollBtn).not.toBeDisabled();
  await rollBtn.click();

  // Wait for the result panel to appear (seed code element becomes visible)
  const seedCode = page.locator('code').first();
  await expect(seedCode).toBeVisible({ timeout: 5000 });
  const seedText = await seedCode.textContent();
  expect(seedText).toBeTruthy();
  expect(Number.isInteger(Number(seedText))).toBe(true);

  // Click the Copy button and verify the seed lands in the clipboard
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.click('button:has-text("Copy")');

  const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboardText).toBe(seedText);
});
