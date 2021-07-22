import { async, bencode, bufio } from "./deps.ts";

export interface Response {
  context: Context;
  id(): string | null;
  getFirst(key: string): bencode.Bencode;
  getAll(key: string): bencode.Bencode[];
  isDone(): boolean;
}

export type Request = bencode.BencodeObject;

export type Context = Record<string, string>;

export interface DoneResponse extends Response {
  readonly responses: Response[];
  readonly context: Context;
}

export interface nREPLClient {
  readonly conn: Deno.Conn;
  readonly bufReader: bufio.BufReader;
  readonly bufWriter: bufio.BufWriter;
  readonly isClosed: boolean;

  close(): void;
  read(): Promise<Response>;
  write(message: Request, context?: Context): Promise<DoneResponse>;
}

type RequestBody = {
  d: async.Deferred<DoneResponse>;
  responses: Response[];
  context: Context;
};

export type RequestManager = Record<string, RequestBody>;
