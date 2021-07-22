import { bencode, bufio } from "./deps.ts";

export type BencodeReader = (
  input: bufio.BufReader,
) => Promise<bencode.Bencode>;

export type BencodeWriter = (
  output: bufio.BufWriter,
  x: bencode.Bencode,
) => Promise<number>;

export type ConnectOptions = {
  conn: Deno.Conn;
  bufReader?: bufio.BufReader;
  bufWriter?: bufio.BufWriter;
  bencodeReader?: BencodeReader;
  bencodeWriter?: BencodeWriter;

  host?: string;
  port?: number;
};

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
