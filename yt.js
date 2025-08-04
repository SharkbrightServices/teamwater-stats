const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer');

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;
const GOAL = 40000000;

let highestFetched = 0;
let lastDayTotal = 0;
let lastCheckTimestamp = 0;

app.get('/api/total_raised', async (req, res) => {
  let browser;

  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      timeout: 0
    });

    const page = await browser.newPage();
    await page.goto('https://teamwater.org', {
      waitUntil: 'networkidle0', // ensure full JS-loaded content
      timeout: 30000
    });

    await page.waitForSelector('#ab_hero_total_amount_raised_number', {
      timeout: 15000
    });

    const totalStr = await page.$eval('#ab_hero_total_amount_raised_number', el => el.textContent.trim());
    const numericTotal = parseInt(totalStr.replace(/,/g, ''), 10);

    if (numericTotal > highestFetched) highestFetched = numericTotal;

    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;

    let gainedLast24Hrs = 0;
    if (now - lastCheckTimestamp > oneDay) {
      lastDayTotal = numericTotal;
      lastCheckTimestamp = now;
    } else {
      gainedLast24Hrs = numericTotal - lastDayTotal;
    }

    const percent = ((numericTotal / GOAL) * 100).toFixed(2);
    const amountLeft = GOAL - numericTotal;

    res.json({
      actual_raised: numericTotal,
      estimated_highest_raised: highestFetched,
      goal: GOAL,
      percent_completed: `${percent}%`,
      amount_left: amountLeft,
      gained_last_24_hours: gainedLast24Hrs
    });
  } catch (err) {
    console.error('❌ Scraping error:', err.message);
    res.status(500).json({ error: 'Scraping failed', message: err.message });
  } finally {
    if (browser) await browser.close();
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
