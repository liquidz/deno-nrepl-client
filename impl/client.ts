import {
  Context,
  NreplClient,
  NreplDoneResponse,
  NreplRequest,
  NreplResponse,
  NreplStatus,
  RequestManager,
} from "../types.ts";
import { NreplDoneResponseImpl, NreplResponseImpl } from "./response.ts";
import { async, bencode, bufio } from "../deps.ts";

export async function readResponse(
  bufReader: bufio.BufReader,
  reqManager?: RequestManager,
): Promise<NreplResponse> {
  const originalRes = await bencode.read(bufReader);
  if (!bencode.isObject(originalRes)) {
    return Promise.reject(new Deno.errors.InvalidData());
  }

  const id = originalRes["id"];
  if (id == null || typeof id !== "string") {
    return new NreplResponseImpl(originalRes);
  }

  const req = (reqManager || {})[id];
  if (req == null) {
    return new NreplResponseImpl(originalRes);
  }

  const res = new NreplResponseImpl(originalRes, req.context);
  req.responses.push(res);

  if (res.isDone()) {
    req.d.resolve(
      new NreplDoneResponseImpl({
        responses: req.responses,
        context: req.context,
      }),
    );
    delete (reqManager || {})[id];
  }

  return res;
}

export async function writeRequest(
  bufWriter: bufio.BufWriter,
  message: NreplRequest,
  context?: Context,
  reqManager?: RequestManager,
): Promise<NreplDoneResponse> {
  if (!bencode.isObject(message)) {
    return Promise.reject(Deno.errors.InvalidData());
  }

  // Assigning ID
  const id = message["id"] ?? crypto.randomUUID();
  if (typeof id !== "string") {
    throw Error("nrepl: id must be a string");
  }
  message["id"] = id;

  if (reqManager == null) {
    await bencode.write(bufWriter, message);
    return Promise.resolve(
      new NreplDoneResponseImpl({ responses: [], context: context || {} }),
    );
  }

  const d = async.deferred<NreplDoneResponse>();
  reqManager[id] = {
    d: d,
    context: context || {},
    responses: [],
  };

  await bencode.write(bufWriter, message);
  return d;
}

export class NreplClientImpl implements NreplClient {
  readonly conn: Deno.Conn;
  readonly bufReader: bufio.BufReader;
  readonly bufWriter: bufio.BufWriter;

  #status: NreplStatus = "NotConnected";
  #closed: boolean;
  #reqManager: RequestManager;

  constructor(
    { conn, bufReader, bufWriter }: {
      conn: Deno.Conn;
      bufReader?: bufio.BufReader;
      bufWriter?: bufio.BufWriter;
    },
  ) {
    this.conn = conn;
    this.bufReader = bufReader || new bufio.BufReader(this.conn);
    this.bufWriter = bufWriter || new bufio.BufWriter(this.conn);

    this.#closed = false;
    this.#reqManager = {};
    this.#status = "Waiting";
  }

  get isClosed(): boolean {
    return this.#closed;
  }

  get status(): NreplStatus {
    if (this.#status === "Waiting" && this.#reqManager !== {}) {
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
    context?: Context,
  ): Promise<NreplDoneResponse> {
    return await writeRequest(
      this.bufWriter,
      message,
      context,
      this.#reqManager,
    );
  }
}
