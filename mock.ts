import {
  NreplClient,
  NreplMessage,
  NreplResponse,
  NreplStatus,
  NreplWriteOption,
} from "./types.ts";
import { io } from "./deps.ts";
import { NreplResponseImpl } from "./impl/response.ts";

import { mockConn as createMockConn } from "https://deno.land/std@0.170.0/http/_mock_conn.ts";

export type RelayFunction = (
  msg: NreplMessage,
  option?: NreplWriteOption,
) => NreplMessage;

type Option = {
  status?: NreplStatus;
  readInterval?: number;
};

export class NreplClientMock implements NreplClient {
  readonly conn: Deno.Conn;
  readonly bufReader: io.BufReader;
  readonly bufWriter: io.BufWriter;

  #status: NreplStatus;
  #closed: boolean;
  #relay: RelayFunction;
  #readInterval: number;

  constructor(relay: RelayFunction, option?: Option) {
    this.conn = createMockConn();
    this.bufReader = new io.BufReader(this.conn);
    this.bufWriter = new io.BufWriter(this.conn);

    this.#relay = relay;
    this.#status = option?.status || "Waiting";
    this.#readInterval = option?.readInterval || 1000;
    this.#closed = false;
  }

  get status() {
    return this.#status;
  }

  close() {
    this.#closed = true;
  }
  get isClosed() {
    return this.#closed;
  }

  read() {
    return new Promise<NreplResponse>((resolve) => {
      setTimeout((_) => {
        resolve(new NreplResponseImpl([]));
      }, this.#readInterval);
    });
  }

  write(message: NreplMessage, option?: NreplWriteOption) {
    const response = this.#relay(message, option);
    if (message["id"] !== undefined) {
      response["id"] = message["id"];
    }
    if (message["session"] !== undefined) {
      response["session"] = message["session"];
    }
    if (response["status"] === undefined) {
      response["status"] = ["done"];
    }

    if (message["op"] === "describe" && response["ops"] === undefined) {
      response["ops"] = { clone: 1, close: 1, eval: 1 };
    }

    if (message["op"] === "clone" && response["new-session"] === undefined) {
      response["new-session"] = crypto.randomUUID();
    }

    return Promise.resolve(new NreplResponseImpl([response], option?.context));
  }
}
