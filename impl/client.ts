import {
  Context,
  NreplClient,
  NreplOutput,
  NreplResponse,
  NreplStatus,
  NreplWriteOption,
  RequestManager,
} from "../types.ts";
import { NreplResponseImpl } from "./response.ts";
import { BencodeObjectToNreplOutputStream } from "./stream.ts";
import { async, bencode } from "../deps.ts";

const textEncoder = new TextEncoder();
const closedMessage = "nREPL connection is closed" as const;

/* --------------------
 * readResponse
 * -------------------- */
async function readResponse(
  readableStream: ReadableStream<bencode.Bencode>,
  reqManager?: RequestManager,
): Promise<NreplResponse> {
  const reader = readableStream.getReader();
  try {
    const { done, value } = await reader.read();
    if (done) {
      return Promise.reject(new Deno.errors.InvalidData());
    }
    if (!bencode.isObject(value)) {
      return Promise.reject(new Deno.errors.InvalidData());
    }

    const id = value["id"];
    if (id == null || typeof id !== "string") {
      return new NreplResponseImpl([value]);
    }

    const reqBody = (reqManager || {})[id];
    if (reqBody == null) {
      return new NreplResponseImpl([value]);
    }

    const res = new NreplResponseImpl([value], reqBody.context);
    reqBody.responses.push(value);

    if (res.isDone()) {
      reqBody.deferredResponse.resolve(
        new NreplResponseImpl(reqBody.responses, reqBody.context),
      );
      delete (reqManager || {})[id];
    }

    return res;
  } finally {
    reader.releaseLock();
  }
}

/* --------------------
 * writeRequest
 * -------------------- */

async function writeMessage(
  writableStream: WritableStream<Uint8Array>,
  message: bencode.BencodeObject,
) {
  const writer = writableStream.getWriter();
  await writer.ready;
  await writer.write(textEncoder.encode(bencode.encode(message)));
  writer.releaseLock();
}

async function writeRequest(
  writableStream: WritableStream<Uint8Array>,
  message: bencode.BencodeObject,
  context?: Context,
  reqManager?: RequestManager,
): Promise<NreplResponse> {
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
  if (reqManager == null) {
    await writeMessage(writableStream, message);
    return Promise.resolve(new NreplResponseImpl([], context || {}));
  }

  const d = async.deferred<NreplResponse>();

  reqManager[id] = {
    deferredResponse: d,
    context: context || {},
    responses: [],
  };

  await writeMessage(writableStream, message);
  return d;
}

/* --------------------
 * NreplClientImpl
 * -------------------- */
export class NreplClientImpl implements NreplClient {
  readonly conn: Deno.Conn;
  readonly readable: ReadableStream<bencode.Bencode>;
  readonly writable: WritableStream<Uint8Array>;
  readonly output: ReadableStream<NreplOutput>;

  #status: NreplStatus = "NotConnected";
  #closed: boolean;
  #reqManager: RequestManager;
  #closingSignal: async.Deferred<never>;

  constructor({
    conn,
    readable,
    writable,
  }: {
    conn: Deno.Conn;
    readable?: ReadableStream<Uint8Array>;
    writable?: WritableStream<Uint8Array>;
  }) {
    this.conn = conn;
    const [bencodeStream1, bencodeStream2] = (readable ?? this.conn.readable)
      .pipeThrough(new bencode.Uint8ArrayToBencodeStream())
      .tee();

    this.readable = bencodeStream1;
    this.output = bencodeStream2.pipeThrough(
      new BencodeObjectToNreplOutputStream(),
    );
    this.writable = writable ?? this.conn.writable;

    this.#closed = false;
    this.#reqManager = {};
    this.#status = "Waiting";
    this.#closingSignal = async.deferred();
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

  close() {
    this.#closed = true;
    this.#status = "NotConnected";
    this.conn.close();
    this.#closingSignal.reject(closedMessage);
  }

  async read(): Promise<NreplResponse> {
    return await readResponse(this.readable, this.#reqManager);
  }

  async write(
    message: bencode.BencodeObject,
    option?: NreplWriteOption,
  ): Promise<NreplResponse> {
    const doesWaitResponse = option?.doesWaitResponse == null
      ? true
      : option?.doesWaitResponse;

    return await writeRequest(
      this.writable,
      message,
      option?.context,
      doesWaitResponse ? this.#reqManager : undefined,
    );
  }

  async start(): Promise<void> {
    try {
      while (!this.isClosed) {
        await Promise.race([this.read(), this.#closingSignal]);
      }
    } catch (e) {
      if (!this.isClosed) {
        this.close();
      }
      if (e !== closedMessage) {
        return Promise.reject(e);
      }
    }

    return;
  }
}
