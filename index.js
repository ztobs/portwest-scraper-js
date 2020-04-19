// require("events").EventEmitter.defaultMaxListeners = 0;

const resume = process.env.resume ? process.env.resume : true;
const dontSaveProductUrls = process.env.dontSaveProductUrls
  ? process.env.dontSaveProductUrls
  : false;
const cred = require("./pw_credentials.json");

(async () => {
  const pup = require("./Puppeteer");
  const Pup = await new pup();
  await Pup.init(resume);

  // // login to portwest
  await Pup.open("https://portwest.co.uk/main/login/", "F");
  await Pup.login(cred);

  // load any page
  await Pup.open("https://portwest.co.uk/main/login/"); // we should be redirected automatically to main page here

  // get all product links and save to temp db
  await Pup.saveProductsUrl(dontSaveProductUrls);

  // loop through the products db in temp and load and write to csv
  await Pup.final();

  Pup.close();
})().catch((err) => console.log(err));
