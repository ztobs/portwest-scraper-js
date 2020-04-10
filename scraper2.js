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

const sessionFile = "session.json";
const url = "https://portwest.co.uk/";
const cred = require("./pw_credentials.json");

(async () => {
  const pup = require("./Puppeteer");
  const Pup = await new pup();
  await Pup.init();
  //   await Pup.open(url, "./session.json");

  await Pup.open(url, "F");
  await Pup.login(cred);
  await Pup.saveSession(sessionFile);

  //   const data = await Pup.getDom(".menu-title");
  //   Pup.writeToFile("./output/dom.html", data);

  await Pup.screenshot("./output/shot.png");

  Pup.close();
})();
