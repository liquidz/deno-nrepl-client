import { NreplClientImpl } from "./impl/client.ts";
import { NreplClient } from "./types.ts";

/**
 * Connect to a nREPL server.
 */
export async function connect(
  { hostname, port }: { hostname?: string; port: number },
): Promise<NreplClient> {
  const conn = await Deno.connect({
    hostname: hostname || "127.0.0.1",
    port: port,
  });
  return new NreplClientImpl({ conn: conn });
}
