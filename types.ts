import { async, bencode, io } from "./deps.ts";

export type Context = Record<string, string>;
export type NreplMessage = bencode.BencodeObject;

export type NreplResponse = {
  readonly responses: NreplMessage[];
  context: Context;
  id(): string | null;
  get(key: string): bencode.Bencode[];
  getOne(key: string): bencode.Bencode;
  isDone(): boolean;
};

export type NreplStatus = "Waiting" | "Evaluating" | "NotConnected";

export type NreplWriteOption = {
  context: Context;
};

export interface NreplClient {
  readonly conn: Deno.Conn;
  readonly bufReader: io.BufReader;
  readonly bufWriter: io.BufWriter;
  readonly isClosed: boolean;
  readonly status: NreplStatus;

  close(): void;
  read(): Promise<NreplResponse>;
  write(
    message: NreplMessage,
    option?: NreplWriteOption,
  ): Promise<NreplResponse>;
}

type RequestBody = {
  deferredResponse: async.Deferred<NreplResponse>;
  responses: NreplMessage[];
  context: Context;
};

export type RequestManager = Record<string, RequestBody>;
