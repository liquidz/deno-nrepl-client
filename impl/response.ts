import { Context, NreplResponse } from "../types.ts";
import { bencode } from "../deps.ts";

export class NreplResponseImpl implements NreplResponse {
  readonly responses: bencode.BencodeObject[];
  readonly context: Context;

  constructor(responses: bencode.BencodeObject[], context?: Context) {
    this.responses = responses;
    this.context = context || {};
  }

  id(): string | null {
    if (this.responses.length === 0) {
      return null;
    }
    const id = this.responses[0]["id"];
    return (typeof id === "string") ? id : null;
  }

  get(key: string): bencode.Bencode[] {
    return this.responses.map((v) => v[key]).filter((v) => v != null);
  }

  isDone(): boolean {
    return this.get("status").flat().indexOf("done") !== -1;
  }
}
