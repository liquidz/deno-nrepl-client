import { nREPLClientImpl } from "./impl/nrepl.ts";
import { nREPLClient } from "./types.ts";

export async function connect(
  { hostname, port }: { hostname: string; port: number },
): Promise<nREPLClient> {
  const conn = await Deno.connect({
    hostname: hostname,
    port: port,
  });
  return new nREPLClientImpl({ conn: conn });
}
