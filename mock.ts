import {
  NreplClient,
  NreplOutput,
  NreplStatus,
  NreplWriteOption,
} from "./types.ts";
import { async, bencode, mockConn } from "./deps.ts";
import { NreplResponseImpl } from "./impl/response.ts";
import { BencodeObjectToNreplOutputStream } from "./impl/stream.ts";

export type RelayFunction = (
  msg: bencode.BencodeObject,
  option?: NreplWriteOption,
) => bencode.BencodeObject;

type Option = {
  status?: NreplStatus;
  readInterval?: number;
};

export class NreplClientMock implements NreplClient {
  readonly conn: Deno.Conn;
  readonly readable: ReadableStream<bencode.Bencode>;
  readonly writable: WritableStream<Uint8Array>;
  readonly output: ReadableStream<NreplOutput>;

  #status: NreplStatus;
  #closed: boolean;
  #closingSignal: async.Deferred<boolean>;
  #startingPromise: Promise<void> | undefined;
  #relay: RelayFunction;

  constructor(relay: RelayFunction, option?: Option) {
    this.conn = mockConn.mockConn();
    this.writable = this.conn.writable;
    const [strm1, strm2] = this.conn.readable
      .pipeThrough(new bencode.Uint8ArrayToBencodeStream())
      .tee();

    this.readable = strm1;
    this.output = strm2.pipeThrough(new BencodeObjectToNreplOutputStream());

    this.#relay = relay;
    this.#status = option?.status || "Waiting";
    this.#closed = false;
    this.#closingSignal = async.deferred();
  }

  get status() {
    return this.#status;
  }

  async close() {
    this.#closed = true;
    this.#status = "NotConnected";
    this.#closingSignal.resolve();

    if (this.#startingPromise != null) {
      await this.#startingPromise;
    }
  }

  get closed(): Promise<void> {
    return this.#startingPromise == null
      ? Promise.resolve()
      : this.#startingPromise;
  }

  get isClosed() {
    return this.#closed;
  }

  read() {
    return Promise.resolve(new NreplResponseImpl([]));
  }

  write(message: bencode.BencodeObject, option?: NreplWriteOption) {
    const response = this.#relay(message, option);
    if (message["id"] != null) {
      response["id"] = message["id"];
    }
    if (message["session"] != null) {
      response["session"] = message["session"];
    }
    if (response["status"] == null) {
      response["status"] = ["done"];
    }

    if (message["op"] === "describe" && response["ops"] == null) {
      response["ops"] = { clone: 1, close: 1, eval: 1 };
    }

    if (message["op"] === "clone" && response["new-session"] == null) {
      response["new-session"] = crypto.randomUUID();
    }

    return Promise.resolve(new NreplResponseImpl([response], option?.context));
  }

  async #start(): Promise<void> {
    try {
      await this.#closingSignal;
    } catch (_) {
      if (!this.isClosed) {
        await this.close();
      }
    }

    return;
  }

  start(): boolean {
    if (this.#startingPromise != null) {
      return false;
    }
    this.#startingPromise = this.#start();
    return true;
  }
}
