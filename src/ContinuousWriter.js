const { Writable } = require('stream');
const { timeout } = require('promise-timeout');
const FlightController = require('./FlightController');

class ContinuousWriter extends Writable {
  constructor(opts = {}) {
    const {
      parallelOps = 10,
      skipOnError = true,
      timeoutMillis = 60000,
    } = opts;
    super({
      objectMode: true,
      highWaterMark: parallelOps,
    });
    this.skipOnError = skipOnError;
    this.timeoutMillis = timeoutMillis;
    this.flightController = new FlightController({ limit: parallelOps });
    this.total = 0; // counter
  }

  // eslint-disable-next-line no-underscore-dangle, consistent-return
  async _write(data, encoding, callback) {
    if (!data) { // no data
      return callback();
    }
    this.flightController.up(callback);
    try {
      const startTime = Date.now();
      await timeout(
        this.writeData(data), this.timeoutMillis,
      );
      const endTime = Date.now();
      this.total += 1;
      this.emit('debug', {
        inflight: this.flightController.getInflight(),
        total: this.total,
        elapsed: endTime - startTime,
      });
    } catch (error) {
      if (this.skipOnError) {
        this.emit('skip', { data, error });
      } else {
        this.destroy(error); // -> 'error' event -> 'close' event
      }
    } finally {
      this.flightController.down();
    }
  }

  // eslint-disable-next-line no-underscore-dangle, consistent-return
  _final(callback) {
    // Called before the stream closes, delaying the 'finish' event.
    // The Writables's write buffer is already drained at this point.
    // Ensure async operations still in-flight are finishing...
    if (this.flightController.isGrounded()) {
      return callback();
    }
    this.flightController.once('grounded', () => {
      callback();
    });
  }

  // eslint-disable-next-line no-unused-vars, class-methods-use-this
  async writeData(data) {
    throw new Error('method to be implemented or assigned');
  }
}

module.exports = ContinuousWriter;
