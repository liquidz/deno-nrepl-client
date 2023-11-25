import { async, bencode } from "./deps.ts";

/**
 * An arbitrary meta data record that can be specified on each requests.
 * This meta data record will be returned on NreplResponse.
 */
export type Meta = Record<string, unknown>;

export type BencodeWithMeta = {
  message: bencode.BencodeObject;
  meta: Meta;
};

type RequestBody = {
  deferredResponse: async.Deferred<NreplResponse>;
  responses: bencode.BencodeObject[];
  meta: Meta;
};

/**
 * A Record to manage requests for which DONE status has not been returned
 */
export type RequestManager = Record<string, RequestBody>;

export type NreplResponse = {
  readonly responses: bencode.BencodeObject[];
  meta: Meta;
  id(): string | null;
  get(key: string): bencode.Bencode[];
  getOne(key: string): bencode.Bencode;
  isDone(): boolean;
};

export type NreplStatus = "Waiting" | "Evaluating" | "NotConnected";

export type NreplWriteOption = {
  meta?: Meta;
  doesWaitResponse?: boolean;
};

export type NreplOutputType = "out" | "err" | "pprint-out";

export type NreplOutput = {
  readonly type: NreplOutputType;
  readonly text: string;
  readonly meta: Meta;
};

export type NreplClient = {
  readonly conn: Deno.Conn;
  readonly readable: ReadableStream<BencodeWithMeta>;
  readonly writable: WritableStream<Uint8Array>;
  readonly output: ReadableStream<NreplOutput>;

  readonly closed: Promise<void>;
  readonly isClosed: boolean;
  readonly status: NreplStatus;

  close(): Promise<void>;
  read(): Promise<NreplResponse>;
  write(
    message: bencode.BencodeObject,
    option?: NreplWriteOption,
  ): Promise<NreplResponse>;

  start(): boolean;
};
