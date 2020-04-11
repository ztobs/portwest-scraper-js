const { sessionFile } = require("./constants");

class Hello {
  doHello = async () => {
    const fs = require("fs");

    const dd = fs.readFileSync("./session.json", "utf8");
    return dd;
  };
}

(async () => {
  const hello = await new Hello();
  const aa = await hello.doHello();
  const cc = [...JSON.parse(aa)];
  const bb = cc;

  console.log(bb);
})().catch((e) => {
  console.log(e);
});
