const createCsvWriter = require("csv-writer").createObjectCsvWriter;
const csvWriter = createCsvWriter({
  path: "file.csv",
  header: [
    { id: "name", title: "NAME" },
    { id: "lang", title: "LANGUAGE" },
    { id: "age", title: "AGE" },
    { id: "dept", title: "DEPARTMENT" },
    { id: "level", title: "LEVEL" },
  ],
});

const record = [
  { name: "John", lang: "en", age: 23, dept: "maths", level: 200 },
  { name: "Peter", lang: "jp", age: 17, dept: "english", level: 500 },
  { name: "Simon", lang: "fr", age: 29, dept: "biology", level: 200 },
  { name: "Andrew", lang: "ar", age: 22, dept: "arts", level: 100 },
  { name: "James", lang: "de", age: 18, dept: "physiology", level: 300 },
  { name: "Bayo", lang: "yo", age: 25, dept: "accounts", level: 400 },
];

(async () => {
  for (let person of record) {
    await csvWriter.writeRecords([person]);
  }
})();
