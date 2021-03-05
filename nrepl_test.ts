//import { asserts } from "deps.ts";
import { nREPL } from "./nrepl.ts";
import { mergeResponses } from "./response.ts";

const text = await Deno.readTextFile(
  "../antq/.nrepl-port",
);
const port = parseInt(text);
if (port === NaN) {
  throw Error("FIXME");
}

async function delay(t: number) {
  return new Promise((resolve) => setTimeout(resolve, t));
}

const nrepl = new nREPL();
await nrepl.connect("127.0.0.1", port);
//const xxx = await nrepl.send({ op: "clone", id: "123" });
const xxx = await nrepl.send({
  op: "eval",
  id: "123",
  code: `(do (println "foobar") (+ 1 2 3))(+ 2 3 4)`,
});

await delay(1000);
nrepl.disconnect();

console.log("yyyyyy");
console.log(xxx);
console.log(mergeResponses(xxx));
// if (typeof xxx === "object" && xxx !== null) {
//   if (bencode.isArray(xxx)) {
//     console.log(mergeResponses(xxx));
//   }
// }
