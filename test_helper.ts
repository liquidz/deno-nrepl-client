import { bencode, bufio } from "./deps.ts";
import * as nrepl from "./nrepl.ts";
import { asserts } from "./test_deps.ts";
import { nREPL, Response } from "./types.ts";

let _testResponses: bencode.Bencode[] = [];

async function testBencodeReader(
  _input: bufio.BufReader,
): Promise<bencode.Bencode> {
  const res = _testResponses.pop();
  return (res === undefined) ? null : res;
}

async function testBencodeWriter(
  _output: bufio.BufWriter,
  x: bencode.Bencode,
): Promise<number> {
  if (!bencode.isObject(x)) return -1;
  const id = x["id"] || "dummy id";
  _testResponses.push({ id: id, req: x });
  return 0;
}
