const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer');

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;

// Configuration
const GOAL = 40000000; // $40M in plain number

let highestFetched = 0;
let lastDayTotal = 0;
let lastCheckTimestamp = 0;

app.get('/api/total_raised', async (req, res) => {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    console.log('Navigating to site...');
    await page.goto('https://teamwater.org', { waitUntil: 'networkidle2' });

    // Let the page fully render
    await new Promise(r => setTimeout(r, 5000));

    console.log('Waiting for selector...');
    await page.waitForSelector('#ab_hero_total_amount_raised_number', { timeout: 15000 });

    console.log('Extracting total...');
    const totalStr = await page.evaluate(() => {
      const el = document.querySelector('#ab_hero_total_amount_raised_number');
      return el ? el.textContent.trim() : null;
    });

    if (!totalStr) throw new Error('Could not extract total');

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

    await browser.close();

    const percentageCompleted = ((numericTotal / GOAL) * 100).toFixed(2);
    const amountLeft = GOAL - numericTotal;

    res.json({
      actual_raised: numericTotal,
      estimated_highest_raised: highestFetched,
      goal: GOAL,
      percent_completed: `${percentageCompleted}%`,
      amount_left: amountLeft,
      gained_last_24_hours: gainedLast24Hrs
    });

  } catch (err) {
    console.error('❌ ERROR:', err.message);
    if (browser) await browser.close();
    res.status(500).json({ error: 'Scraping failed', message: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server listening on http://localhost:${PORT}`);
});
