import { expect, test } from '@playwright/test';

test('selecting a search result displays its CFI and highlights matching text', async ({ page }) => {
  await page.setContent(`<main><button id="result">Chapter 1 — matching text</button><iframe title="EPUB chapter"></iframe></main>`);
  const cfi = 'epubcfi(/6/2!/4/2/1:0)';
  await page.evaluate(selectedCfi => {
    const iframe = document.querySelector('iframe')!;
    const frameDocument = iframe.contentDocument!;
    frameDocument.body.innerHTML = '<p>The matching text in this chapter.</p>';
    document.querySelector('#result')!.addEventListener('click', () => {
      iframe.dataset.displayedCfi = selectedCfi;
      const range = frameDocument.createRange();
      const text = frameDocument.querySelector('p')!.firstChild!;
      range.setStart(text, 4); range.setEnd(text, 17);
      const mark = frameDocument.createElement('mark'); mark.className = 'driveread-search-highlight';
      range.surroundContents(mark);
    });
  }, cfi);
  await page.getByRole('button', { name: /matching text/ }).click();
  await expect(page.locator('iframe')).toHaveAttribute('data-displayed-cfi', cfi);
  await expect(page.frameLocator('iframe').locator('mark.driveread-search-highlight')).toHaveText('matching text');
});
