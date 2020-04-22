import puppeteer from 'puppeteer';
import Conf from 'conf';
import fs from 'fs';
import { Parser } from 'json2csv';

// get config values
const config = new Conf({
  cwd: './',
});
const username: string = config.get('username');
const password: string = config.get('password');

// prepare csv parser and write stream
const writeStream = fs.createWriteStream('./results.csv');
const parser = new Parser({
  header: false,
});

interface WeightEntry {
  date: string;
  weight: string;
}

(async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  await page.goto('https://www.myfitnesspal.com/account/login');
  await page.type('#username', username);
  await page.type('#password', password);
  await page.click('input[type="submit"]');

  await page.waitFor(8000);

  let hasNextButton = true;
  let pageCount = 1;
  while (hasNextButton) {
    await page.goto(
      `https://www.myfitnesspal.com/measurements/edit?page=${pageCount}&type=1`
    );
    await page.waitFor(1000); // wait to rate limit scraping
    const weightEntries: WeightEntry[] = await page.evaluate(() => {
      const trs = Array.from(document.querySelectorAll('.table0 tbody tr'));
      return trs.map((tr) => {
        const tds = Array.from(tr.children);
        const date = tds[1].innerHTML;
        const weight = tds[2].innerHTML;
        return { date, weight };
      });
    });
    const csv = parser.parse(weightEntries);
    writeStream.write(csv + '\r\n');
    pageCount++;
    const nextButton = await page.$('a.next_page');
    hasNextButton = !!nextButton;
  }
  writeStream.close();

  await browser.close();
})();
