const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer');

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;
const GOAL = 40000000;

// Time between scrapes (1 hour)
const SCRAPE_INTERVAL_MS = 60 * 60 * 1000;

// Data holders
let lastScrapedAt = 0;
let lastBase = 0;              // Scraped value
let estimationStartTime = 0;   // When we last scraped

// Estimation settings
const minRatePerSec = 0.5; // simulate $0.5/sec growth
const maxRatePerSec = 2;   // simulate up to $2/sec growth

// Scraping function (runs every 1 hour)
async function fetchRealValue() {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      timeout: 0
    });

    const page = await browser.newPage();
    await page.goto('https://teamwater.org', {
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    await page.waitForSelector('#ab_hero_total_amount_raised_number', {
      timeout: 15000
    });

    const totalStr = await page.$eval('#ab_hero_total_amount_raised_number', el => el.textContent.trim());
    const numericTotal = parseInt(totalStr.replace(/,/g, ''), 10);

    lastScrapedAt = Date.now();
    lastBase = numericTotal;
    estimationStartTime = lastScrapedAt;

    console.log(`✅ Scraped new amount: $${numericTotal.toLocaleString()}`);
  } catch (err) {
    console.error('❌ Scraping error:', err.message);
  } finally {
    if (browser) await browser.close();
  }
}

// Start by fetching immediately, then every 1 hour
fetchRealValue();
setInterval(fetchRealValue, SCRAPE_INTERVAL_MS);

// API route
app.get('/api/total_raised', (req, res) => {
  const now = Date.now();

  // Time since last scrape
  const elapsedSeconds = (now - estimationStartTime) / 1000;

  // Random growth rate between minRatePerSec and maxRatePerSec
  const ratePerSecond = Math.random() * (maxRatePerSec - minRatePerSec) + minRatePerSec;

  // Estimate added value since last scrape
  const estimatedIncrease = Math.floor(ratePerSecond * elapsedSeconds);

  // Final estimated value
  const estimatedNow = lastBase + estimatedIncrease;

  // Final values
  const percent = ((estimatedNow / GOAL) * 100).toFixed(2);
  const amountLeft = Math.max(GOAL - estimatedNow, 0);

  res.json({
    actual_raised: lastBase,
    estimated_highest_raised: estimatedNow,
    gained_last_24_hours: estimatedIncrease,
    goal: GOAL,
    percent_completed: `${percent}%`,
    amount_left: amountLeft,
    last_scraped_at: new Date(lastScrapedAt).toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Live donation simulator running on http://localhost:${PORT}`);
});
