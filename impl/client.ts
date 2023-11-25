import {
  BencodeWithMeta,
  NreplClient,
  NreplOutput,
  NreplResponse,
  NreplStatus,
  NreplWriteOption,
  RequestManager,
} from "../types.ts";
import { NreplResponseImpl } from "./response.ts";
import {
  AssociatingMetaStream,
  BencodeWithMetaToNreplOutputStream,
} from "./stream.ts";
import { async, bencode } from "../deps.ts";

const textEncoder = new TextEncoder();

export class NreplClientImpl implements NreplClient {
  readonly conn: Deno.Conn;
  readonly readable: ReadableStream<BencodeWithMeta>;
  readonly writable: WritableStream<Uint8Array>;
  readonly output: ReadableStream<NreplOutput>;

  #status: NreplStatus = "NotConnected";
  #closed: boolean;
  #reqManager: RequestManager;

  #closingSignal: async.Deferred<boolean>;
  #startingPromise: Promise<void> | undefined;

  constructor({
    conn,
    readable,
    writable,
  }: {
    conn: Deno.Conn;
    readable?: ReadableStream<Uint8Array>;
    writable?: WritableStream<Uint8Array>;
  }) {
    this.#reqManager = {};
    this.conn = conn;
    const [bencodeStream1, bencodeStream2] = (readable ?? this.conn.readable)
      .pipeThrough(new bencode.Uint8ArrayToBencodeStream())
      .pipeThrough(new AssociatingMetaStream(this.#reqManager))
      .tee();

    this.readable = bencodeStream1;
    this.output = bencodeStream2.pipeThrough(
      new BencodeWithMetaToNreplOutputStream(),
    );
    this.writable = writable ?? this.conn.writable;

    this.#closed = false;
    this.#status = "Waiting";
    this.#closingSignal = async.deferred();
  }

  get closed(): Promise<void> {
    return this.#startingPromise == null
      ? Promise.resolve()
      : this.#startingPromise;
  }

  get isClosed(): boolean {
    return this.#closed;
  }

  get status(): NreplStatus {
    if (
      this.#status === "Waiting" &&
      Object.entries(this.#reqManager).length !== 0
    ) {
      return "Evaluating";
    }
    return this.#status;
  }

  async close(): Promise<void> {
    this.#closed = true;
    this.#status = "NotConnected";
    this.conn.close();
    this.#closingSignal.resolve();

    if (this.#startingPromise != null) {
      await this.#startingPromise;
    }
  }

  /* --------------------
   * read
   * -------------------- */

  async read(): Promise<NreplResponse> {
    const reader = this.readable.getReader();
    try {
      const { done, value } = await reader.read();
      if (done) {
        return Promise.reject(new Deno.errors.InvalidData());
      }

      const { message } = value;
      if (!bencode.isObject(message)) {
        return Promise.reject(new Deno.errors.InvalidData());
      }

      const id = message["id"];
      if (id == null || typeof id !== "string") {
        return new NreplResponseImpl([message]);
      }

      const reqBody = this.#reqManager[id];
      if (reqBody == null) {
        return new NreplResponseImpl([message]);
      }

      const res = new NreplResponseImpl([message], reqBody.meta);
      reqBody.responses.push(message);

      if (res.isDone()) {
        reqBody.deferredResponse.resolve(
          new NreplResponseImpl(reqBody.responses, reqBody.meta),
        );

        //this.#reqManager.deleteRequest(id);;
        delete this.#reqManager[id];
      }

      return res;
    } finally {
      reader.releaseLock();
    }
  }

  /* --------------------
   * write
   * -------------------- */

  async #writeMessage(
    writableStream: WritableStream<Uint8Array>,
    message: bencode.BencodeObject,
  ) {
    const writer = writableStream.getWriter();
    await writer.ready;
    await writer.write(textEncoder.encode(bencode.encode(message)));
    writer.releaseLock();
  }

  async write(
    message: bencode.BencodeObject,
    option?: NreplWriteOption,
  ): Promise<NreplResponse> {
    const doesWaitResponse = option?.doesWaitResponse == null
      ? true
      : option?.doesWaitResponse;

    if (!bencode.isObject(message)) {
      return Promise.reject(new Deno.errors.InvalidData());
    }

    // Assigning ID
    const id = message["id"] ?? crypto.randomUUID();
    if (typeof id !== "string") {
      throw Error("nrepl: id must be a string");
    }
    message["id"] = id;

    // When you don't wait for responses
    if (!doesWaitResponse) {
      await this.#writeMessage(this.writable, message);
      return Promise.resolve(new NreplResponseImpl([], option?.meta || {}));
    }

    const d = async.deferred<NreplResponse>();

    this.#reqManager[id] = {
      deferredResponse: d,
      meta: option?.meta || {},
      responses: [],
    };

    await this.#writeMessage(this.writable, message);
    return d;
  }

  async #start(): Promise<void> {
    try {
      while (!this.isClosed) {
        await Promise.race([this.read(), this.#closingSignal]);
      }
    } catch (e) {
      if (!this.isClosed) {
        await this.close();
      }
      return Promise.reject(e);
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
