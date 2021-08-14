import { Context, NreplDoneResponse, NreplResponse } from "../types.ts";
import { bencode } from "../deps.ts";

export class NreplResponseImpl implements NreplResponse {
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

export class NreplDoneResponseImpl implements NreplDoneResponse {
  readonly responses: NreplResponse[];
  readonly context: Context;

  constructor(
    { responses, context }: { responses: NreplResponse[]; context: Context },
  ) {
    this.responses = responses;
    this.context = context;
  }

  get response(): bencode.BencodeObject {
    if (this.responses.length > 0) {
      throw Error("nrepl: No response");
    }
    return this.responses[0].response;
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
      if (v == null) continue;
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
