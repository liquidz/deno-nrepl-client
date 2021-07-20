import { Context, DoneResponse, Response } from "../types.ts";
import { bencode } from "../deps.ts";

export class ResponseImpl implements Response {
  readonly object: bencode.BencodeObject;

  constructor(obj: bencode.BencodeObject) {
    this.object = obj;
  }

  id(): string | null {
    const id = this.object["id"];
    return (typeof id === "string") ? id : null;
  }

  get(key: string): bencode.Bencode {
    return this.object[key];
  }

  isDone(): boolean {
    const status = this.get("status");
    if (!bencode.isArray(status)) {
      return false;
    }

    return (status.indexOf("done") !== undefined);
  }
}

export class DoneResponseImpl extends DoneResponse implements Response {
  readonly responses: Response[];
  readonly context: Context;

  constructor(
    { responses, context }: { responses: Response[]; context: Context },
  ) {
    super();
    this.responses = responses;
    this.context = context;
  }

  id(): string | null {
    return this.responses[0].id();
  }

  get(key: string): bencode.Bencode {
    for (const res of this.responses) {
      const v = res.get(key);
      if (v === null) continue;
      return v;
    }

    return null;
  }

  isDone(): boolean {
    return true;
  }
}
