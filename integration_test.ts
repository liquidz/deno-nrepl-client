import * as nrepl from "./nrepl.ts";
import { asserts } from "./test_deps.ts";
import { nREPLClient, Response } from "./types.ts";

let _conn: nREPLClient;
let _responses: Response[] = [];

async function getTestPort(): Promise<number> {
  const text = await Deno.readTextFile(
    "./test/.nrepl-port",
  );
  const port = parseInt(text);
  if (port === NaN) {
    throw Error("FIXME");
  }
  return port;
}

async function delay(t: number) {
  return new Promise((resolve) => setTimeout(resolve, t));
}

async function handler(conn: nREPLClient) {
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
  const port = await getTestPort();
  _conn = await nrepl.connect({ hostname: "127.0.0.1", port: port });
  _responses = [];
  handler(_conn);
}

async function tearDown(): Promise<void> {
  await delay(1000);
  _conn.close();
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
    //asserts.assertEquals(_responses, ["6"]);
  } finally {
    await tearDown();
  }
});
