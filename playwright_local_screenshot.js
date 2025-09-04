
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:8000');
  await page.screenshot({ path: 'local_screenshot.png' });
  await browser.close();
  console.log('Локальный скриншот сохранен в файл local_screenshot.png');
})();
