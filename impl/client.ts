import {
  Context,
  NreplClient,
  NreplRequest,
  NreplResponse,
  NreplStatus,
  NreplWriteOption,
  RequestManager,
} from "../types.ts";
import { NreplResponseImpl } from "./response.ts";
import { async, bencode, io } from "../deps.ts";

/* --------------------
 * readResponse
 * -------------------- */
export async function readResponse(
  bufReader: io.BufReader,
  reqManager?: RequestManager,
): Promise<NreplResponse> {
  const originalRes = await bencode.read(bufReader);
  if (!bencode.isObject(originalRes)) {
    return Promise.reject(new Deno.errors.InvalidData());
  }

  const id = originalRes["id"];
  if (id == null || typeof id !== "string") {
    return new NreplResponseImpl([originalRes]);
  }

  const reqBody = (reqManager || {})[id];
  if (reqBody == null) {
    return new NreplResponseImpl([originalRes]);
  }

  const res = new NreplResponseImpl([originalRes], reqBody.context);
  reqBody.responses.push(originalRes);

  if (res.isDone()) {
    reqBody.deferredResponse.resolve(
      new NreplResponseImpl(reqBody.responses, reqBody.context),
    );
    delete (reqManager || {})[id];
  }

  return res;
}

/* --------------------
 * writeRequest
 * -------------------- */
export async function writeRequest(
  bufWriter: io.BufWriter,
  message: NreplRequest,
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
    await bencode.write(bufWriter, message);
    return Promise.resolve(
      new NreplResponseImpl([], context || {}),
    );
  }

  const d = async.deferred<NreplResponse>();

  reqManager[id] = {
    deferredResponse: d,
    context: context || {},
    responses: [],
  };

  await bencode.write(bufWriter, message);
  return d;
}

/* --------------------
 * NreplClientImpl
 * -------------------- */
export class NreplClientImpl implements NreplClient {
  readonly conn: Deno.Conn;
  readonly bufReader: io.BufReader;
  readonly bufWriter: io.BufWriter;

  #status: NreplStatus = "NotConnected";
  #closed: boolean;
  #reqManager: RequestManager;

  constructor(
    { conn, bufReader, bufWriter }: {
      conn: Deno.Conn;
      bufReader?: io.BufReader;
      bufWriter?: io.BufWriter;
    },
  ) {
    this.conn = conn;
    this.bufReader = bufReader || new io.BufReader(this.conn);
    this.bufWriter = bufWriter || new io.BufWriter(this.conn);

    this.#closed = false;
    this.#reqManager = {};
    this.#status = "Waiting";
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
  }

  async read(): Promise<NreplResponse> {
    return await readResponse(this.bufReader, this.#reqManager);
  }

  async write(
    message: NreplRequest,
    option?: NreplWriteOption,
  ): Promise<NreplResponse> {
    return await writeRequest(
      this.bufWriter,
      message,
      option?.context,
      this.#reqManager,
    );
  }
}
