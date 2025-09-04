
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('https://barbalance.sashatroshin.ru/');
  await page.screenshot({ path: 'screenshot.png' });
  await browser.close();
  console.log('Скриншот сохранен в файл screenshot.png');
})();
