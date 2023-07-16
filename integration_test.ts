import * as nrepl from "./nrepl.ts";
import { asserts } from "./test_deps.ts";
import { NreplClient } from "./types.ts";

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

type SetupResult = {
  conn: NreplClient;
  tearDown: () => Promise<void>;
};

async function tryRemoveFile(path: string) {
  try {
    await Deno.remove(path);
  } catch (_) {
    // ignore
  }
}

async function setup(): Promise<SetupResult> {
  await tryRemoveFile(portFilePath);

  // Start nREPL server
  const command = new Deno.Command("clojure", {
    args: [
      "-Sdeps",
      `{:deps {nrepl/nrepl {:mvn/version "RELEASE"}}}`,
      "-M",
      "-m",
      "nrepl.cmdline",
    ],
  });
  const process = command.spawn();

  // Wait nREPL server ready
  await untilPortFileReady();
  const port = await getTestPort();
  await untilConnectionReady(port);

  // Connect to nREPL server and start client
  const conn = await nrepl.connect({ port: port });

  return {
    conn,
    tearDown: async () => {
      await conn.close();
      process.kill();
      await process.status;
      await tryRemoveFile(portFilePath);
    },
  };
}

Deno.test("Integration test", async () => {
  const { conn, tearDown } = await setup();
  try {
    const cloneRes = await conn.write({ op: "clone" });
    asserts.assert(cloneRes.id() !== "");
    const session = cloneRes.getOne("new-session");
    asserts.assert(session !== "");

    const evalRes = await conn.write(
      {
        op: "eval",
        code: `(do (println "hello") (+ 1 2 3))`,
        session: session,
      },
      { context: { foo: "bar" } },
    );
    asserts.assertEquals(evalRes.get("value"), ["6"]);
    asserts.assertEquals(evalRes.context, { foo: "bar" });

    const r = conn.output.getReader();
    try {
      asserts.assertEquals((await r.read()).value, {
        type: "out",
        text: "hello\n",
        context: { foo: "bar" },
      });
    } finally {
      r.releaseLock();
    }

    const noWaitRes = await conn.write(
      {
        op: "eval",
        code: "1",
        session: session,
      },
      { doesWaitResponse: false },
    );
    asserts.assertEquals(noWaitRes.responses, []);
    asserts.assertEquals(noWaitRes.id(), null);
  } finally {
    await tearDown();
  }
});
