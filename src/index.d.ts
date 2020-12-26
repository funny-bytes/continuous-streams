import { Readable, Transform, Writable } from "stream";

export class ContinuousReader<T> extends Readable {
  constructor(opts?: ContinuousReaderOptions);
  readData(count: number): Promise<T[]>;
  stop(): void;
}

export interface ContinuousReaderOptions {
  chunkSize?: number;
  skipOnError?: boolean;
  waitAfterEmpty?: number;
  waitAfterLow?: number;
  waitAfterError?: number;
}

export class ContinuousWriter<T> extends Writable {
  constructor(opts?: ContinuousWriterOptions);
  writeData(data: T): Promise<void>;
}

export interface ContinuousWriterOptions {
  parallelOps?: number;
  skipOnError?: boolean;
  timeoutMillis?: number;
}

export class ContinuousTransformer<T> extends Transform {
  constructor(opts?: ContinuousTransformerOptions);
  transformData(data: T): Promise<T> | Promise<T[]>;
}

export interface ContinuousTransformerOptions {
  parallelOps?: number;
  skipOnError?: boolean;
  timeoutMillis?: number;
}
