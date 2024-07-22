const { Readable } = require('stream');
const delay = require('delay');

class ContinuousReader extends Readable {
  constructor(opts = {}) {
    const {
      chunkSize = 50, // higher => fewer database queries => less real-time
      skipOnError = true,
      waitAfterEmpty = 5000, // wait for new items in database (limit load on database)
      waitAfterLow = 1000, // wait if the chunk size is smaller than requested (limit load on db)
      waitAfterError = 10000, // wait for database to recover from error (limit load on database)
      autoStop = false,
    } = opts;
    super({
      objectMode: true,
      highWaterMark: chunkSize,
    });
    this.skipOnError = skipOnError;
    this.waitAfterEmpty = waitAfterEmpty;
    this.waitAfterLow = waitAfterLow;
    this.waitAfterError = waitAfterError;
    this.autoStop = autoStop;
    this.total = 0; // counter
    this.stopping = false;
    this.stopped = false;
  }

  stop(immediately = false) {
    if (this.stopped) {
      return;
    }
    if (immediately || this.readableLength === 0) { // stop immediately
      this.stopped = true;
      this.push(null); // -> 'end' event -> 'close' event
      return;
    }
    this.stopping = true; // stop later
  }

  // eslint-disable-next-line no-underscore-dangle
  async _read(count) {
    if (this.stopped) {
      return;
    }
    if (this.stopping) {
      this.stopped = true;
      this.push(null); // -> 'end' event -> 'close' event
      return;
    }
    try {
      const startTime = Date.now();
      const items = await this.readData(count);
      const endTime = Date.now();
      this.total += items.length;
      this.emit('debug', {
        items: items.length,
        requested: count,
        total: this.total,
        elapsed: endTime - startTime,
      });
      items.forEach((item) => this.push(item));
      if (items.length < count && this.autoStop) {
        this.stop(true);
        return;
      }
      if (items.length === 0) { // no new items in database
        await delay(this.waitAfterEmpty);
        this.push(); // continue reading !!
      } else if (items.length < count) { // too few items in database
        await delay(this.waitAfterLow);
      }
    } catch (error) {
      if (this.skipOnError) {
        this.emit('skip', { error });
      } else {
        this.destroy(error); // -> 'error' event -> 'close' event
      }
      await delay(this.waitAfterError);
      this.push(); // continue reading !!
    }
  }

  // eslint-disable-next-line no-unused-vars, class-methods-use-this
  async readData(count) {
    throw new Error('method to be implemented or assigned');
  }
}

module.exports = ContinuousReader;
