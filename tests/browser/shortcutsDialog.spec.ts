import { expect, test, type Page } from '@playwright/test';

async function openShortcutsDialog(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'More reader actions' }).click();
  const helpButton = page.getByRole('menuitem', { name: 'Keyboard shortcuts' });
  await helpButton.click();
  return { dialog: page.getByRole('dialog', { name: 'Keyboard shortcuts' }), helpButton };
}

test('shortcuts dialog traps focus and restores it after Escape', async ({ page }) => {
  const { dialog, helpButton } = await openShortcutsDialog(page);
  const closeButton = dialog.getByRole('button', { name: 'Close' });

  await expect(dialog).toBeVisible();
  await expect(closeButton).toBeFocused();

  await page.keyboard.press('Tab');
  await expect(closeButton).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(closeButton).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(helpButton).toBeFocused();
});

test('shortcuts dialog restores focus after close-button dismissal', async ({ page }) => {
  const { dialog, helpButton } = await openShortcutsDialog(page);

  await dialog.getByRole('button', { name: 'Close' }).click();

  await expect(dialog).toBeHidden();
  await expect(helpButton).toBeFocused();
});

test('shortcuts dialog restores focus after pointer dismissal', async ({ page }) => {
  const { dialog, helpButton } = await openShortcutsDialog(page);
  const backdrop = page.getByRole('button', { name: 'Close keyboard shortcuts' });

  await expect(backdrop).toHaveAttribute('tabindex', '-1');
  await backdrop.click({ position: { x: 5, y: 5 } });

  await expect(dialog).toBeHidden();
  await expect(helpButton).toBeFocused();
});
