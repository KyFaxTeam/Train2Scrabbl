const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:5173/Train2Scrabbl/codex');
  await page.waitForTimeout(2000);
  await page.getByRole('button', { name: 'Recherche', exact: true }).click();
  await page.waitForTimeout(1000);
  const searchInput = page.locator('input[placeholder*="Rechercher"]');
  await searchInput.fill("WALLABY");
  await page.waitForTimeout(2000);
  const html = await page.content();
  console.log("HTML length:", html.length);
  const text = await page.innerText('body');
  console.log("PAGE TEXT:", text);
  await browser.close();
})();
