import { expect, test } from '@playwright/test';
import { readerFontStylesheet } from '../../src/lib/readerAssets';

test('OpenDyslexic is loaded and applied inside an EPUB iframe', async ({ page }) => {
  await page.goto('/');
  await page.setContent(`
    <label>Font family
      <select aria-label="Font family">
        <option value="inherit">OS default</option>
        <option value='"Open Dyslexic", OpenDyslexic, sans-serif'>Open Dyslexic</option>
      </select>
    </label>
    <iframe title="EPUB chapter"></iframe>
  `);

  const css = readerFontStylesheet();
  await page.locator('select[aria-label="Font family"]').selectOption({ label: 'Open Dyslexic' });
  const selectedFamily = await page.locator('select[aria-label="Font family"]').inputValue();
  const frame = page.frames().find(candidate => candidate !== page.mainFrame());
  expect(frame).toBeTruthy();

  await frame!.evaluate(({ stylesheet, family }) => {
    const style = document.createElement('style');
    style.dataset.readerFonts = '';
    style.textContent = stylesheet;
    document.head.append(style);
    document.body.innerHTML = '<p id="chapter-text">Accessible chapter text</p>';
    document.body.style.setProperty('font-family', family, 'important');
  }, { stylesheet: css, family: selectedFamily });

  await frame!.evaluate(() => document.fonts.ready);
  const result = await frame!.evaluate(() => ({
    computedFamily: getComputedStyle(document.querySelector('#chapter-text')!).fontFamily,
    loaded: document.fonts.check('16px "Open Dyslexic"'),
  }));

  expect(result.computedFamily).toContain('Open Dyslexic');
  expect(result.loaded).toBe(true);
});
