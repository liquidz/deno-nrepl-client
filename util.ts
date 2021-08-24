import { NreplDoneResponseImpl, NreplResponseImpl } from "./impl/response.ts";
import { Context } from "./types.ts";
import { bencode } from "./deps.ts";

/**
 * Mainly use for testing
 */
export function doneResponse(
  responses: Array<bencode.BencodeObject>,
  context?: Context,
) {
  const ctx = context ?? {};
  const resps = responses.map((r) => {
    return new NreplResponseImpl(r, ctx);
  });
  resps.push(new NreplResponseImpl({ status: ["done"] }));

  return new NreplDoneResponseImpl({
    responses: resps,
    context: ctx,
  });
}
