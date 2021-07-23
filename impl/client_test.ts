import { async, bencode, bufio } from "../deps.ts";
import { NreplDoneResponseImpl } from "./response.ts";
import { readResponse, writeRequest } from "./client.ts";
import { asserts, readers, writers } from "../test_deps.ts";
import { NreplDoneResponse, RequestManager } from "../types.ts";

async function delay(t: number) {
  return new Promise((resolve) => setTimeout(resolve, t));
}

Deno.test("writeRequest", async () => {
  const strWriter = new writers.StringWriter();
  const bufWriter = new bufio.BufWriter(strWriter);

  writeRequest(bufWriter, { op: "one", id: "123" });
  await delay(10);

  asserts.assertEquals(
    { op: "one", id: "123" },
    await bencode.decode(strWriter.toString()),
  );
});

Deno.test("writeRequest: assign id automatically", async () => {
  const strWriter = new writers.StringWriter();
  const bufWriter = new bufio.BufWriter(strWriter);

  writeRequest(bufWriter, { op: "two" });
  await delay(10);

  const m = await bencode.decode(strWriter.toString());
  asserts.assert(bencode.isObject(m));
  asserts.assertEquals("two", m["op"]);
  asserts.assertNotEquals("", m["id"]);
});

Deno.test("writeRequest: requestManager", async () => {
  const strWriter = new writers.StringWriter();
  const bufWriter = new bufio.BufWriter(strWriter);
  const reqManager: RequestManager = {};

  asserts.assertEquals({}, reqManager);

  const p = writeRequest(
    bufWriter,
    { op: "three", id: "234" },
    { foo: "bar" },
    reqManager,
  );
  await delay(10);

  const { context, d, responses } = reqManager["234"];
  asserts.assertEquals({ foo: "bar" }, context);
  asserts.assertEquals([], responses);

  const expectedRes = new NreplDoneResponseImpl({
    responses: [],
    context: { dummy: "dummy" },
  });
  d.resolve(expectedRes);

  const actualRes = await p;
  asserts.assertEquals(expectedRes, actualRes);
});

Deno.test("readResponse", async () => {
  const bufReader = new bufio.BufReader(
    new readers.StringReader(
      bencode.encode({ op: "four" }),
    ),
  );

  const res = await readResponse(bufReader);

  asserts.assertEquals({}, res.context);
  asserts.assertEquals("four", res.getFirst("op"));
});

Deno.test("readResponse: requestManager", async () => {
  const d = async.deferred<NreplDoneResponse>();
  const reqManager: RequestManager = {
    "567": {
      context: { foo: "bar" },
      d: d,
      responses: [],
    },
  };

  let resStr = bencode.encode({ id: "456" });
  resStr += bencode.encode({ id: "567", status: ["done"] });
  const bufReader = new bufio.BufReader(
    new readers.StringReader(resStr),
  );

  // First response
  asserts.assertNotEquals({}, reqManager);
  const res1 = await readResponse(bufReader, reqManager);
  asserts.assertEquals({}, res1.context);
  asserts.assertEquals("456", res1.getFirst("id"));

  // Second response
  asserts.assertNotEquals({}, reqManager);
  const res2 = await readResponse(bufReader, reqManager);
  asserts.assertEquals({ foo: "bar" }, res2.context);
  asserts.assertEquals("567", res2.getFirst("id"));
  asserts.assertEquals({}, reqManager);

  // Done response
  const done = await d;
  asserts.assertEquals({ foo: "bar" }, done.context);
  asserts.assertEquals("567", done.getFirst("id"));
});

Deno.test("writeRequest and readResponse", async () => {
  const strWriter = new writers.StringWriter();
  const bufWriter = new bufio.BufWriter(strWriter);
  const reqManager: RequestManager = {};

  const p = writeRequest(
    bufWriter,
    { op: "clone", id: "345" },
    { foo: "bar" },
    reqManager,
  );
  await delay(100);

  const m = await bencode.decode(strWriter.toString());
  asserts.assert(bencode.isObject(m));

  let resStr = bencode.encode({ id: m["id"], test: "one" });
  resStr += bencode.encode({ id: m["id"], test: "two", status: ["done"] });

  const bufReader = new bufio.BufReader(
    new readers.StringReader(resStr),
  );

  // First response
  const res1 = await readResponse(bufReader, reqManager);
  asserts.assertEquals({ foo: "bar" }, res1.context);
  asserts.assertEquals("345", res1.id());
  asserts.assertEquals("one", res1.getFirst("test"));
  asserts.assertEquals(false, res1.isDone());

  // Second response
  const res2 = await readResponse(bufReader, reqManager);
  asserts.assertEquals({ foo: "bar" }, res2.context);
  asserts.assertEquals("345", res2.id());
  asserts.assertEquals("two", res2.getFirst("test"));
  asserts.assertEquals(["done"], res2.getFirst("status"));
  asserts.assertEquals(true, res2.isDone());

  // Done response
  const done = await p;
  asserts.assertEquals({ foo: "bar" }, done.context);
  asserts.assertEquals("345", done.id());
  asserts.assertEquals(["one", "two"], done.getAll("test"));
  asserts.assertEquals(["done"], done.getFirst("status"));
  asserts.assertEquals(true, done.isDone());
});
