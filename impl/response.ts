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
    const id = this.getOne("id");
    return typeof id === "string" ? id : null;
  }

  get(key: string): bencode.Bencode[] {
    return this.responses.map((v) => v[key]).filter((v) => v != null);
  }

  getOne(key: string): bencode.Bencode {
    const vals = this.get(key);
    return vals.length > 0 ? vals[0] : null;
  }

  isDone(): boolean {
    return this.get("status").flat().indexOf("done") !== -1;
  }
}
