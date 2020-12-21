const EventEmitter = require('events');

/**
 * Helper class for stream.Writable to allow parallel processing.
 */
class FlightController extends EventEmitter {
  constructor(opts = {}) {
    const { limit = 10 } = opts;
    super();
    this.inflight = 0;
    this.limit = limit;
    this.callbacks = [];
  }

  up(callback) {
    this.inflight += 1;
    if (this.inflight < this.limit) {
      callback(); // call for more immediately
    } else {
      this.callbacks.push(callback); // later
    }
  }

  down() {
    this.inflight -= 1;
    const callback = this.callbacks.pop();
    if (callback) {
      callback(); // call for more
    }
    if (this.isGrounded()) {
      this.emit('grounded');
    }
  }

  getInflight() {
    return this.inflight;
  }

  isGrounded() {
    return this.inflight === 0;
  }
}

module.exports = FlightController;
