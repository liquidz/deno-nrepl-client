import * as nrepl from "./nrepl.ts";
import { asserts } from "./test_deps.ts";
import { NreplClient, NreplResponse } from "./types.ts";

let _process: Deno.Process;
let _conn: NreplClient;
let _responses: NreplResponse[] = [];
const portFilePath = "./.nrepl-port";

function delay(t: number) {
  return new Promise((resolve) => setTimeout(resolve, t));
}

function doesFileExists(path: string): boolean {
  try {
    return Deno.lstatSync(path).isFile;
  } catch (_) {
    return false;
  }
}

async function untilPortFileReady() {
  while (true) {
    if (doesFileExists(portFilePath)) {
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
    } catch (_err) {
      await delay(1000);
    }
  }
}

async function getTestPort(): Promise<number> {
  const text = await Deno.readTextFile(portFilePath);
  const port = parseInt(text);

  if (isNaN(port)) {
    throw Error("Invalid port number");
  }
  return port;
}

async function handler(conn: NreplClient) {
  try {
    while (!conn.isClosed) {
      const res = await conn.read();
      _responses.push(res);
    }
  } catch (_err) {
    if (!conn.isClosed) {
      conn.close();
    }
  }
}

async function setUp(): Promise<void> {
  _process = Deno.run({
    cmd: ["deno", "run", "-A", "npm:nbb", "nrepl-server"],
  });
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
  await Deno.remove(portFilePath);
}

Deno.test("Integration test", async () => {
  await setUp();
  try {
    const cloneRes = await _conn.write({ op: "clone" });
    asserts.assert(cloneRes.id() !== "");
    const session = cloneRes.getOne("new-session");
    asserts.assert(session !== "");

    const evalRes = await _conn.write({
      op: "eval",
      code: `(do (println "hello") (+ 1 2 3)) (+ 4 5 6)`,
      session: session,
    }, { context: { foo: "bar" } });

    // TODO nbb nrepl-server only returns the last form result.
    //asserts.assertEquals(evalRes.getAll("value"), ["6", "15"]);
    asserts.assertEquals(evalRes.get("value"), ["6"]);
    asserts.assertEquals(evalRes.context, { foo: "bar" });

    const noWaitRes = await _conn.write({
      op: "eval",
      code: "1",
      session: session,
    }, { doesWaitResponse: false });
    asserts.assertEquals(noWaitRes.responses, []);
    asserts.assertEquals(noWaitRes.id(), null);
  } finally {
    await tearDown();
  }
});
