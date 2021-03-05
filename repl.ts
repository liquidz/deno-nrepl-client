export abstract class AbstractREPL<T> {
  abstract connect(host: string, port: number): void;
  abstract disconnect(): void;
  abstract send(message: T): Promise<T[]>;
}
