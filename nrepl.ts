import * as bencode from "../deno-bencode/mod.ts";
import { BufReader, BufWriter, v4 } from "./deps.ts";
import { getId, isDone, mergeResponses } from "./response.ts";

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

type RequestBody = {
  resolve: (value: bencode.Bencode[]) => void;
  responses: bencode.Bencode[];
};

const defaultResponseHook = ((resp: bencode.BencodeObject) => resp);
type ResponseHook = typeof defaultResponseHook;

class Nrepl {
  #connection: Deno.Conn | null;
  #reader: BufReader | null;
  #writer: BufWriter | null;
  #responseHook: ResponseHook;
  #requestManager: { [property: string]: RequestBody };

  constructor(hook?: ResponseHook) {
    this.#connection = null;
    this.#reader = null;
    this.#writer = null;
    this.#requestManager = {};
    this.#responseHook = hook ?? defaultResponseHook;
  }

  async readLoop() {
    while (this.#reader !== null) {
      try {
        const originalRes = await bencode.read(this.#reader);
        if (!bencode.isObject(originalRes)) continue;

        const res = this.#responseHook(originalRes);
        // TODO stdout stderr callback here

        const id = getId(res);
        if (id === null) continue;
        const req = this.#requestManager[id];

        if (req === undefined) continue;
        req["responses"].push(res);

        if (isDone(res)) {
          req["resolve"](req["responses"]);
          delete this.#requestManager[id];
        }
      } catch (err) {
        return;
      }
    }
  }

  async connect(host: string, port: number) {
    this.#connection = await Deno.connect({ hostname: host, port: port });

    this.#reader = new BufReader(this.#connection);
    this.#writer = new BufWriter(this.#connection);

    this.readLoop();
  }

  disconnect() {
    if (this.#connection === null) return;

    this.#connection.close();

    this.#connection = null;
    this.#reader = null;
    this.#writer = null;
  }

  async send(message: bencode.Bencode): Promise<bencode.Bencode[]> {
    if (this.#writer === null) return [];
    if (!bencode.isObject(message)) {
      throw Error("nrepl: message must be an object");
    }

    const id = message["id"] ?? v4.generate();
    if (typeof id !== "string") {
      throw Error("nrepl: id must be a string");
    }

    message["id"] = id;
    const result = new Promise<bencode.Bencode[]>((resolve) => {
      this.#requestManager[id] = {
        resolve: resolve,
        responses: [],
      };
    });

    await bencode.write(this.#writer, message);

    return result;
  }
}

const nrepl = new Nrepl();
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
