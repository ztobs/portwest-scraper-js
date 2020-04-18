const low = require("lowdb");
const FileSync = require("lowdb/adapters/FileSync");

const adapter = new FileSync("db.json");
const lodashId = require("lodash-id");
const db = low(adapter);

// Set some defaults
db.defaults({ posts: [], user: {} }).write();

// db._.mixin(lodashId);

// db.get("posts").insert({ title: "new record" }).write();
const val = db.get("user").set("title", "value").write();

// const val = db.get("posts").getById(1).value();

// console.log(val);
