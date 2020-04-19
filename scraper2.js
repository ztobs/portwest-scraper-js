// const cheerio = require("cheerio");
// const puppeteer = require("puppeteer");
// const fs = require("fs");

// (async () => {
//   const browser = await puppeteer.launch({ headless: true });
//   const page = await browser.newPage();
//   await page.goto(url);
//   await page.screenshot({ path: "example.png" });
//   //   const html = await page.content();

//   //   await fs.writeFile("./output/page.html", html, (err) => {
//   //     if (err) console.log(err);
//   //   });

//   const runner = await page.evaluate(() => {
//     const data = [];
//     const sele = ".itemMenuName.level2";
//     // const sele = ".itemMenuName";
//     document.querySelectorAll(sele).forEach((m) => {
//       data.push(m.textContent, m.href);
//     });
//     return data;
//   });

//   await console.log(runner);

//   await browser.close();
// })();

/////////////////////////////////////////////////////
// const getDom = (url, type='P') => {};

// const domFull = (url) => {};

// const domPart = async (url) => {
//   const axios = require("axios");
//   const dom = await axios.get(url);
//   return dom;
// };
require("events").EventEmitter.defaultMaxListeners = 0;

const url = "https://portwest.co.uk/";
const cred = require("./pw_credentials.json");

(async () => {
  const pup = require("./Puppeteer");
  const Pup = await new pup();
  await Pup.init();

  // // login to portwest
  // await Pup.open("https://portwest.co.uk/main/login/", "F");
  // await Pup.login(cred);

  // await Pup.saveSession();
  // await Pup.screenshot("./output/afterlogin.png");

  // load any F**cking page
  await Pup.open("https://portwest.co.uk/main/login/"); // we should be redirected automatically to main page here

  // get all product links and save to temp db
  // await Pup.saveProductsUrl();

  // loop through the products db in temp and load and write to csv
  await Pup.final();

  Pup.close();
})().catch((err) => console.log(err));

// dont use '/' to seperate product variations because some colors already use it, use '|'

/* todo
 * Dont save product urls already saved *done*
 * Dont load cat links already fetched
 * navigate through products saved in temp db and load the products
 * dont write products already written to csv
 */
