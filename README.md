# Continuous Streams

Stream classes with specific behavior:

* continuous reading, i.e., it doesn't stop if there is temporarily no data available
* configurable chunk size to read
* specific error handling (error vs. skip/retry)
* configurable parallel processing
* timeouts
* graceful shutdown after `SIGTERM` or `SIGINT`

![main workflow](https://github.com/funny-bytes/continuous-streams/actions/workflows/main.yml/badge.svg)
[![Coverage Status](https://coveralls.io/repos/github/funny-bytes/continuous-streams/badge.svg?branch=main)](https://coveralls.io/github/funny-bytes/continuous-streams?branch=main)
[![Maintainability](https://api.codeclimate.com/v1/badges/d0f823493c0977615c21/maintainability)](https://codeclimate.com/github/funny-bytes/continuous-streams/maintainability)
[![node](https://img.shields.io/node/v/continuous-streams.svg)](https://nodejs.org)
[![code style](https://img.shields.io/badge/code_style-airbnb-brightgreen.svg)](https://github.com/airbnb/javascript)
[![Types](https://img.shields.io/npm/types/continuous-streams.svg)](https://www.npmjs.com/package/continuous-streams)
[![License Status](http://img.shields.io/npm/l/continuous-streams.svg)]()

## Install

```bash
npm install continuous-streams
```

## Usage

This is a basic example (ES6/ES2015).

```javascript
const { pipeline } = require('stream');
const { ContinuousReader, ContinuousWriter } = require('continuous-streams');

const reader = new ContinuousReader({
  chunkSize: 100, // default `50`
});
reader.readData = async (count) => {
  // read `count` items from resource
  // if rejects, a `skip` event is emitted (unless `skipOnError` is `false`)
  return items; // resolve with array of data items (can be empty)
};

const writer = new ContinuousWriter({
  parallelOps: 10, // max number of `writeData()` to fire off in parallel
});
writer.writeData = async (item) => {
  // process a single data item
  // if rejects, a `skip` event is emitted (unless `skipOnError` is `false`)
};

pipeline( // go!
  reader,
  writer,
  (error) => { ... }, // pipeline stopped
);

['SIGTERM', 'SIGINT'].forEach((eventType) => {
  process.on(eventType, () => reader.stop());
});
```

Or if you prefer **TypeScript** (types included):

```typescript
import { pipeline } from "stream";
import { ContinuousReader, ContinuousWriter } from "continuous-streams";

const reader = new ContinuousReader<Foo>();
reader.readData = async (count: number): Promise<Foo[]> => {
  // ...
  return items;
}

const writer = new ContinuousWriter<Foo>();
writer.writeData = async (item: Foo): Promise<void> => {
  // ...
}

// ...
```

For this module to work, your **TypeScript compiler options** must include
`"target": "ES2015"` (or later), `"moduleResolution": "node"`, and
`"esModuleInterop": true`.

## Stream Classes

### Class `ContinuousReader`

Extends `stream.Readable`.
It reads from an underlying data source (`objectMode` only) -- please implement or assign `readData()` for that purpose.
It does not `end` when the underlying data source is (temporarily) empty but waits for new data to arrive.
It is robust/reluctant regarding (temporary) reading errors.
It supports gracefully stopping the pipeline.

#### Options

* `chunkSize` - Whenever the number of objects in the internal buffer is dropping below `chunkSize`, a new chunk of data is read from the underlying resource. Higher means fewer polling but less real-time. Default is `50`.
* `skipOnError` - If `true` (default), a `skip` event is emitted when `readData()` rejects. If `false`, an `error` event is emitted when `readData()` rejects and the pipeline will stop. Default is `true`.
* `waitAfterEmpty` - Delay in milliseconds if there is (temporarily) no data available. Default is `5000`.
* `waitAfterLow` - Delay in milliseconds if there is (temporarily) less data available than chunk size. Default is `1000`.
* `waitAfterError` - Delay in milliseconds if there is a (temporary) reading problem. Default is `10000`.

#### Methods

* `async readData(count)` -- Reads `count` data items from the underlying resource. To be implemented or assigned. `count` is usually equals `chunkSize`. It resolves with an array of data items -- which may be empty if there is temporarily no data available. If it rejects, an `error` or `skip` event is emitted (depending on `skipOnError`).
* `stop()` - To be called after `SIGINT` or `SIGTERM` for gracefully stopping the pipeline. The `end` event is emitted either immediately (if the read buffer is empty) or at the next reading attempt. Graceful shutdown means that all data that has been read so far will be fully processed throughout the entire pipeline. Example: `process.on('SIGTERM', () => reader.stop())`.

#### Events

* `skip` - When reading from the underlying resource failed (if `skipOnError` is `true`). The stream continues to read after a delay of `waitAfterError`. Example handler: `reader.on('skip', ({ error }) => { ... })`.
* `error` - When reading from the underlying resource failed (if `skipOnError` is `false`). This will stop the pipeline. Example handler: `reader.on('error', (error) => { ... })`.
* `end` - When `stop()` was called for gracefully stopping the pipeline.
* `close` - When the stream is closed (as usual).
* `debug` - After each successful reading attempt providing some debug information. Example handler: `reader.on('debug', ({ items, requested, total, elapsed }) => { ... })`. `items` is the number of read data items. `requested` is the number of requested data items (normally equals `count`). `total` is an overall counter. `elapsed` is the number of milliseconds of `readData()` to resolve.

### Class `ContinuousWriter`

Extends `stream.Writable`.
It processes data items (`objectMode` only) for some sort of write operation at the end of a pipeline  -- please implement or assign `writeData()` for that purpose.
It is robust/reluctant regarding errors.
If `skipOnError` is `true` (default), an error during a write operation emits a `skip` event and stream processing will continue.
If `skipOnError` is `false`, an error during a write operation emits an `error` event and stream processing will stop.
Supports gracefully stopping the entire pipeline, i.e., it waits until all asynchronous operations in-flight are returned before emitting the `finish` event.

#### Options

* `parallelOps` - The max number of asynchronous `writeData()` operations to fire off in parallel. Default is `10`.
* `skipOnError` - If `true` (default), a `skip` event is emitted when `writeData()` rejects. If `false`, an `error` event is emitted when `writeData()` rejects and the pipeline will stop. Default is `true`.
* `timeoutMillis` - Timeout in milliseconds for `writeData()`. Default is `60000`.

#### Methods

* `async writeData(item)` -- Processes a single data item. To be implemented or assigned. If it rejects, an `error` or `skip` event is emitted (depending on `skipOnError`).

#### Events

* `skip` - If `skipOnError` is `true` (default). Example handler: `writer.on('skip', ({ data, error }) => { ... })`.
* `error` - If `skipOnError` is `false`. This will stop the pipeline.
* `finish` - After graceful shutdown and all asynchronous write operations are returned.
* `close` - After `error` or `finish` (as usual).
* `debug` - After each successful write operation providing some debug information. Example handler: `writer.on('debug', ({ inflight, total, elapsed }) => { ... })`. `inflight` is the number of asynchronous `writeData()` operations currently inflight. `total` is an overall counter. `elapsed` is the number of milliseconds of `writeData()` to resolve.

### Class `ContinuousTransformer`

Extends `stream.Transform`.
It processes data items (`objectMode` only) for some sort of transform operation in the midst of a pipeline  -- please implement or assign `transformData()` for that purpose.
It is robust/reluctant regarding errors.
If `skipOnError` is `true` (default), an error during a transform operation emits a `skip` event and stream processing will continue.
If `skipOnError` is `false`, an error during a transform operation emits an `error` event and stream processing will stop.

#### Options

* `parallelOps` - The max number of asynchronous `transformData()` operations to fire off in parallel. Default is `10`.
* `skipOnError` - If `true` (default), a `skip` event is emitted when `transformData()` rejects. If `false`, an `error` event is emitted when `transformData()` rejects and the pipeline will stop. Default is `true`.
* `timeoutMillis` - Timeout in milliseconds for `transformData()`. Default is `60000`.

#### Methods

* `async transformData(item)` -- Processes a single data item. Resolves with the transformed data item (or an array of items for splitting the item into multiple items). To be implemented or assigned. If it rejects, an `error` or `skip` event is emitted (depending on `skipOnError`).

#### Events

* `skip` - If `skipOnError` is `true` (default). Example handler: `transformer.on('skip', ({ data, error }) => { ... })`.
* `error` - If `skipOnError` is `false`. This will stop the pipeline.
* `close` - When the stream is closed (as usual).
* `debug` - After each successful transform operation providing some debug information. Example handler: `transformer.on('debug', ({ inflight, total, elapsed }) => { ... })`. `inflight` is the number of asynchronous `transformData()` operations currently inflight. `total` is an overall counter. `elapsed` is the number of milliseconds of `transformData()` to resolve.
