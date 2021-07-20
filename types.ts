import { bencode, bufio } from "./deps.ts";

export type BencodeReader = (
  input: bufio.BufReader,
) => Promise<bencode.Bencode>;

export type BencodeWriter = (
  output: bufio.BufWriter,
  x: bencode.Bencode,
) => Promise<number>;

export type ConnectOptions = {
  hostname?: string;
  port: number;
  bencodeReader?: BencodeReader;
  bencodeWriter?: BencodeWriter;
};

export interface Response {
  id(): string | null;
  get(key: string): bencode.Bencode;
  isDone(): boolean;
}

export type Request = bencode.BencodeObject;

export type Context = Record<string, string>;

export abstract class DoneResponse implements Response {
  readonly responses: Response[] = [];
  readonly context: Context = {};

  abstract id(): string | null;
  abstract get(key: string): bencode.Bencode;
  abstract isDone(): boolean;
}

export interface nREPL {
  readonly hostname: string;
  readonly port: number;
  readonly isClosed: boolean;

  connect(): void;
  close(): void;
  read(): Promise<Response>;
  write(message: Request, context?: Context): Promise<DoneResponse>;
}
