import * as nrepl from "./nrepl.ts";
import { asserts } from "./test_deps.ts";
import { nREPL, Response } from "./types.ts";

let _conn: nREPL;
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

async function handler(conn: nREPL) {
  try {
    while (!nrepl.isClosed(conn)) {
      const res = await nrepl.read(conn);
      _responses.push(res);
    }
  } catch (err) {
    if (!nrepl.isClosed(conn)) {
      nrepl.close(conn);
    }
  }
}

async function setUp(): Promise<void> {
  const port = await getTestPort();
  _conn = await nrepl.connect({ port: port });
  _responses = [];
  handler(_conn);
}

async function tearDown(): Promise<void> {
  await delay(1000);
  nrepl.close(_conn);
}

Deno.test("FIXME", async () => {
  await setUp();
  try {
    const cloneRes = await nrepl.write(_conn, { op: "clone" });
    asserts.assert(cloneRes.id() !== "");
    const session = cloneRes.get("new-session");
    asserts.assert(session !== "");

    const evalRes = await nrepl.write(_conn, {
      op: "eval",
      code: `(do (println "hello") (+ 1 2 3))`,
      session: session,
    });
    asserts.assertEquals(evalRes.get("value"), "6");
  } finally {
    await tearDown();
  }
});

// const conn = await nrepl.connect({ port: port });
//
// const cloneRes = await nrepl.write(conn, { op: "clone" });
// const evalRes = await nrepl.write(conn, {
//   op: "eval",
//   code: `(do (println "hello") (+ 1 2 3))`,
//   session: session,
// });
//
// //console.log(cloneRes);
// console.log(evalRes);
// // cloneRes.responses;
