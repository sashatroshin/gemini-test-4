const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Listen for all network requests and log their status
  page.on('response', response => {
    console.log(`<< ${response.status()} ${response.url()}`);
  });

  await page.goto('https://barbalance.sashatroshin.ru/');

  await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for network events

  await browser.close();
})();