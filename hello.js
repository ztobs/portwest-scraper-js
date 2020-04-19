const fs = require("fs");

const resp = fs.existsSync("session.json");
console.log(resp);
