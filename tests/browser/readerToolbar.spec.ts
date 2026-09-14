import { expect, test } from '@playwright/test';

for (const width of [1440, 900, 768, 600, 375]) {
  test(`reader toolbar remains usable without horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/');

    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await expect(page.getByRole('button', { name: 'Contents' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Find' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Previous page' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Next page' })).toBeVisible();

    const trigger = page.getByRole('button', { name: 'More reader actions' });
    await trigger.focus();
    await page.keyboard.press('Enter');
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('menuitem', { name: 'Settings' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Keyboard shortcuts' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Previous chapter' })).toBeVisible();

    await page.keyboard.press('End');
    await expect(page.getByRole('menuitem', { name: 'Keyboard shortcuts' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('menuitem', { name: 'Settings' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(trigger).toBeFocused();
  });
}
