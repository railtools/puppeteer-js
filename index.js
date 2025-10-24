const express = require("express");
const puppeteer = require("puppeteer");

const app = express();
const PORT = process.env.PORT || 3000;

// Update these with your real login
const LOGIN_URL = "https://hartsaccounting.3cx.co.nz:5001";
const EMAIL = "trentpinet@gmail.com"; // <--- change this
const PASSWORD = "William97!!2";  // <--- change this

//updated credentials
const email = process.env.C3CX_EMAIL;
const password = process.env.C3CX_PASSWORD;


app.get("/callcontrol", async (req, res) => {
  try {
    const browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    await page.goto(LOGIN_URL, { waitUntil: "networkidle2" });

    // STEP 1: Fill login form
    await page.type('input[name="email"]', email);
    await page.type('input[name="password"]', password);
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation({ waitUntil: "networkidle2" }),
    ]);

    // STEP 2: Navigate to Extension Status page
    await page.goto(`${LOGIN_URL}/#/extensions`, { waitUntil: "networkidle2" });

    // STEP 3: Wait for extension table to load
    await page.waitForSelector(".status-name");

    // STEP 4: Scrape available statuses
    const statuses = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll(".status-name"));
      return rows.map(row => row.innerText.trim());
    });

    await browser.close();
    return res.json({ statuses });
  } catch (err) {
    return res.status(500).json({ error: err.toString() });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
