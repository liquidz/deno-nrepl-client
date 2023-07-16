import { async, bencode } from "../deps.ts";
import { asserts, streams } from "../test_deps.ts";
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
  return streams
    .readableStreamFromIterable<bencode.BencodeObject>(messages)
    .pipeThrough(new sut.AssociatingContextStream(reqManager));
}

function testNreplOutputStream(
  messages: BencodeWithContext[],
): ReadableStream<NreplOutput> {
  return streams
    .readableStreamFromIterable<BencodeWithContext>(messages)
    .pipeThrough(new sut.BencodeWithContextToNreplOutputStream());
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
    context: undefined,
  });

  asserts.assertEquals((await r.read()).value, {
    message: { noid: "3" },
    context: undefined,
  });
});

Deno.test("BencodeWithContextToNreplOutputStream", async () => {
  const stream = testNreplOutputStream([
    { message: { no: "1" } },
    { message: { no: "2", out: "two" } },
    { message: { no: "3" } },
    { message: { no: "4", "pprint-out": "four" }, context: { foo: "bar" } },
    { message: { no: "5" } },
    { message: { no: "6", err: "six" } },
  ]);
  const r = stream.getReader();

  asserts.assertEquals((await r.read()).value, {
    type: "out",
    text: "two",
    context: undefined,
  });
  asserts.assertEquals((await r.read()).value, {
    type: "pprint-out",
    text: "four",
    context: { foo: "bar" },
  });
  asserts.assertEquals((await r.read()).value, {
    type: "err",
    text: "six",
    context: undefined,
  });

  r.releaseLock();
});
