import { chromium } from 'playwright';

(async () => {
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));
  page.on('response', resp => {
      if (resp.status() >= 400) console.log('NETWORK ERROR:', resp.status(), resp.url());
  });
  page.on('requestfailed', request => console.log('REQUEST FAILED:', request.url(), request.failure()?.errorText));

  page.on('worker', async worker => {
    console.log('Worker spawned:', worker.url());
    worker.on('console', msg => console.log('WORKER CONSOLE:', msg.text()));
    
    // Inject something to see what happens on errors
    try {
       await worker.evaluate(() => {
          self.addEventListener('error', e => console.log('Worker Unhandled Error:', e.message));
          self.addEventListener('unhandledrejection', e => console.log('Worker Unhandled Rejection:', e.reason));
          
          // Poll the status
          setInterval(() => {
             console.log('Worker ping, alive.');
          }, 2000);
       });
    } catch(e) { console.log('Error injecting to worker', e); }
  });

  await context.addInitScript(() => {
    // Intercept promises and console locally
    window.addEventListener('unhandledrejection', e => {
      console.log('UNHANDLED REJECTION:', e.reason);
    });
    
    // Polyfill or override trainingService so we know if it entered
    const origFetch = window.fetch;
    window.fetch = async function() {
      console.log('Fetch called:', arguments[0]);
      try {
        const res = await origFetch.apply(window, arguments as any);
        console.log('Fetch resolved:', arguments[0], res.status);
        const cloned = res.clone();
        cloned.text().then(t => console.log('Fetch parsed text length:', t.length)).catch(e => console.log('Text error', e.message));
        return res;
      } catch(e: any) {
        console.log('Fetch errored out:', e.message);
        throw e;
      }
    };
    
    // We can also spy on IndexedDB
    const origOpenDB = window.indexedDB.open.bind(window.indexedDB);
    window.indexedDB.open = function(name, version) {
        console.log('idb.open called:', name, version);
        const req = origOpenDB(name, version);
        req.addEventListener('success', () => {
            console.log('idb open success');
            const db = req.result;
            const origTransaction = db.transaction.bind(db);
            db.transaction = function() {
                console.log('idb transaction:', arguments[0], arguments[1]);
                const tx = origTransaction.apply(db, arguments as any);
                const origObjectStore = tx.objectStore.bind(tx);
                tx.objectStore = function(storeName) {
                    console.log('idb objectStore:', storeName);
                    const store = origObjectStore(storeName);
                    const origGetAll = store.getAll.bind(store);
                    store.getAll = function() {
                        console.log('idb getAll called on', storeName);
                        const req2 = origGetAll.apply(store, arguments as any);
                        req2.onsuccess = () => console.log('idb getAll success on', storeName);
                        req2.onerror = e => console.log('idb getAll error on', storeName, e);
                        return req2;
                    };
                    return store;
                };
                return tx;
            }
        });
        return req;
    };
  });

  console.log('Navigating to Training page...');
  try {
    await page.goto('https://kyfaxteam.github.io/Train2Scrabbl/training', { waitUntil: 'domcontentloaded', timeout: 15000 });
  } catch (e) {
    console.log('Goto timed out, continuing anyway...');
  }
  
  await page.waitForTimeout(60000);
  
  await page.screenshot({ path: 'e2e/screenshots/step1_initial.png', fullPage: true });
  console.log('Saved step1_initial.png');

  try {
    // Try to find any interactable elements to start a training session
    // Assuming there are training mode options like "Daily", "Random", etc.
    const buttons = await page.locator('button');
    const buttonCount = await buttons.count();
    console.log(`Found ${buttonCount} buttons`);
    
    if (buttonCount > 0) {
        // Find buttons with 'Commencer' or any class
        const startButton = page.locator('button').first();
        await startButton.click();
        console.log('Clicked first button');
        await page.waitForTimeout(4000);
        await page.screenshot({ path: 'e2e/screenshots/step2_after_click_first.png', fullPage: true });
    }
    
    // Take a screenshot of the DOM tree for debugging
    const html = await page.content();
    import('node:fs').then(fs => fs.writeFileSync('e2e/screenshots/dom_dump.html', html));

  } catch (e) {
    console.error('Error during interaction:', e);
  }
  
  await browser.close();
})();
