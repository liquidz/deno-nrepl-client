import {
  BencodeReader,
  BencodeWriter,
  ConnectOptions,
  Context,
  DoneResponse,
  nREPL,
  Request,
  Response,
} from "../types.ts";
import { DoneResponseImpl, ResponseImpl } from "./response.ts";
import { async, bencode, bufio } from "../deps.ts";

type RequestBody = {
  d: async.Deferred<DoneResponse>;
  responses: Response[];
  context: Context;
};

export class nREPLImpl implements nREPL {
  readonly conn: Deno.Conn;
  readonly bufReader: bufio.BufReader;
  readonly bufWriter: bufio.BufWriter;
  readonly bencodeReader: BencodeReader;
  readonly bencodeWriter: BencodeWriter;

  #closed: boolean;
  #requestManager: Record<string, RequestBody> = {};

  constructor(options: ConnectOptions) {
    this.conn = options.conn;
    this.bufReader = options.bufReader || new bufio.BufReader(this.conn);
    this.bufWriter = options.bufWriter || new bufio.BufWriter(this.conn);
    this.bencodeReader = options.bencodeReader || bencode.read;
    this.bencodeWriter = options.bencodeWriter || bencode.write;

    this.#closed = false;
  }

  get isClosed(): boolean {
    return this.#closed;
  }

  close() {
    this.#closed = true;
    this.conn.close();
  }

  async read(): Promise<Response> {
    const originalRes = await this.bencodeReader(this.bufReader);
    if (!bencode.isObject(originalRes)) {
      return Promise.reject(new Deno.errors.InvalidData());
    }
    const res = new ResponseImpl(originalRes);

    const id = res.id();
    if (id !== null) {
      const req = this.#requestManager[id];
      req.responses.push(res);

      if (res.isDone()) {
        req.d.resolve(
          new DoneResponseImpl({
            responses: req.responses,
            context: req.context,
          }),
        );
        delete this.#requestManager[id];
      }
    }

    return res;
  }

  async write(message: Request, context?: Context): Promise<DoneResponse> {
    if (!bencode.isObject(message)) {
      return Promise.reject(Deno.errors.InvalidData());
    }

    const id = message["id"] ?? crypto.randomUUID();
    if (typeof id !== "string") {
      throw Error("nrepl: id must be a string");
    }

    const d = async.deferred<DoneResponse>();
    this.#requestManager[id] = {
      d: d,
      context: context || {},
      responses: [],
    };

    message["id"] = id;
    await this.bencodeWriter(this.bufWriter, message);

    return d;
  }
}
