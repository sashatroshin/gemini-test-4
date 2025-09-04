
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Listen for any uncaught exceptions on the page
  page.on('pageerror', (error) => {
    console.log('--- Page Error Found ---');
    console.log(`Error: ${error.message}`);
    console.log(`Stack: ${error.stack}`);
  });

  // Listen for console.error messages
  page.on('console', msg => {
    if (msg.type() === 'error') {
        console.log('--- Console.error Found ---');
        console.log(msg.text());
    }
  });

  const filePath = path.resolve(__dirname, 'index.html');
  await page.goto(`file://${filePath}`);

  // Keep the script running for a short period to ensure all events are captured
  await new Promise(resolve => setTimeout(resolve, 1000));

  await browser.close();
})();
