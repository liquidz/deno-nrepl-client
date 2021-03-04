import * as bencode from "../deno-bencode/mod.ts";
import { BufReader, BufWriter, v4 } from "./deps.ts";
import { getId, isDone } from "./response.ts";

const text = await Deno.readTextFile(
  "/Users/uochan/src/github.com/liquidz/antq/.nrepl-port",
);
const port = parseInt(text);
if (port === NaN) {
  throw Error("FIXME");
}

async function delay(t: number) {
  return new Promise((resolve) => setTimeout(resolve, t));
}

type RequestBody = {
  resolve: (some: unknown) => unknown;
  responses: bencode.Bencode[];
};

class Nrepl {
  #connection: Deno.Conn | null;
  #reader: BufReader | null;
  #writer: BufWriter | null;
  // #stdoutCallback: (text: string) => void;
  // #stderrCallback: (text: string) => void;

  #requestManager: { [property: string]: RequestBody };

  constructor() {
    this.#connection = null;
    this.#reader = null;
    this.#writer = null;
    this.#requestManager = {};
  }

  async readLoop() {
    while (this.#reader !== null) {
      try {
        const res = await bencode.read(this.#reader);

        console.log(res);
        if (isDone(res)) {
          const id = getId(res);
          if (id === null) continue;

          const req = this.#requestManager[id];
          if (req === undefined) continue;
          req["resolve"](res);
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

  async send(message: bencode.Bencode): Promise<unknown> {
    if (this.#writer === null) return "";
    if (!bencode.isObject(message)) {
      throw Error("nrepl: message must be object");
    }

    const id = message["id"] ?? v4.generate();
    if (typeof id !== "string") {
      throw Error("nrepl: id must be string");
    }

    message["id"] = id;
    const result = new Promise((resolve) => {
      this.#requestManager[id] = {
        resolve: resolve,
        responses: [],
      };
    });

    await bencode.write(this.#writer, message);

    return result;
  }
  //    return result
}

const nrepl = new Nrepl();
await nrepl.connect("127.0.0.1", port);
const xxx = await nrepl.send({ op: "clone", id: "123" });

await delay(1000);
nrepl.disconnect();

console.log("yyyyyy");
console.log(xxx);
