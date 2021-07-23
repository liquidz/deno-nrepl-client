import { bencode, bufio } from "../deps.ts";
//import * as nrepl from "./nrepl.ts";
import { NreplClientImpl, readResponse, writeRequest } from "./client.ts";
import { asserts, readers, writers } from "../test_deps.ts";
import { NreplClient, NreplResponse, RequestManager } from "../types.ts";

function dummyConn(): Deno.Conn {
  return {
    rid: -1,
    closeWrite: () => Promise.resolve(),
    read: (_x: Uint8Array): Promise<number | null> => Promise.resolve(0),
    write: (_x: Uint8Array): Promise<number> => Promise.resolve(0),
    close: (): void => {},
    localAddr: { transport: "tcp", hostname: "0.0.0.0", port: 0 },
    remoteAddr: { transport: "tcp", hostname: "0.0.0.0", port: 0 },
  };
}

async function delay(t: number) {
  return new Promise((resolve) => setTimeout(resolve, t));
}

const strWriter = new writers.StringWriter();
const bufWriter = new bufio.BufWriter(strWriter);
const reqManager: RequestManager = {};

const wp = writeRequest(bufWriter, { op: "clone" }, { foo: "bar" }, reqManager);
await delay(100);

console.log(reqManager);

const m = await bencode.decode(strWriter.toString());
if (bencode.isObject(m)) {
  const bufReader = new bufio.BufReader(
    new readers.StringReader(
      bencode.encode({ id: m["id"], status: ["done"], req: m }),
    ),
  );

  const x = await readResponse(bufReader, reqManager);
  await delay(100);
  console.log(x);
  console.log(reqManager);

  const y = await wp;
  console.log(y);
}
