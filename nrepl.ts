import { nREPLImpl } from "./impl/nrepl.ts";
import { nREPL } from "./types.ts";

export async function connect(
  { hostname, port }: { hostname: string; port: number },
): Promise<nREPL> {
  const conn = await Deno.connect({
    hostname: hostname,
    port: port,
  });
  return new nREPLImpl({ conn: conn });
}
