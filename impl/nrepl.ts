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
import { async, bencode, bufio, uuid } from "../deps.ts";

type RequestBody = {
  d: async.Deferred<DoneResponse>;
  responses: Response[];
  context: Context;
};

export class nREPLImpl implements nREPL {
  readonly hostname: string;
  readonly port: number;
  readonly bencodeReader: BencodeReader;
  readonly bencodeWriter: BencodeWriter;

  private conn: Deno.Conn | null;
  private bufReader: bufio.BufReader | null;
  private bufWriter: bufio.BufWriter | null;
  private requestManager: Record<string, RequestBody> = {};

  constructor(options: ConnectOptions) {
    this.hostname = options.hostname || "127.0.0.1";
    this.port = options.port;
    this.bencodeReader = options.bencodeReader || bencode.read;
    this.bencodeWriter = options.bencodeWriter || bencode.write;

    this.conn = null;
    this.bufReader = null;
    this.bufWriter = null;
  }

  async connect() {
    this.conn = await Deno.connect({
      hostname: this.hostname,
      port: this.port,
    });
    this.bufReader = new bufio.BufReader(this.conn);
    this.bufWriter = new bufio.BufWriter(this.conn);
  }

  get isClosed(): boolean {
    return (this.bufReader === null);
  }

  close() {
    if (this.conn === null) return;
    this.conn.close();
    this.conn = null;
    this.bufReader = null;
    this.bufWriter = null;
  }

  async read(): Promise<Response> {
    if (this.bufReader === null) {
      return Promise.reject(new Deno.errors.NotConnected());
    }

    const originalRes = await this.bencodeReader(this.bufReader);
    if (!bencode.isObject(originalRes)) {
      return Promise.reject(new Deno.errors.InvalidData("FIXME"));
    }
    const res = new ResponseImpl(originalRes);

    const id = res.id();
    if (id !== null) {
      const req = this.requestManager[id];
      req.responses.push(res);

      if (res.isDone()) {
        req.d.resolve(
          new DoneResponseImpl({
            responses: req.responses,
            context: req.context,
          }),
        );
        delete this.requestManager[id];
      }
    }

    return res;
  }

  async write(message: Request, context?: Context): Promise<DoneResponse> {
    if (this.bufWriter === null) {
      return Promise.reject(Deno.errors.NotConnected());
    }
    if (!bencode.isObject(message)) {
      return Promise.reject(Deno.errors.InvalidData());
    }

    const id = message["id"] ?? uuid.v4.generate();
    if (typeof id !== "string") {
      throw Error("nrepl: id must be a string");
    }

    const d = async.deferred<DoneResponse>();
    this.requestManager[id] = {
      d: d,
      context: context || {},
      responses: [],
    };

    message["id"] = id;
    await this.bencodeWriter(this.bufWriter, message);

    return d;
  }
}
