const puppeteer = require('puppeteer');
const express = require('express');
const app = express();
const log = require('debug')('mapbox-headless-poc');
const uuid = require('uuid/v4');
const fs = require('fs');

require('dotenv').config();

const pageLoadTimeout = 10000;

const html = fs
  .readFileSync(__dirname + '/map.html')
  .toString()
  .replace('/*key*/', process.env.MAP_STYLE_URL);

app.use((req, res, next) => {
  if (req.headers && req.headers.authorization) {
    const parts = req.headers.authorization.split(' ');
    if (
      parts.length === 2 &&
      parts[0] === 'Bearer' &&
      process.env.ACCESS_TOKEN === parts[1]
    ) {
      return next();
    }
  }

  return res.sendStatus(403);
});

app.get('/:lat/:lgn/:zoom', (req, res) => {
  const hash = uuid();
  const page = html
    .replace('/*lat*/', req.params.lat)
    .replace('/*lgn*/', req.params.lgn)
    .replace('/*zoom*/', req.params.zoom);

  capture(page)
    .then(buffer => {
      res.contentType('image/png');
      res.attachment(`${hash}.png`);
      return res.end(buffer, 'binary');
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

const capture = content =>
  new Promise(async (resolve, reject) => {
    try {
      const opts = {
        headless: false,
        args: ['--headless', '--hide-scrollbars', '--no-sandbox'],
      };

      const browser = await puppeteer.launch(opts);
      log('Loaded browser "Chrome"');

      const page = await browser.newPage();

      log('Loading content');
      await page.goto(`data:text/html,${content}`, {
        timeout: pageLoadTimeout,
        waitUntil: 'networkidle2',
      });

      log('Waiting for page to render');
      await page.waitForSelector('#done');

      await page.emulateMedia('screen');

      log('Capturing image screenshot');
      const buffer = await page.screenshot({
        clip: { x: 0, y: 0, width: 300, height: 64 },
      });

      log('Closing page process');
      await page.close();

      log('Closing browser process');
      await browser.close();

      return resolve(buffer);
    } catch (e) {
      return reject(e);
    }
  });
