const {
  navTimeout,
  waitTimeout,
  sessionFile,
  timeDelay,
  timePageLoad,
} = require("./constants");

class Puppeteer {
  puppeteer = require("puppeteer");
  fs = require("fs");

  init = async (cookie) => {
    this.browser = await this.puppeteer.launch({
      ignoreHTTPSErrors: true,
      headless: true,
      userDataDir: "./browser_data",
    });
    this.page = await this.browser.newPage();
    await this.page.setViewport({
      width: 1280,
      height: 1024,
      deviceScaleFactor: 1,
    });
    await this.page.setDefaultNavigationTimeout(navTimeout);
    await this.page.setDefaultTimeout(waitTimeout);
  };

  /*
   * Produces element dom in text
   */
  getDom = async (selector) => {
    const dom = await this.page.evaluate((selector) => {
      let data = [];
      const node = document.querySelectorAll(selector);
      node.forEach((item) => {
        data.push(item.innerHTML);
      });
      return data;
    }, selector);
    return dom;
  };

  /*
   * Creates screenshots
   */
  screenshot = async (filename) => {
    await this.page.screenshot({ path: filename });
  };

  /*
   * opens a url in browser page
   */
  open = async (url, wait = "P") => {
    await this.page.goto(url, wait == "F" ? { waitUntil: "networkidle0" } : {});

    if (wait === "F") await this.page.waitFor(timePageLoad);
  };

  /*
   * saves session to file
   */
  saveSession = async () => {
    const cookies = await this.page.cookies();
    this.writeToFile(sessionFile, JSON.stringify(cookies, null, 2), "cookies");
  };

  /*
   * writes text to file
   */
  writeToFile = (filename, data, log) => {
    const fs = require("fs");
    fs.writeFile(filename, data, function (err) {
      if (err) throw err;
      console.log(`${log} written to file`);
    });
  };

  /*
   * Uses Puppetter's inbrowser console to write text to input
   */
  type = async (selector, text, delay = 1000) => {
    await this.page.waitFor(delay);
    // this.page.type(selector, text);
    await this.page.evaluate(
      ({ selector, text }) => {
        document.querySelector(selector).value = text;
      },
      { selector, text }
    );
  };

  /*
   * Login to portwest.co.uk
   */
  login = async (cred) => {
    try {
      await this.type("#email", cred.email);
      await this.type("#password", cred.password);
      await this.page.click("body > div > div > div > form > input");
      await this.page.waitFor(timePageLoad);
    } catch (e) {
      console.log("Can't login, maybe already did");
    }
  };

  /*
   * load portwest product page after using search box
   */
  loadProductPage = async (style) => {
    await this.page.screenshot({ path: "./output/b4-prodPage.png" });
    await this.type("#new_search", style);
    await this.page.click(
      "body > div.page-wrapper > header > div > div.container > div.header-left.header-dropdowns > div.header-left > div > form > div > button"
    );
    await this.page.waitFor(timePageLoad);
    await this.page.screenshot({ path: "./output/prodPage.png" });
  };

  /*
   * Get product data in array
   */
  getProductData = async () => {
    return await this.page.evaluate(() => {
      const data = document.querySelector(
        "body > div.container > div.row > div > div > div > div.col-lg-8.col-md-9 > div > h2"
      ).plaintext;
      return data;
    });
  };

  /*
   * Close the browser
   */
  close = () => {
    this.browser.close();
  };
}

module.exports = Puppeteer;
