const puppeteer = require('puppeteer');
const express = require('express');
const app = express();
const log = require('debug')('mapbox-headless-poc');
const uuid = require('uuid/v4');
const fs = require('fs');

require('dotenv').config();

const pageLoadTimeout = 10000;

const chrome = {
  browser: null,
};

const html = fs
  .readFileSync(__dirname + '/map.html')
  .toString()
  .replace('/*key*/', process.env.MAP_STYLE_URL);

(async () => {
  if (!fs.existsSync('out')) {
    fs.mkdirSync('out');
  }

  const opts = {
    headless: false,
    args: ['--headless', '--hide-scrollbars', '--no-sandbox'],
  };

  chrome.browser = await puppeteer.launch(opts);

  log('Loaded browser "Chrome"');
})();

app.get('/:lat/:lgn/:zoom', (req, res) => {
  const hash = uuid();

  const page = html
    .replace('/*lat*/', req.params.lat)
    .replace('/*lgn*/', req.params.lgn)
    .replace('/*zoom*/', req.params.zoom);

  capture(page, hash)
    .then(() => {
      const path = __dirname + `/out/${hash}.png`;
      const image = fs.readFileSync(path);
      fs.unlinkSync(path);
      res.contentType('image/png');
      return res.end(image, 'binary');
    })
    .catch(e => {
      console.error(e);
      return res.sendStatus(500);
    });
});

app.get('*', (req, res) => {
  return res.sendStatus(404);
});

app.listen(process.env.PORT, () => {
  log(`Server running on ${process.env.PORT}...`);
});

const capture = (content, hash) =>
  new Promise(async (resolve, reject) => {
    try {
      const page = await chrome.browser.newPage();

      log('Loading content');
      await page.goto(`data:text/html,${content}`, {
        timeout: pageLoadTimeout,
        waitUntil: 'networkidle2',
      });

      log('Waiting for page to render');
      await page.waitForSelector('#done');

      await page.emulateMedia('screen');

      const path = `./out/${hash}.png`;
      log('Capturing image screenshot to "%s"', path);
      await page.screenshot({
        path,
        clip: { x: 0, y: 0, width: 300, height: 64 },
      });

      log('Closing page process');
      await page.close();

      return resolve();
    } catch (e) {
      return reject(e);
    }
  });

process.on('SIGINT', async () => {
  process.stdin.resume();

  log('Closing browser process');
  await browser.close();

  process.exit(0);
});
