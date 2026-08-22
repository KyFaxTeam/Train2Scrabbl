import { chromium } from 'playwright';

(async () => {
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('Navigating to Training page...');
  await page.goto('https://kyfaxteam.github.io/Train2Scrabbl/training');
  
  // Create a directory for screenshots if it doesn't exist
  import('fs').then(fs => {
    if (!fs.existsSync('./e2e/screenshots')) {
       fs.mkdirSync('./e2e/screenshots');
    }
  });

  await page.waitForTimeout(2000); // Give it time to load
  await page.screenshot({ path: 'e2e/screenshots/1-initial-load.png' });
  console.log('Saved screenshot 1-initial-load.png');

  // Try to find loading element or buttons
  try {
     const button = await page.waitForSelector('button, .btn, [role="button"]', { timeout: 3000 });
     if (button) {
         console.log('Found a button, taking screenshot of it');
         await button.screenshot({ path: 'e2e/screenshots/2-button.png' });
     }
  } catch (e) {
     console.log('No buttons found quickly.');
  }

  // Just capture full page after a long wait
  await page.waitForTimeout(5000);
  await page.screenshot({ path: 'e2e/screenshots/3-after-5s.png', fullPage: true });
  console.log('Saved screenshot 3-after-5s.png');
  
  const content = await page.content();
  console.log('Page content length:', content.length);
  
  await browser.close();
})();
