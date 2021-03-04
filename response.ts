import * as bencode from "../deno-bencode/mod.ts";

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
