import { async, bencode, io } from "./deps.ts";

/**
 * An arbitrary context record that can be specified on each requests.
 * This context record will be returned on NreplResponse.
 */
export type Context = Record<string, string>;

type RequestBody = {
  deferredResponse: async.Deferred<NreplResponse>;
  responses: bencode.BencodeObject[];
  context: Context;
};

/**
 * A Record to manage requests for which DONE status has not been returned
 */
export type RequestManager = Record<string, RequestBody>;

export type NreplResponse = {
  readonly responses: bencode.BencodeObject[];
  context: Context;
  id(): string | null;
  get(key: string): bencode.Bencode[];
  getOne(key: string): bencode.Bencode;
  isDone(): boolean;
};

export type NreplStatus = "Waiting" | "Evaluating" | "NotConnected";

export type NreplWriteOption = {
  context?: Context;
  doesWaitResponse?: boolean;
};

export type NreplClient = {
  readonly conn: Deno.Conn;
  readonly bufReader: io.BufReader;
  readonly bufWriter: io.BufWriter;
  readonly isClosed: boolean;
  readonly status: NreplStatus;

  close(): void;
  read(): Promise<NreplResponse>;
  write(
    message: bencode.BencodeObject,
    option?: NreplWriteOption,
  ): Promise<NreplResponse>;
};
