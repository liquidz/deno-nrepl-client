import * as nrepl from "./nrepl.ts";
import { asserts, exists } from "./test/test_deps.ts";
import { NreplClient, NreplResponse } from "./types.ts";

let _process: Deno.Process;
let _conn: NreplClient;
let _responses: NreplResponse[] = [];
const portFilePath = "./test/.nrepl-port";

async function delay(t: number) {
  return new Promise((resolve) => setTimeout(resolve, t));
}

async function untilPortFileReady() {
  while (true) {
    if (await exists.exists(portFilePath)) {
      break;
    } else {
      await delay(1000);
    }
  }
}

async function untilConnectionReady(port: number) {
  while (true) {
    try {
      const conn = await Deno.connect({ hostname: "127.0.0.1", port: port });
      conn.close();
      break;
    } catch (err) {
      await delay(1000);
    }
  }
}

async function getTestPort(): Promise<number> {
  const text = await Deno.readTextFile(portFilePath);
  const port = parseInt(text);
  if (port === NaN) {
    throw Error("FIXME");
  }
  return port;
}

async function handler(conn: NreplClient) {
  try {
    while (!conn.isClosed) {
      const res = await conn.read();
      _responses.push(res);
    }
  } catch (err) {
    if (!conn.isClosed) {
      conn.close();
    }
  }
}

async function setUp(): Promise<void> {
  _process = Deno.run({ cmd: ["clj", "-M:nrepl"], cwd: "./test" });
  await untilPortFileReady();
  const port = await getTestPort();

  await untilConnectionReady(port);

  _conn = await nrepl.connect({ port: port });
  _responses = [];
  handler(_conn);
}

async function tearDown(): Promise<void> {
  await delay(1000);
  _conn.close();
  _process.close();
}

Deno.test("Integration test", async () => {
  await setUp();
  try {
    const cloneRes = await _conn.write({ op: "clone" });
    asserts.assert(cloneRes.id() !== "");
    const session = cloneRes.getFirst("new-session");
    asserts.assert(session !== "");

    const evalRes = await _conn.write({
      op: "eval",
      code: `(do (println "hello") (+ 1 2 3)) (+ 4 5 6)`,
      session: session,
    }, { foo: "bar" });

    asserts.assertEquals(evalRes.getAll("value"), ["6", "15"]);
    asserts.assertEquals(evalRes.context, { foo: "bar" });
  } finally {
    await tearDown();
  }
});
