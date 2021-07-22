import { bencode, bufio } from "./deps.ts";
//import * as nrepl from "./nrepl.ts";
import { NreplClientImpl } from "./impl/nrepl.ts";
// import { asserts } from "./test_deps.ts";
import { NreplClient, NreplResponse } from "./types.ts";

// function dummyConn(r: Deno.Reader, w: Deno.Writer): Deno.Conn {
//   //function dummyConn(): Deno.Conn {
//   return {
//     rid: -1,
//     closeWrite: () => Promise.resolve(),
//     read: (x: Uint8Array): Promise<number | null> => r.read(x),
//     write: (x: Uint8Array): Promise<number> => w.write(x),
//
//     // read: (_x: Uint8Array): Promise<number | null> => Promise.resolve(0),
//     // write: (_x: Uint8Array): Promise<number> => Promise.resolve(0),
//     close: (): void => {},
//     localAddr: { transport: "tcp", hostname: "0.0.0.0", port: 0 },
//     remoteAddr: { transport: "tcp", hostname: "0.0.0.0", port: 0 },
//   };
// }
//
// let _testResponses: bencode.Bencode[] = [];
//
// async function testBencodeReader(
//   _input: bufio.BufReader,
// ): Promise<bencode.Bencode> {
//   const res = _testResponses.pop();
//   return (res === undefined) ? null : res;
// }
//
// async function testBencodeWriter(
//   _output: bufio.BufWriter,
//   x: bencode.Bencode,
// ): Promise<number> {
//   if (!bencode.isObject(x)) return -1;
//   const id = x["id"] || "dummy id";
//   _testResponses.push({ id: id, req: x });
//   return 0;
// }
//
// // async function handler(conn: nREPL) {
// //   try {
// //     while (!conn.isClosed) {
// //       const res = await conn.read();
// //       console.log(res);
// //     }
// //   } catch (err) {
// //     if (!conn.isClosed) {
// //       conn.close();
// //     }
// //   }
// // }
// //
// // async function delay(t: number) {
// //   return new Promise((resolve) => setTimeout(resolve, t));
// // }
// //
// // console.log("AAAA");
// //
// // const x = new nREPLImpl({
// //   conn: dummyConn(),
// //   bencodeReader: testBencodeReader,
// //   bencodeWriter: testBencodeWriter,
// // });
// // handler(x);
// // console.log("BBBB");
// //
// // const r = await x.write({ op: "clone" });
// //
// // await delay(1000);
// // console.log(r);
// //
// // x.close();
// // //
// // // nrepl.connect()
