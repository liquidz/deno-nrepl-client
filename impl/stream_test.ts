import { asserts, streams } from "../test_deps.ts";
import { bencode } from "../deps.ts";
import { NreplOutput } from "../types.ts";
import * as sut from "./stream.ts";

function testStream(
  messages: bencode.BencodeObject[],
): ReadableStream<NreplOutput> {
  return streams
    .readableStreamFromIterable<bencode.BencodeObject>(messages)
    .pipeThrough(new sut.BencodeObjectToNreplOutputStream());
}

Deno.test("no output", async () => {
  const stream = testStream([
    { no: "1" },
    { no: "2", out: "two" },
    { no: "3" },
    { no: "4", "pprint-out": "four" },
    { no: "5" },
    { no: "6", err: "six" },
  ]);
  const r = stream.getReader();

  asserts.assertEquals((await r.read()).value, { type: "out", text: "two" });
  asserts.assertEquals((await r.read()).value, {
    type: "pprint-out",
    text: "four",
  });
  asserts.assertEquals((await r.read()).value, { type: "err", text: "six" });

  r.releaseLock();
});
