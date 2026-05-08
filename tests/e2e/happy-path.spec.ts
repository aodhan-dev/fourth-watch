import { test, expect } from '@playwright/test';

test('happy path: pick settings, roll, see result, copy seed', async ({ page, context }) => {
  await page.goto('/');

  // Custom listbox: click trigger (associated with visible label), then click option.
  async function pick(field: string, value: string) {
    await page.getByLabel(field, { exact: true }).click();
    await page.getByRole('option', { name: value, exact: true }).click();
  }

  await pick('Climate', 'Temperate');
  await pick('Environment', 'Forest');
  await pick('Season', 'Summer');
  await pick('Time of day', 'Day');
  await pick('Region', 'Frontier');

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
