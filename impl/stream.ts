import { bencode } from "../deps.ts";
import { NreplOutput } from "../types.ts";

export class BencodeObjectToNreplOutputStream extends TransformStream<
  bencode.BencodeObject,
  NreplOutput
> {
  constructor() {
    super({
      transform: (chunk, controller) => {
        this.#handle(chunk, controller);
      },
    });
  }

  #handle(
    chunk: bencode.BencodeObject,
    controller: TransformStreamDefaultController<NreplOutput>,
  ) {
    if (chunk["out"] != null && typeof chunk["out"] === "string") {
      controller.enqueue({ type: "out", text: chunk["out"] });
    } else if (
      chunk["pprint-out"] != null &&
      typeof chunk["pprint-out"] === "string"
    ) {
      controller.enqueue({
        type: "pprint-out",
        text: chunk["pprint-out"],
      });
    } else if (chunk["err"] != null && typeof chunk["err"] === "string") {
      controller.enqueue({ type: "err", text: chunk["err"] });
    }
  }
}
