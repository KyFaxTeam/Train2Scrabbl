import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 400, height: 800 } });
  const page = await context.newPage();

  console.log('Navigating...');
  await page.goto('http://localhost:5173/Train2Scrabbl/dictionary');
  
  await page.waitForTimeout(2000);

  const cats = await page.locator('.bg-slate-50, .bg-white').all();
  for (const c of cats) {
      if ((await c.innerText()).includes('Mots de 4 lettres')) {
          await c.click();
          break;
      }
  }

  await page.waitForTimeout(1000);

  const entries = await page.locator('.flex.items-center.justify-between.cursor-pointer').all();
  for (const e of entries) {
      const text = await e.innerText();
      if (text.includes('+') && !text.includes('+1') && !text.includes('+2') && !text.includes('+3')) {
          console.log('Found entry with many extensions:', text.replace(/\n/g, ' '));
          await e.click();
          break;
      }
  }

  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'e2e/screenshots/dict-expanded.png' });
  console.log('Saved dict-expanded.png');

  const showMore = page.locator('text=Afficher plus');
  if (await showMore.isVisible()) {
      console.log('Found Afficher plus, clicking...');
      await showMore.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'e2e/screenshots/dict-page2.png' });
      console.log('Saved dict-page2.png');
  }

  const expandedHead = page.locator('.rotate-90').locator('..').locator('..');
  if (await expandedHead.isVisible()) {
      console.log('Clicking to close explicitly...');
      await expandedHead.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'e2e/screenshots/dict-warning.png' });
      console.log('Saved dict-warning.png');
  }

  await browser.close();
})();