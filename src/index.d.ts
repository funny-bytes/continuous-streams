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

export interface ContinuousReaderEventDebug {
  items: number;
  requested: number;
  total: number;
  elapsed: number;
}

export interface ContinuousReaderEventSkip {
  error: Error;
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

export interface ContinuousWriterEventDebug {
  inflight: number;
  total: number;
  elapsed: number;
}

export interface ContinuousWriterEventSkip<T> {
  error: Error;
  data: T;
}

export class ContinuousTransformer<T, S = T> extends Transform {
  constructor(opts?: ContinuousTransformerOptions);
  transformData(data: T): Promise<S> | Promise<S[]>;
}

export interface ContinuousTransformerOptions {
  parallelOps?: number;
  skipOnError?: boolean;
  timeoutMillis?: number;
}

export type ContinuousTransformerEventDebug = ContinuousWriterEventDebug;

export type ContinuousTransformerEventSkip<T> = ContinuousWriterEventSkip<T>;
