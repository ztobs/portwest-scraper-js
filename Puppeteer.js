class Puppeteer {
  puppeteer = require("puppeteer");
  fs = require("fs");

  init = async (cookie) => {
    this.browser = await this.puppeteer.launch({ headless: true });
    this.page = await this.browser.newPage();
    await this.page.setViewport({
      width: 1280,
      height: 1024,
      deviceScaleFactor: 1,
    });
  };

  open = async (url, wait = "P", sessionPath = null) => {
    if (sessionPath) {
      const fs = require("fs");
      const cookiesString = fs.readFileSync(sessionPath, "utf8");
      const cookie = JSON.parse(cookiesString);
      await this.page.setCookie.apply(this.page, cookie);
    }
    await this.page.goto(url, wait == "F" ? { waitUntil: "networkidle0" } : {});
  };

  getDom = async (selector) => {
    const dom = await this.page.evaluate((selector) => {
      let data = [];
      const node = document.querySelectorAll(selector);
      node.forEach((item) => {
        data.push(item.innerText);
      });
      return data;
    }, selector);
    return dom;
  };

  screenshot = async (filename) => {
    await this.page.screenshot({ path: filename });
  };

  saveSession = async (filename) => {
    const fs = require("fs");
    const cookies = await this.page.cookies();
    this.writeToFile(filename, JSON.stringify(cookies, null, 2), "cookies");
  };

  writeToFile = (filename, data, log) => {
    const fs = require("fs");
    fs.writeFile(filename, data, function (err) {
      if (err) throw err;
      console.log(`${log} written to file`);
    });
  };

  type = async (selector, text, delay = 500) => {
    this.page.waitFor(delay);
    this.page.click(selector);
    this.page.keyboard.type(text);
  };

  login = async (cred) => {
    const loginPopBtnSelector =
      "body > div.page-wrapper > header > div > div.container > div.header-right > div.header-dropdown.dropdown-expanded > div > ul > li > a";
    const modalSelector = "#popUpWindow > div";
    await this.page.click(loginPopBtnSelector);
    await this.page.waitForSelector(modalSelector, { visible: true });

    await this.type("#email", cred.email);
    await this.type("#password", cred.password);
    await this.page.screenshot({ path: "./output/3.png" });
    await this.page.click(
      "#popUpWindow > div > div > table > tbody > tr > td > div.col-md-12.col-sm-12.col-lg-12 > form > div > input"
    );
    await this.page.waitFor(1000);
    // await page.waitForRequest(request => request.url() === 'http://example.com' && request.method() === 'GET');
    await this.page.screenshot({ path: "./output/4.png" });
  };

  close = () => {
    this.browser.close();
  };
}

module.exports = Puppeteer;
