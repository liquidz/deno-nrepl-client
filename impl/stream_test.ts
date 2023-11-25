import { async, bencode } from "../deps.ts";
import { asserts } from "../test_deps.ts";
import {
  BencodeWithContext,
  NreplOutput,
  NreplResponse,
  RequestManager,
} from "../types.ts";
import { NreplResponseImpl } from "./response.ts";
import * as sut from "./stream.ts";

function testBencodeWithContextStream(
  messages: bencode.BencodeObject[],
  reqManager: RequestManager,
): ReadableStream<BencodeWithContext> {
  return ReadableStream.from<bencode.BencodeObject>(messages).pipeThrough(
    new sut.AssociatingContextStream(reqManager),
  );
}

function testNreplOutputStream(
  messages: BencodeWithContext[],
): ReadableStream<NreplOutput> {
  return ReadableStream.from<BencodeWithContext>(messages).pipeThrough(
    new sut.BencodeWithContextToNreplOutputStream(),
  );
}

Deno.test("AssociatingContextStream", async () => {
  const d = async.deferred<NreplResponse>();
  const rm: RequestManager = {
    "1": { context: { foo: "bar" }, responses: [], deferredResponse: d },
  };
  d.resolve(new NreplResponseImpl([]));

  const stream = testBencodeWithContextStream(
    [{ id: "1" }, { id: "2" }, { noid: "3" }],
    rm,
  );
  const r = stream.getReader();

  asserts.assertEquals((await r.read()).value, {
    message: { id: "1" },
    context: { foo: "bar" },
  });

  asserts.assertEquals((await r.read()).value, {
    message: { id: "2" },
    context: {},
  });

  asserts.assertEquals((await r.read()).value, {
    message: { noid: "3" },
    context: {},
  });
});

Deno.test("BencodeWithContextToNreplOutputStream", async () => {
  const stream = testNreplOutputStream([
    { message: { no: "1" }, context: {} },
    { message: { no: "2", out: "two" }, context: {} },
    { message: { no: "3" }, context: {} },
    { message: { no: "4", "pprint-out": "four" }, context: { foo: "bar" } },
    { message: { no: "5" }, context: {} },
    { message: { no: "6", err: "six" }, context: {} },
  ]);
  const r = stream.getReader();

  asserts.assertEquals((await r.read()).value, {
    type: "out",
    text: "two",
    context: {},
  });
  asserts.assertEquals((await r.read()).value, {
    type: "pprint-out",
    text: "four",
    context: { foo: "bar" },
  });
  asserts.assertEquals((await r.read()).value, {
    type: "err",
    text: "six",
    context: {},
  });

  r.releaseLock();
});
