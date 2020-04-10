const axios = require("axios");
const fs = require("fs");

const url = "https://www.portwest.com/";

axios(url)
  .then((res) => {
    const html = res.data;
    fs.writeFile("./output/page2.html", html, (err) => {
      if (err) console.log(err);
    });
    console.log("written");
  })
  .catch(console.error);
