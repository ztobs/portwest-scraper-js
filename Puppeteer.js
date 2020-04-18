const {
  navTimeout,
  waitTimeout,
  sessionFile,
  timeDelay,
  timePageLoad,
  catSeperator,
  genPath,
} = require("./constants");

class Puppeteer {
  // browser
  chromium = require("chrome-aws-lambda");

  lodashId = require("lodash-id");

  init = async (cookie) => {
    // initialize db
    const low = require("lowdb");
    const fileSync = require("lowdb/adapters/FileSync");
    const adapter = new fileSync(genPath + "db.json");
    this.db = low(adapter);
    this.db.defaults({ products: [], state: {} }).write();
    this.db._.mixin(this.lodashId);

    // initialize browser
    this.browser = await this.chromium.puppeteer.launch({
      ignoreHTTPSErrors: true,
      headless: true,
      userDataDir: "./browser_data",
      args: [...this.chromium.args, "--single-process"],
      executablePath: await this.chromium.executablePath,
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
  getDom = async (selector = null) => {
    const dom = await this.page.evaluate((selector) => {
      let data = [];
      let node;
      if (selector) node = document.querySelectorAll(selector);
      else node = document.querySelectorAll("body");

      node.forEach((item) => {
        data.push(item.innerHTML);
      });
      return data;
    }, selector);
    return dom.length == 1 ? dom[0] : dom;
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
   * Save products to db
   */
  saveProductsUrl = async (clean = false) => {
    try {
      const catLinks = await this.getCats();
      const lastWriteId = this.db.get("state.prodLastWriteId").value();
      const lastWriteHref = this.db.get("state.prodLastWriteHref").value();
      const lastWriteCat = this.db.get("state.prodLastWriteCat").value();
      let counter = lastWriteId ? lastWriteId : 0;
      let start = counter < 1 ? true : false;
      console.log(start, "start");

      // loop through cats
      for (let i = 0; i < catLinks.length; i++) {
        const cat = catLinks[i];
        const prodLinks = await this.getProductLinksInCat(cat.href);

        // loop through products
        for (let j = 0; j < prodLinks.length; j++) {
          const pL = prodLinks[j];
          console.log(start, "start");
          console.log(lastWriteHref, counter);
          console.log(lastWriteCat, cat.text);

          if (start || lastWriteHref == pL) {
            // prevent saving if already saved, didnt just use counter because we would also control/prvent from page loading so not all cats will get here
            if (start === false) {
              start = true;
              counter++;
              continue;
            }

            this.db
              .get("products")
              .push({ id: counter, href: pL, cat: cat.text })
              .write();
            this.db.set("state.prodLastWriteId", counter).write();
            this.db.set("state.prodLastWriteHref", pL).write();
            this.db.set("state.prodLastWriteCat", cat.text).write();
            counter++;
            console.log(`id ${counter} written`);
          }
        }
      }
    } catch (error) {
      console.log(`cannot save to products database`, error);
      return null;
    }
  };

  /*
   * Get product links in cat
   */
  getProductLinksInCat = async (url) => {
    try {
      await this.open(url);
      return await this.page.evaluate(() => {
        const selector = ".product .product-title a";
        return [...document.querySelectorAll(selector)].map((ele) => ele.href);
      });
    } catch (error) {
      console.log(`cannot get products in cat url ${url}`);
      return null;
    }
  };

  /*
   * Get write product to csv
   */
  writeProductToCSV = async (product, filename) => {
    try {
      const createCsvWriter = require("csv-writer").createObjectCsvWriter;
      const csvWriter = createCsvWriter({
        path: "out.csv",
        header: [
          { id: "type", title: "Type" },
          { id: "sku", title: "SKU" },
          { id: "name", title: "Name" },
          { id: "published", title: "Published" },
          { id: "featured", title: "Is featured?" },
          { id: "visibility", title: "Visibility in catalog" },
          { id: "sDesc", title: "Short Description" },
          { id: "desc", title: "Description" },
          { id: "tax", title: "Tax Status" },
          { id: "inStock", title: "In stock?" },
          { id: "weight", title: "Weight" },
          { id: "reviews", title: "Allow customer reviews?" },
          { id: "note", title: "Purchase Note" },
          { id: "price", title: "Price" },
          { id: "stock", title: "Stock" },
          { id: "cat", title: "Categories" },
          { id: "img", title: "Images" },
          { id: "pos", title: "Position" },
          { id: "boxQty", title: "Box Quantity" },
          { id: "soh", title: "SOH" },
          { id: "item", title: "Item" },
          { id: "color", title: "Color" },
          { id: "size", title: "Size" },
        ],
      });
      csvWriter
        .writeRecords([product]) // returns a promise
        .then(() => {
          console.log(`${product.sku} written to csv`);
        });
    } catch (error) {
      console.log(`cannot write ${product.sku} to csv`);
    }
  };

  /*
   * Get Category level 2 link array
   */
  getCat2LinkArray = async () => {
    try {
      return await this.page.evaluate(() => {
        const selector =
          "body > div.page-wrapper > header > div > div.header-bottom > div > nav > ul > li:nth-child(1) .menu-title > :nth-child(1), body > div.page-wrapper > header > div > div.header-bottom > div > nav > ul > li:nth-child(2) .menu-title > :nth-child(1), body > div.page-wrapper > header > div > div.header-bottom > div > nav > ul > li:nth-child(3) .menu-title > :nth-child(1), body > div.page-wrapper > header > div > div.header-bottom > div > nav > ul > li:nth-child(4) .menu-title > :nth-child(1), body > div.page-wrapper > header > div > div.header-bottom > div > nav > ul > li:nth-child(5) .menu-title > :nth-child(1)";
        return [...document.querySelectorAll(selector)].map((ele) => {
          return { id: ele.href.split("/").pop(), text: ele.innerText };
        });
      });
    } catch (error) {
      console.log("cannot get link level 2 array");
      return null;
    }
  };

  /*
   * Get Categories
   */
  getCats = async () => {
    try {
      const cat2Links = await this.getCat2LinkArray();
      return await this.page.evaluate(
        ({ cat2Links, catSeperator }) => {
          const selector =
            "body > div.page-wrapper > header > div > div.header-bottom > div > nav > ul > li:nth-child(1) > div > div > div > div ul a, body > div.page-wrapper > header > div > div.header-bottom > div > nav > ul > li:nth-child(2) > div > div > div > div ul a, body > div.page-wrapper > header > div > div.header-bottom > div > nav > ul > li:nth-child(3) > div > div > div > div ul a, body > div.page-wrapper > header > div > div.header-bottom > div > nav > ul > li:nth-child(4) > div > div > div > div ul a, body > div.page-wrapper > header > div > div.header-bottom > div > nav > ul > li:nth-child(5) > div > div > div > div ul a";
          return [...document.querySelectorAll(selector)].map((ele) => {
            const split = ele.href
              .split("/")
              .filter((ee, ind) => ind === 4 || ind === 5 || ind === 7)
              .map((ez, indz) =>
                indz === 2 ? cat2Links.find((ei) => ei.id == ez).text : ez
              );

            return {
              href: ele.href,
              text: `${split[0]}${catSeperator}${split[2]}${catSeperator}${split[1]}`.toUpperCase(),
            };
          });
        },
        { cat2Links, catSeperator }
      );
    } catch (error) {
      console.log("cannot get category links");
      return null;
    }
  };

  /*
   * Get product data in array
   */
  getProductData = async () => {
    const productName = await this.getProductName();
    const productColors = await this.getProductColors();
    const productItemNames = await this.getProductItemNames();
    const productSizes = await this.getProductSizes();
    const productSOH = await this.getProductSOH();
    const productPrices = await this.getProductPrices();
    const productBoxQty = await this.getProductBoxQty();
    const productDesc = await this.getProductDesc();
    const productShortDesc = await this.getProductShortDesc();
    const productImages = await this.getProductImages();

    return {
      productName,
      productColors,
      productItemNames,
      productSizes,
      productSOH,
      productPrices,
      productBoxQty,
      productDesc,
      productShortDesc,
      productImages,
    };
  };

  /*
   * Get product name
   */
  getProductName = async () => {
    try {
      const ret = await this.page.evaluate(() => {
        const data = document.querySelector(
          "body > div.container > div.row > div > div > div > div.col-lg-8.col-md-9 > div > h2"
        ).innerText;
        return data;
      });
      return ret.split("-")[1].trim();
    } catch (error) {
      console.log("cannot fetch product name");
      return null;
    }
  };

  /*
   * Get product style
   */
  getProductStyle = async () => {
    try {
      const ret = await this.page.evaluate(() => {
        const data = document.querySelector(
          "body > div.container > div.row > div > div > div > div.col-lg-8.col-md-9 > div > h2"
        ).innerText;
        return data;
      });
      return ret.split("-")[0].trim();
    } catch (error) {
      console.log("cannot fetch product style");
      return null;
    }
  };

  /*
   * Get product colors
   */
  getProductColors = async (hrefTrue) => {
    try {
      const ret = await this.page.evaluate((hrefTrue) => {
        let data = [];
        document
          .querySelectorAll(
            "body > div.container > div.row > div > div > div > div.col-lg-8.col-md-9 > div > div.product-filters-container > div > ul li a"
          )
          .forEach((ele) => {
            if (hrefTrue) data.push(ele.href);
            else data.push(ele.title);
          });
        return data;
      }, hrefTrue);
      return ret;
    } catch (error) {
      console.log("cannot fetch product colors");
      return null;
    }
  };

  /*
   * Get product item names
   */
  getProductItemNames = async () => {
    try {
      const ret = await this.page.evaluate(() => {
        let data = [];
        document
          .querySelectorAll(
            "#content1 > form > div > table > tbody > tr td:nth-child(1)"
          )
          .forEach((ele) => {
            data.push(ele.innerText.trim());
          });
        return data;
      });
      return ret;
    } catch (error) {
      console.log("cannot fetch product item names");
      return null;
    }
  };

  /*
   * Get product sizes
   */
  getProductSizes = async () => {
    try {
      const ret = await this.page.evaluate(() => {
        let data = [];
        document
          .querySelectorAll(
            "#content1 > form > div > table > tbody > tr td:nth-child(2)"
          )
          .forEach((ele) => {
            data.push(ele.innerText.trim());
          });
        return data;
      });
      return ret;
    } catch (error) {
      console.log("cannot fetch product sizes");
      return null;
    }
  };

  /*
   * Get product SOH
   */
  getProductSOH = async () => {
    try {
      const ret = await this.page.evaluate(() => {
        let data = [];
        document
          .querySelectorAll(
            "#content1 > form > div > table > tbody > tr td:nth-child(3)"
          )
          .forEach((ele) => {
            data.push(ele.innerText.trim());
          });
        return data;
      });
      return ret;
    } catch (error) {
      console.log("Cannot fetch product SOH");
      return null;
    }
  };

  /*
   * Get product prices
   */
  getProductPrices = async () => {
    try {
      const ret = await this.page.evaluate(() => {
        let data = [];
        document
          .querySelectorAll(
            "#content1 > form > div > table > tbody > tr td:nth-child(5)"
          )
          .forEach((ele) => {
            data.push(ele.innerText.trim().replace("$", ""));
          });
        return data;
      });
      return ret;
    } catch (error) {
      console.log("Cannot fetch prices");
      return null;
    }
  };

  /*
   * Get product box qty
   */
  getProductBoxQty = async () => {
    try {
      const ret = await this.page.evaluate(() => {
        let data = [];
        document
          .querySelectorAll(
            "#content1 > form > div > table > tbody > tr td:nth-child(7)"
          )
          .forEach((ele) => {
            data.push(ele.innerText.trim());
          });
        return data;
      });
      return ret;
    } catch (error) {
      console.log("Cannot fetch prices");
      return null;
    }
  };

  /*
   * Get product description
   */
  getProductDesc = async () => {
    try {
      const ret = await this.page.evaluate(() => {
        const data1 = document.querySelector("#content3").innerHTML;
        const data2 = document.querySelector("#content4").innerHTML;
        return data1 + data2;
      });
      return ret;
    } catch (error) {
      console.log("cannot fetch product description");
      return null;
    }
  };

  /*
   * Get product images
   */
  getProductImages = async () => {
    try {
      const style = await this.getProductStyle();
      return await this.page.evaluate((style) => {
        let imgs1 = [];
        document
          .querySelectorAll("#carousel-custom-dots img")
          .forEach((ele) => {
            imgs1.push(ele.src);
          });
        // imgs1 is output here

        // get url attachments
        const atts = imgs1.map((im) => {
          const arr = im.split("/");
          const arr1 = arr[arr.length - 1].split("_");
          return arr1[arr1.length - 1].replace(".jpg", "");
        });
        atts.shift(); // remove the first
        //atts is output here

        // get color codes
        let colHref = [];
        document
          .querySelectorAll(
            "body > div.container > div.row > div > div > div > div.col-lg-8.col-md-9 > div > div.product-filters-container > div > ul li a"
          )
          .forEach((ele) => {
            colHref.push(ele.href);
          });
        const colCode = colHref.map((cc) => {
          const arr = cc.split("/");
          return arr[arr.length - 1];
        });
        //colCode is output here

        // split image url
        const imgUrlPartUrl = imgs1[0].split("/");
        imgUrlPartUrl.pop(); // remove the last
        const imgUrlPre = imgUrlPartUrl.join("/"); // back to string
        //imgUrlPre is output here

        // create new img urls
        const imgUrls = [];
        colCode.forEach((code) => {
          imgUrls.push(imgUrlPre + "/" + style + code + ".jpg");
          atts.forEach((att) => {
            imgUrls.push(imgUrlPre + "/" + style + code + "_" + att + ".jpg");
          });
        });
        //imgUrls is output here

        return imgUrls;
      }, style);
    } catch (error) {
      console.log(`cannot fetch product images: ${error}`);
      return null;
    }
  };

  /*
   * Get product short description
   */
  getProductShortDesc = async () => {
    try {
      const ret = await this.page.evaluate(() => {
        const data =
          document
            .querySelector("#content3")
            .innerText.trim()
            .replace(/\s\s+/g, " ")
            .substring(0, 300) + "...";
        return data;
      });
      return ret;
    } catch (error) {
      console.log("cannot fetch short description");
      return null;
    }
  };

  /*
   * Close the browser
   */
  close = () => {
    this.browser.close();
  };

  writeDom = async (selector) => {
    const data = await this.getDom(selector);
    this.writeToFile("./temp.html", data, "dom");
  };
}

module.exports = Puppeteer;
