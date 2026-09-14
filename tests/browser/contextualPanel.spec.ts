import { expect, test, type Page } from '@playwright/test';

async function openContents(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Contents' }).click();
}

test('pinning is offered only at the supported viewport width', async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 800 });
  await openContents(page);
  await expect(page.getByRole('dialog', { name: 'Contents' }).getByRole('button', { name: 'Pin' })).toBeVisible();

  await page.setViewportSize({ width: 1099, height: 800 });
  await expect(page.getByRole('dialog', { name: 'Contents' }).getByRole('button', { name: 'Pin' })).toHaveCount(0);
});

test('a pinned panel becomes a temporary modal when the viewport narrows', async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 800 });
  await openContents(page);
  await page.getByRole('dialog', { name: 'Contents' }).getByRole('button', { name: 'Pin' }).click();

  await expect(page.getByRole('complementary', { name: 'Contents' })).toBeVisible();
  await page.setViewportSize({ width: 1099, height: 800 });

  const temporaryPanel = page.getByRole('dialog', { name: 'Contents' });
  await expect(temporaryPanel).toBeVisible();
  await expect(temporaryPanel).toHaveAttribute('aria-modal', 'true');
  await expect(temporaryPanel.getByRole('button', { name: /^(Pin|Unpin)$/ })).toHaveCount(0);
  await expect(page.locator('button.sheet-backdrop[aria-label="Close Contents"]')).toBeVisible();
});

test('the temporary panel backdrop stays translucent when hovered', async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 800 });
  await openContents(page);

  const backdrop = page.locator('button.sheet-backdrop[aria-label="Close Contents"]');
  const backgroundBeforeHover = await backdrop.evaluate(element => getComputedStyle(element).backgroundColor);
  await backdrop.hover({ position: { x: 10, y: 400 } });

  await expect(backdrop).toHaveCSS('background-color', backgroundBeforeHover);
  await expect(backdrop).toHaveCSS('background-color', 'rgba(15, 23, 42, 0.42)');
});
