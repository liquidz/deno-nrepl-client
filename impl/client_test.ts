import { bencode, mockConn } from "../deps.ts";
import { NreplResponseImpl } from "./response.ts";
import * as sut from "./client.ts";
import { asserts, io, streams } from "../test_deps.ts";

const textEncoder = new TextEncoder();

function stringToReadableStream(str: string): ReadableStream<Uint8Array> {
  let enqueued = false;

  return new ReadableStream({
    pull(controller) {
      if (enqueued) {
        controller.close();
        return;
      }
      controller.enqueue(textEncoder.encode(str));
      enqueued = true;
    },
  });
}

function testClient({
  readable,
  writable,
}: {
  readable?: ReadableStream<Uint8Array>;
  writable?: WritableStream<Uint8Array>;
}) {
  const conn = mockConn.mockConn();
  return new sut.NreplClientImpl({ conn, readable, writable });
}

/* ----------------------------------------
 * write
 * ---------------------------------------- */

Deno.test("write", async () => {
  const strWriter = new io.StringWriter();
  const client = testClient({
    writable: streams.writableStreamFromWriter(strWriter),
  });

  await client.write({ op: "one", id: "123" }, { doesWaitResponse: false });

  asserts.assertEquals(await bencode.decode(strWriter.toString()), {
    op: "one",
    id: "123",
  });
});

Deno.test("write: assign id automatically", async () => {
  const strWriter = new io.StringWriter();
  const client = testClient({
    writable: streams.writableStreamFromWriter(strWriter),
  });

  await client.write(
    { test: "writeRequest: assign id automatically" },
    {
      doesWaitResponse: false,
    },
  );

  const m = await bencode.decode(strWriter.toString());
  asserts.assert(bencode.isObject(m));
  asserts.assertEquals(m["test"], "writeRequest: assign id automatically");
  asserts.assertNotEquals(m["id"], "");
});

/* ----------------------------------------
 * read
 * ---------------------------------------- */

Deno.test("read", async () => {
  const client = testClient({
    readable: stringToReadableStream(bencode.encode({ test: "readResponse" })),
  });

  const res = await client.read();
  asserts.assertEquals(res.context, {});
  asserts.assertEquals(res.get("test"), ["readResponse"]);
});

Deno.test("read with output", async () => {
  const messages: bencode.BencodeObject[] = [
    { test: "readResponse with output1" },
    { out: "readResponse with output2" },
    { test: "readResponse with output3" },
  ];
  const client = testClient({
    readable: stringToReadableStream(messages.map(bencode.encode).join("")),
  });

  // responses
  const res1 = await client.read();
  asserts.assertEquals(res1.context, {});
  asserts.assertEquals(res1.get("test"), ["readResponse with output1"]);

  await client.read();

  const res3 = await client.read();
  asserts.assertEquals(res3.context, {});
  asserts.assertEquals(res3.get("test"), ["readResponse with output3"]);

  // outputs
  const outputReader = client.output.getReader();
  asserts.assertEquals((await outputReader.read()).value, {
    type: "out",
    text: "readResponse with output2",
    context: undefined,
  });
});

/* ----------------------------------------
 * read and write response
 * ---------------------------------------- */

Deno.test("writeRequest: requestManager", async () => {
  const strWriter = new io.StringWriter();
  const expectedRes = new NreplResponseImpl(
    [
      { id: "234", foo: "bar", out: "hello" },
      { id: "234", foo: "baz", status: ["done"] },
    ],
    {
      dummy: "dummy",
    },
  );

  const client = testClient({
    readable: stringToReadableStream(
      expectedRes.responses.map(bencode.encode).join(""),
    ),
    writable: streams.writableStreamFromWriter(strWriter),
  });

  const p = client.write(
    { op: "dummy", id: "234" },
    { context: expectedRes.context },
  );

  const resp1 = await client.read();
  asserts.assertEquals(resp1.id(), "234");
  asserts.assertEquals(resp1.get("foo"), ["bar"]);
  asserts.assertEquals(resp1.isDone(), false);
  asserts.assertEquals(resp1.context, expectedRes.context);

  const outputReader = client.output.getReader();
  asserts.assertEquals((await outputReader.read()).value, {
    type: "out",
    text: "hello",
    context: expectedRes.context,
  });

  const resp2 = await client.read();
  asserts.assertEquals(resp2.id(), "234");
  asserts.assertEquals(resp2.get("foo"), ["baz"]);
  asserts.assertEquals(resp2.isDone(), true);
  asserts.assertEquals(resp2.context, expectedRes.context);

  const actualRes = await p;
  asserts.assertEquals(expectedRes, actualRes);
  asserts.assertEquals(expectedRes.isDone(), true);
});
