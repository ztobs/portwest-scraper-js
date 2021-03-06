const {
  navTimeout,
  waitTimeout,
  sessionFile,
  timeDelay,
  timePageLoad,
  catSeperator,
  genPath,
  dbFile,
  attrSeperator,
  outputPath,
  finalProdCSV,
} = require("./constants");

class Puppeteer {
  //
  chromium = require("chrome-aws-lambda");
  createCsvWriter = require("csv-writer").createObjectCsvWriter;
  lodashId = require("lodash-id");
  fs = require("fs");

  init = async (resume) => {
    let append = false;
    this.resume = resume;
    if (!resume) await this.cleanup();
    if (this.fs.existsSync(outputPath + finalProdCSV)) append = true;

    // initialize db
    const low = require("lowdb");
    const fileSync = require("lowdb/adapters/FileSync");
    const adapter = new fileSync(genPath + dbFile);
    this.db = low(adapter);
    this.db.defaults({ products: [], state: {} }).write();
    this.db._.mixin(this.lodashId);

    // initialize product csv writer
    this.productCSVWriter = this.createCsvWriter({
      path: outputPath + finalProdCSV,
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
      append: append,
    });

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
   * cleanup all esisting data and start fresh
   */
  cleanup = async () => {
    await this.fs.unlink(outputPath + finalProdCSV, () => {});
    await this.fs.unlink(genPath + dbFile, () => {});
  };

  /*
   * opens a url in browser page
   */
  open = async (url, wait = "P") => {
    await this.page.goto(url, wait == "F" ? { waitUntil: "networkidle0" } : {});

    if (wait === "F") await this.page.waitFor(timePageLoad);
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
      console.log("login successfull");
    } catch (e) {
      console.log("Can't login again, already did");
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
  saveProductsUrl = async (dontSaveProductUrls) => {
    if (dontSaveProductUrls) return;
    try {
      const catLinks = await this.getCats();
      const lastWriteId = this.db.get("state.prodLastWriteId").value();
      const lastWriteHref = this.db.get("state.prodLastWriteHref").value();
      let counter = lastWriteId ? lastWriteId : 1;
      let start = counter < 2 ? true : false;

      // loop through cats
      for (let i = 0; i < catLinks.length; i++) {
        const cat = catLinks[i];
        const prodLinks = await this.getProductLinksInCat(cat.href);

        // loop through products
        for (let j = 0; j < prodLinks.length; j++) {
          const pL = prodLinks[j];

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
   * finalize
   */
  final = async () => {
    try {
      const prodLastReadId = this.db.get("state.prodLastReadId").value();
      const prodLastReadHref = this.db.get("state.prodLastReadHref").value();
      const prodLastReadCat = this.db.get("state.prodLastReadCat").value();
      let counter = prodLastReadId ? prodLastReadId : 1;
      let start = counter < 2 ? true : false;

      while (true) {
        const { cat: prodCat, href: prodUrl } = this.db
          .get("products")
          .getById(counter)
          .value();
        if (
          start === true ||
          (prodLastReadHref == prodUrl && prodLastReadCat == prodCat)
        ) {
          // dont write to csv again if already written
          if (start === false) {
            start = true;
            counter++;
            continue;
          }
          await this.writeProductToCSVPrep(prodUrl, prodCat);
          this.db.set("state.prodLastReadId", counter).write();
          this.db.set("state.prodLastReadHref", prodUrl).write();
          this.db.set("state.prodLastReadCat", prodCat).write();
          counter++;
        }
      }
    } catch (error) {
      console.log(`no product at this location in db`);
      return;
    }
  };

  /*
   * write product to csv
   */
  writeProductToCSVPrep = async (prodUrl, prodCat) => {
    try {
      await this.open(prodUrl);
      const prodData = await this.getProductData();
      prodData.cat = prodCat; // patch up the product data with cat from url, we couldnt get cat from prod page

      await this.writeProductToCSV(prodData);
    } catch (error) {
      console.log(`cannot prepare products for csv write`);
    }
  };

  /*
   * Get product data in array
   */
  getProductData = async () => {
    try {
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
      const productSKU = await this.getProductStyle();

      return {
        type: "simple",
        sku: productSKU,
        name: productName,
        published: 1,
        featured: 0,
        visibility: "visible",
        sDesc: productShortDesc,
        desc: productDesc,
        tax: "none",
        inStock: 1,
        weight: null,
        reviews: 1,
        note: "Thank you for buying from Mann Support",
        price: productPrices.join(attrSeperator),
        stock: 500,
        img: productImages.join(attrSeperator),
        pos: 9,
        boxQty: productBoxQty.join(attrSeperator),
        soh: productSOH.join(attrSeperator),
        item: productItemNames.join(attrSeperator),
        color: productColors.join(attrSeperator),
        size: productSizes.join(attrSeperator),
      };
    } catch (error) {
      console.log(`cannot write product to csv`);
      return null;
    }
  };

  /*
   * write product to csv file
   */
  writeProductToCSV = async (product) => {
    try {
      await this.productCSVWriter
        .writeRecords([product]) // returns a promise
        .then(() => {
          console.log(`${product.sku} written to csv`);
        });
    } catch (error) {
      console.log(`cannot write ${product.sku} to csv`);
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
      const arr = ret.split("-");
      arr.shift(); // removes the first element
      return arr.join(" ");
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

  ////////////////////////////////////
  // Unused but there for debugging //
  ////////////////////////////////////

  // /*
  //  * saves session to file
  //  */
  // saveSession = async () => {
  //   const cookies = await this.page.cookies();
  //   this.writeToFile(sessionFile, JSON.stringify(cookies, null, 2), "cookies");
  // };

  // /*
  //  * writes text to file
  //  */
  // writeToFile = (filename, data, log) => {
  //   this.fs.writeFile(filename, data, function (err) {
  //     if (err) throw err;
  //     console.log(`${log} written to file`);
  //   });
  // };

  // /*
  //  * Produces element dom in text
  //  */
  // getDom = async (selector = null) => {
  //   const dom = await this.page.evaluate((selector) => {
  //     let data = [];
  //     let node;
  //     if (selector) node = document.querySelectorAll(selector);
  //     else node = document.querySelectorAll("body");

  //     node.forEach((item) => {
  //       data.push(item.innerHTML);
  //     });
  //     return data;
  //   }, selector);
  //   return dom.length == 1 ? dom[0] : dom;
  // };

  // /*
  //  * Creates screenshots
  //  */
  // screenshot = async (filename) => {
  //   await this.page.screenshot({ path: filename });
  // };

  // writeDom = async (selector) => {
  //   const data = await this.getDom(selector);
  //   this.writeToFile("./temp.html", data, "dom");
  // };
}

module.exports = Puppeteer;
