import { async, bencode } from "../deps.ts";
import { asserts } from "../test_deps.ts";
import {
  BencodeWithMeta,
  NreplOutput,
  NreplResponse,
  RequestManager,
} from "../types.ts";
import { NreplResponseImpl } from "./response.ts";
import * as sut from "./stream.ts";

function testBencodeWithMetaStream(
  messages: bencode.BencodeObject[],
  reqManager: RequestManager,
): ReadableStream<BencodeWithMeta> {
  return ReadableStream.from<bencode.BencodeObject>(messages).pipeThrough(
    new sut.AssociatingMetaStream(reqManager),
  );
}

function testNreplOutputStream(
  messages: BencodeWithMeta[],
): ReadableStream<NreplOutput> {
  return ReadableStream.from<BencodeWithMeta>(messages).pipeThrough(
    new sut.BencodeWithMetaToNreplOutputStream(),
  );
}

Deno.test("AssociatingMetaStream", async () => {
  const d = async.deferred<NreplResponse>();
  const rm: RequestManager = {
    "1": { meta: { foo: "bar" }, responses: [], deferredResponse: d },
  };
  d.resolve(new NreplResponseImpl([]));

  const stream = testBencodeWithMetaStream(
    [{ id: "1" }, { id: "2" }, { noid: "3" }],
    rm,
  );
  const r = stream.getReader();

  asserts.assertEquals((await r.read()).value, {
    message: { id: "1" },
    meta: { foo: "bar" },
  });

  asserts.assertEquals((await r.read()).value, {
    message: { id: "2" },
    meta: {},
  });

  asserts.assertEquals((await r.read()).value, {
    message: { noid: "3" },
    meta: {},
  });
});

Deno.test("BencodeWithMetaToNreplOutputStream", async () => {
  const stream = testNreplOutputStream([
    { message: { no: "1" }, meta: {} },
    { message: { no: "2", out: "two" }, meta: {} },
    { message: { no: "3" }, meta: {} },
    { message: { no: "4", "pprint-out": "four" }, meta: { foo: "bar" } },
    { message: { no: "5" }, meta: {} },
    { message: { no: "6", err: "six" }, meta: {} },
  ]);
  const r = stream.getReader();

  asserts.assertEquals((await r.read()).value, {
    type: "out",
    text: "two",
    meta: {},
  });
  asserts.assertEquals((await r.read()).value, {
    type: "pprint-out",
    text: "four",
    meta: { foo: "bar" },
  });
  asserts.assertEquals((await r.read()).value, {
    type: "err",
    text: "six",
    meta: {},
  });

  r.releaseLock();
});
