import * as bencode from "../deno-bencode/mod.ts";

export type Response = bencode.BencodeObject;
export type Responses = bencode.Bencode[];

export function isDone(resp: bencode.Bencode): resp is bencode.BencodeObject {
  if (!bencode.isObject(resp)) {
    return false;
  }
  let status = resp["status"];
  if (!bencode.isArray(status)) {
    return false;
  }
  return (status.indexOf("done") !== undefined);
}

export function getId(resp: bencode.Bencode): string | null {
  if (!bencode.isObject(resp)) return null;
  const id = resp["id"];
  return (typeof id === "string") ? id : null;
}

export function mergeResponses(resps: Responses): Response {
  const res: Response = {};
  for (const resp of resps) {
    if (!bencode.isObject(resp)) continue;

    for (const k of Object.keys(resp)) {
      if (k === "value") {
        res[k] = `${res[k] ?? ""}${resp[k]}`;
      } else {
        res[k] = resp[k];
      }
    }
  }
  return res;
}
