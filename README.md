# Puppeteer + JavaScript

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/deploy/puppeteer-js?referralCode=dPr4mc)

A minimal [Puppeteer](https://pptr.dev) starter for Railway, written in plain JavaScript. It opens a page in headless Chrome, logs the title and main heading, and closes the browser. Put your own scraping logic in `scrapeWebsite()` in `index.js`; there are commented examples to start from.

After the scrape the service keeps running with a small health endpoint, so Railway sees a healthy deployment. Set `SCRAPE_INTERVAL_MINUTES` to repeat the scrape on a schedule.

Railway builds it with [Railpack](https://railpack.com), which installs Chrome's system libraries when it detects Puppeteer. Puppeteer downloads its own Chrome during `npm ci` (`yauzl` is a dependency so it can unzip Chrome without a system `unzip`), and `railway.toml` starts it with `node index.js` so it shuts down cleanly.

## Environment variables

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `3000` | Port for the health endpoint (Railway sets this) |
| `SCRAPE_INTERVAL_MINUTES` | not set | Repeat the scrape every N minutes. If not set, it runs once at startup. |

## Run locally

Requires Node.js 22.12 or newer (Puppeteer 25 minimum). Railway runs the Node version from `engines` in `package.json` (26.x, the current LTS).

```bash
npm install
npm start       # or: npm run dev to restart on file changes
```
