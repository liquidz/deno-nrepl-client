import { bencode } from "../deps.ts";
import { BencodeWithContext, NreplOutput, RequestManager } from "../types.ts";

export class AssociatingContextStream extends TransformStream<
  bencode.BencodeObject,
  BencodeWithContext
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
    controller: TransformStreamDefaultController<BencodeWithContext>,
  ) {
    const id = chunk["id"];
    if (id == null || typeof id !== "string") {
      controller.enqueue({ message: chunk, context: {} });
    } else {
      const reqBody = this.#reqManager[id];
      controller.enqueue({ message: chunk, context: reqBody?.context ?? {} });
    }
  }
}

export class BencodeWithContextToNreplOutputStream extends TransformStream<
  BencodeWithContext,
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
    chunk: BencodeWithContext,
    controller: TransformStreamDefaultController<NreplOutput>,
  ) {
    const { message, context } = chunk;

    if (message["out"] != null && typeof message["out"] === "string") {
      controller.enqueue({ type: "out", text: message["out"], context });
    } else if (
      message["pprint-out"] != null &&
      typeof message["pprint-out"] === "string"
    ) {
      controller.enqueue({
        type: "pprint-out",
        text: message["pprint-out"],
        context,
      });
    } else if (message["err"] != null && typeof message["err"] === "string") {
      controller.enqueue({ type: "err", text: message["err"], context });
    }
  }
}
