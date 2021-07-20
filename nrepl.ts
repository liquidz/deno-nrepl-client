import { nREPLImpl } from "./impl/nrepl.ts";
import {
  ConnectOptions,
  Context,
  DoneResponse,
  nREPL,
  Request,
  Response,
} from "./types.ts";

export async function connect(options: ConnectOptions): Promise<nREPL> {
  const nrepl = new nREPLImpl(options);
  await nrepl.connect();
  return nrepl;
}

export async function read(nrepl: nREPL): Promise<Response> {
  return nrepl.read();
}

export async function write(
  nrepl: nREPL,
  message: Request,
  context?: Context,
): Promise<DoneResponse> {
  return nrepl.write(message, context || {});
}

export function close(nrepl: nREPL) {
  nrepl.close();
}

export function isClosed(nrepl: nREPL): boolean {
  return nrepl.isClosed;
}
