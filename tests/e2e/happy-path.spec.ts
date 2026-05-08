import { test, expect } from '@playwright/test';

// Custom listbox: click trigger (associated with visible label), then click option.
async function pick(page: import('@playwright/test').Page, field: string, value: string) {
  await page.getByLabel(field, { exact: true }).click();
  await page.getByRole('option', { name: value, exact: true }).click();
}

test('happy path: pick settings, roll, see result, copy seed', async ({ page, context }) => {
  await page.goto('/');

  await pick(page, 'Climate', 'Temperate');
  await pick(page, 'Environment', 'Forest');
  await pick(page, 'Season', 'Summer');
  await pick(page, 'Time of day', 'Day');
  await pick(page, 'Region', 'Frontier');

  // Default mood is "Mixed" - confirm the radio is checked before rolling.
  await expect(page.getByRole('radio', { name: 'Mixed' })).toBeChecked();

  const rollBtn = page.locator('button.roll');
  await expect(rollBtn).not.toBeDisabled();
  await rollBtn.click();

  const seedCode = page.locator('code').first();
  await expect(seedCode).toBeVisible({ timeout: 5000 });
  const seedText = await seedCode.textContent();
  expect(seedText).toBeTruthy();
  expect(Number.isInteger(Number(seedText))).toBe(true);

  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.click('button:has-text("Copy")');

  const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboardText).toBe(seedText);
});

test('mood toggle: "Hostile only" forces a Hostile attitude when an encounter occurs', async ({
  page
}) => {
  await page.goto('/');

  await pick(page, 'Climate', 'Temperate');
  await pick(page, 'Environment', 'Forest');
  await pick(page, 'Season', 'Summer');
  await pick(page, 'Time of day', 'Day');
  // Hostile region (1.8x) + noise (1.6x) drives encounter chance to ~0.72/roll,
  // so up to 20 rerolls is statistically deterministic.
  await pick(page, 'Region', 'Hostile');
  // Inputs are visually hidden inside their label wrapper, so the label
  // intercepts clicks - .check({ force: true }) is the documented Playwright
  // pattern for this case (the label is still the intended click target).
  await page.getByRole('checkbox', { name: 'Making noise' }).check({ force: true });

  const hostileMood = page.getByRole('radio', { name: 'Hostile only' });
  await hostileMood.check({ force: true });
  await expect(hostileMood).toBeChecked();
  await expect(page.getByRole('radio', { name: 'Mixed' })).not.toBeChecked();

  await page.locator('button.roll').click();
  await expect(page.locator('code').first()).toBeVisible({ timeout: 5000 });

  const attitudePill = page.locator('.attitude');
  const rerollEncounter = page.getByRole('button', { name: 'Encounter', exact: true });

  for (let i = 0; i < 20; i++) {
    if (await attitudePill.isVisible()) break;
    await rerollEncounter.click();
  }

  await expect(attitudePill).toBeVisible();
  await expect(attitudePill).toHaveText('Hostile');
  await expect(attitudePill).toHaveAttribute('data-attitude', 'hostile');
});
