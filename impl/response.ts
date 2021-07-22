import { Context, DoneResponse, Response } from "../types.ts";
import { bencode } from "../deps.ts";

export class ResponseImpl implements Response {
  readonly response: bencode.BencodeObject;
  readonly context: Context;

  constructor(resp: bencode.BencodeObject, context?: Context) {
    this.response = resp;
    this.context = context || {};
  }

  id(): string | null {
    const id = this.getFirst("id");
    return (typeof id === "string") ? id : null;
  }

  getFirst(key: string): bencode.Bencode {
    return this.response[key];
  }
  getAll(key: string): bencode.Bencode[] {
    return [this.response[key]];
  }

  isDone(): boolean {
    const status = this.getFirst("status");
    if (!bencode.isArray(status)) {
      return false;
    }

    return (status.indexOf("done") !== undefined);
  }
}

export class DoneResponseImpl implements DoneResponse {
  readonly responses: Response[];
  readonly context: Context;

  constructor(
    { responses, context }: { responses: Response[]; context: Context },
  ) {
    this.responses = responses;
    this.context = context;
  }

  id(): string | null {
    return this.responses[0].id();
  }

  isDone(): boolean {
    return true;
  }

  getFirst(key: string): bencode.Bencode {
    for (const res of this.responses) {
      const v = res.getFirst(key);
      if (v === null) continue;
      return v;
    }

    return null;
  }

  getAll(key: string): bencode.Bencode[] {
    return this.responses
      .map((res) => res.getFirst(key))
      .filter((x) => x != null);
  }
}
