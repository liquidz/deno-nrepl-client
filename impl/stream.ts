import { bencode } from "../deps.ts";
import { BencodeWithMeta, NreplOutput, RequestManager } from "../types.ts";

export class AssociatingMetaStream extends TransformStream<
  bencode.BencodeObject,
  BencodeWithMeta
> {
  #reqManager: RequestManager;
  constructor(reqManager: RequestManager) {
    super({
      transform: (chunk, controller) => {
        this.#handle(chunk, controller);
      },
    });

    this.#reqManager = reqManager;
  }

  #handle(
    chunk: bencode.BencodeObject,
    controller: TransformStreamDefaultController<BencodeWithMeta>,
  ) {
    const id = chunk["id"];
    if (id == null || typeof id !== "string") {
      controller.enqueue({ message: chunk, meta: {} });
    } else {
      const reqBody = this.#reqManager[id];
      controller.enqueue({ message: chunk, meta: reqBody?.meta ?? {} });
    }
  }
}

export class BencodeWithMetaToNreplOutputStream extends TransformStream<
  BencodeWithMeta,
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
    chunk: BencodeWithMeta,
    controller: TransformStreamDefaultController<NreplOutput>,
  ) {
    const { message, meta } = chunk;

    if (message["out"] != null && typeof message["out"] === "string") {
      controller.enqueue({ type: "out", text: message["out"], meta });
    } else if (
      message["pprint-out"] != null &&
      typeof message["pprint-out"] === "string"
    ) {
      controller.enqueue({
        type: "pprint-out",
        text: message["pprint-out"],
        meta,
      });
    } else if (message["err"] != null && typeof message["err"] === "string") {
      controller.enqueue({ type: "err", text: message["err"], meta });
    }
  }
}
