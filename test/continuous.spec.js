/* eslint-disable arrow-body-style */
require('./setup');
const delay = require('delay');
const ContinuousReader = require('../src/ContinuousReader');
const ContinuousWriter = require('../src/ContinuousWriter');
const ContinuousTransformer = require('../src/ContinuousTransformer');

describe('Continuous Streaming Pipeline', () => {
  const createDataArray = async (count) => {
    const chunk = `${Date.now()}`;
    const result = Array
      .from(new Array(count).keys())
      .map((idx) => ({ idx, name: `row-${chunk}-${idx}` }));
    return result;
  };

  it('should stream continuously reader->writer', async () => {
    return new Promise((resolve) => {
      const written = [];
      let counter = 0;
      const reader = new ContinuousReader();
      reader.readData = async (count) => {
        return createDataArray(count);
      };
      const writer = new ContinuousWriter();
      writer.writeData = async (data) => {
        written.push(data);
        counter += 1;
        if (counter === 1000) reader.stop();
      };
      writer.once('finish', () => {
        expect(counter).to.be.at.least(1000);
        expect(written[0]).to.have.property('idx', 0);
        resolve();
      });
      reader.pipe(writer);
    });
  });

  it('should stream continuously reader->transformer->writer', async () => {
    return new Promise((resolve) => {
      const written = [];
      let counter = 0;
      const reader = new ContinuousReader();
      reader.readData = async (count) => {
        return createDataArray(count);
      };
      const transformer = new ContinuousTransformer();
      transformer.transformData = async (data) => {
        return { ...data, foo: true }; // simply mirrow for testing
      };
      const writer = new ContinuousWriter();
      writer.writeData = async (data) => {
        written.push(data);
        counter += 1;
        if (counter === 1000) reader.stop();
      };
      writer.once('finish', () => {
        expect(counter).to.be.at.least(1000);
        expect(written[0]).to.have.property('idx', 0);
        expect(written[0]).to.have.property('foo', true);
        resolve();
      });
      reader.pipe(transformer).pipe(writer);
    });
  });

  it('should support specific chunk sizes by reader', async () => {
    const chunksRequested = [];
    return new Promise((resolve, reject) => {
      let counter = 0;
      const reader = new ContinuousReader({
        chunkSize: 44,
      });
      reader.readData = async (count) => {
        chunksRequested.push(count);
        return createDataArray(count);
      };
      const writer = new ContinuousWriter();
      writer.writeData = async () => {
        counter += 1;
        if (counter === 1000) reader.stop();
      };
      writer.once('finish', () => {
        try {
          expect(chunksRequested.length).to.be.greaterThan(0);
          chunksRequested.forEach((count) => {
            expect(count).to.be.equals(44);
          });
          resolve();
        } catch (error) {
          reject(error);
        }
      });
      reader.pipe(writer);
    });
  });

  it('should work if reader temporarily provides less data than requested (chunk size)', () => {
    return new Promise((resolve) => {
      let chunk = 0;
      let counter = 0;
      const reader = new ContinuousReader();
      reader.readData = async (count) => {
        const num = (chunk % 2) ? count : Math.floor(count / 2.0);
        chunk += 1;
        return createDataArray(num);
      };
      const writer = new ContinuousWriter();
      writer.writeData = async () => {
        counter += 1;
        if (counter === 1000) reader.stop();
      };
      writer.once('finish', () => {
        resolve();
      });
      reader.pipe(writer);
    });
  });

  it('should work if reader temporarily provides no data', async () => {
    return new Promise((resolve) => {
      let chunk = 0;
      let counter = 0;
      const reader = new ContinuousReader({
        waitAfterEmpty: 0,
      });
      reader.readData = async (count) => {
        const num = (chunk % 2) ? count : 0;
        chunk += 1;
        return createDataArray(num);
      };
      const writer = new ContinuousWriter();
      writer.writeData = async () => {
        counter += 1;
        if (counter === 1000) reader.stop();
      };
      writer.once('finish', () => {
        resolve();
      });
      reader.pipe(writer);
    });
  });

  it('should wait after empty read (waitAfterEmpty)', () => {
    return new Promise((resolve) => {
      const startTime = Date.now();
      let once = false;
      let counter = 0;
      const reader = new ContinuousReader({
        waitAfterEmpty: 1000,
      });
      reader.readData = async (count) => {
        if (!once) {
          once = true;
          return [];
        }
        return createDataArray(count);
      };
      const writer = new ContinuousWriter();
      writer.writeData = async () => {
        counter += 1;
        if (counter === 1000) reader.stop();
      };
      writer.once('finish', () => {
        const endTime = Date.now();
        expect(endTime - startTime).to.be.at.least(1000);
        resolve();
      });
      reader.pipe(writer);
    });
  });

  it('should wait after read error (waitAfterError)', () => {
    return new Promise((resolve) => {
      const startTime = Date.now();
      let once = false;
      let counter = 0;
      const reader = new ContinuousReader({
        waitAfterError: 1000,
      });
      reader.readData = async (count) => {
        if (!once) {
          once = true;
          throw new Error('foo');
        }
        return createDataArray(count);
      };
      reader.on('error', () => {});
      const writer = new ContinuousWriter();
      writer.writeData = async () => {
        counter += 1;
        if (counter === 1000) reader.stop();
      };
      writer.once('finish', () => {
        const endTime = Date.now();
        expect(endTime - startTime).to.be.at.least(1000);
        resolve();
      });
      reader.pipe(writer);
    });
  });

  it('should support parallel processing of writer', async () => {
    return new Promise((resolve, reject) => {
      const inflights = [];
      let counter = 0;
      const reader = new ContinuousReader();
      reader.readData = async (count) => {
        return createDataArray(count);
      };
      const writer = new ContinuousWriter({
        parallelOps: 10,
      });
      writer.writeData = async () => {
        await delay.range(10, 20);
        counter += 1;
        if (counter === 1000) reader.stop();
      };
      writer.on('debug', ({ inflight }) => inflights.push(inflight));
      writer.once('finish', () => {
        try {
          expect(inflights.length).to.be.greaterThan(0);
          expect(inflights.includes(10)).to.be.true;
          inflights.forEach((inflight) => {
            expect(inflight).to.be.at.most(10);
          });
          resolve();
        } catch (error) {
          reject(error);
        }
      });
      reader.pipe(writer);
    });
  });

  it('should support parallel processing of transformer', async () => {
    return new Promise((resolve, reject) => {
      const inflights = [];
      let counter = 0;
      const reader = new ContinuousReader();
      reader.readData = async (count) => {
        return createDataArray(count);
      };
      const transformer = new ContinuousTransformer({
        parallelOps: 10,
      });
      transformer.transformData = async (data) => {
        await delay.range(10, 20);
        return data; // simply pass through
      };
      transformer.on('debug', ({ inflight }) => inflights.push(inflight));
      const writer = new ContinuousWriter({
        parallelOps: 10,
      });
      writer.writeData = async () => {
        await delay.range(10, 20);
        counter += 1;
        if (counter === 1000) reader.stop();
      };
      writer.once('finish', () => {
        try {
          expect(inflights.length).to.be.greaterThan(0);
          expect(inflights.includes(10)).to.be.true;
          inflights.forEach((inflight) => {
            expect(inflight).to.be.at.most(10);
          });
          resolve();
        } catch (error) {
          reject(error);
        }
      });
      reader.pipe(transformer).pipe(writer);
    });
  });

  it('should support sequencial processing of writer', async () => {
    return new Promise((resolve, reject) => {
      const inflights = [];
      let counter = 0;
      const reader = new ContinuousReader();
      reader.readData = async (count) => {
        return createDataArray(count);
      };
      const writer = new ContinuousWriter({
        parallelOps: 1,
      });
      writer.writeData = async () => {
        counter += 1;
        if (counter === 1000) reader.stop();
      };
      writer.on('debug', ({ inflight }) => inflights.push(inflight));
      writer.once('finish', () => {
        try {
          expect(inflights.length).to.be.greaterThan(0);
          expect(inflights.includes(1)).to.be.true;
          inflights.forEach((inflight) => {
            expect(inflight).to.be.at.most(1);
          });
          resolve();
        } catch (error) {
          reject(error);
        }
      });
      reader.pipe(writer);
    });
  });

  it('should support sequencial processing of transformer', () => {
    return new Promise((resolve, reject) => {
      const inflights = [];
      let counter = 0;
      const reader = new ContinuousReader();
      reader.readData = async (count) => {
        return createDataArray(count);
      };
      const transformer = new ContinuousTransformer({
        parallelOps: 1,
      });
      transformer.transformData = async (data) => {
        return data; // simply pass through
      };
      transformer.on('debug', ({ inflight }) => inflights.push(inflight));
      const writer = new ContinuousWriter({
        parallelOps: 1,
      });
      writer.writeData = async () => {
        counter += 1;
        if (counter === 1000) reader.stop();
      };
      writer.once('finish', () => {
        try {
          expect(inflights.length).to.be.greaterThan(0);
          expect(inflights.includes(1)).to.be.true;
          inflights.forEach((inflight) => {
            expect(inflight).to.be.at.most(1);
          });
          resolve();
        } catch (error) {
          reject(error);
        }
      });
      reader.pipe(transformer).pipe(writer);
    });
  });

  it('should tolerate read error and send "skip" event', async () => {
    return new Promise((resolve, reject) => {
      let counter = 0;
      let readError;
      const reader = new ContinuousReader({
        waitAfterError: 0,
      });
      reader.readData = async (count) => {
        if (!readError) throw new Error('foo');
        return createDataArray(count);
      };
      reader.on('skip', ({ error }) => {
        readError = error;
      });
      const writer = new ContinuousWriter();
      writer.writeData = async () => {
        counter += 1;
        if (counter === 1000) reader.stop();
      };
      writer.once('finish', () => {
        try {
          expect(readError).to.not.be.undefined;
          expect(readError.message).to.be.equals('foo');
          expect(counter).to.be.at.least(1000);
          resolve();
        } catch (error) {
          reject(error);
        }
      });
      reader.pipe(writer);
    });
  });

  it('should tolerate write error and emit "skip" event (skipOnError)', async () => {
    return new Promise((resolve, reject) => {
      let counter = 0;
      let writeError;
      const reader = new ContinuousReader();
      reader.readData = async (count) => {
        return createDataArray(count);
      };
      const writer = new ContinuousWriter();
      writer.writeData = async () => {
        if (!writeError) throw new Error('foo');
        counter += 1;
        if (counter === 1000) reader.stop();
      };
      writer.on('skip', ({ error }) => {
        writeError = error;
      });
      writer.once('finish', () => {
        try {
          expect(writeError).to.not.be.undefined;
          expect(writeError.message).to.be.equals('foo');
          expect(counter).to.be.at.least(1000);
          resolve();
        } catch (error) {
          reject(error);
        }
      });
      reader.pipe(writer);
    });
  });

  it('should tolerate transform error and emit "skip" event (skipOnError)', async () => {
    return new Promise((resolve, reject) => {
      let counter = 0;
      let transformError;
      const reader = new ContinuousReader();
      reader.readData = async (count) => {
        return createDataArray(count);
      };
      const transformer = new ContinuousTransformer();
      transformer.transformData = async (data) => {
        if (!transformError) throw new Error('foo');
        return data; // pass through
      };
      transformer.on('skip', ({ error }) => {
        transformError = error;
      });
      const writer = new ContinuousWriter();
      writer.writeData = async () => {
        counter += 1;
        if (counter === 1000) reader.stop();
      };
      writer.once('finish', () => {
        try {
          expect(transformError).to.not.be.undefined;
          expect(transformError.message).to.be.equals('foo');
          expect(counter).to.be.at.least(1000);
          resolve();
        } catch (error) {
          reject(error);
        }
      });
      reader.pipe(transformer).pipe(writer);
    });
  });

  it('should fork items by transformer (one to many)');

  it('should terminate on write error', async () => {
    return new Promise((resolve, reject) => {
      let writeError;
      const reader = new ContinuousReader();
      reader.readData = async (count) => {
        return createDataArray(count);
      };
      const writer = new ContinuousWriter({
        skipOnError: false,
      });
      writer.writeData = async () => {
        throw new Error('foo');
      };
      writer.on('error', (error) => {
        writeError = error;
      });
      writer.once('close', () => {
        try {
          expect(writeError).to.not.be.undefined;
          expect(writeError.message).to.be.equals('foo');
          resolve();
        } catch (error) {
          reject(error);
        }
      });
      reader.pipe(writer);
    });
  });

  it('should terminate on transformer error', async () => {
    return new Promise((resolve, reject) => {
      let transformError;
      const reader = new ContinuousReader();
      reader.readData = async (count) => {
        return createDataArray(count);
      };
      const transformer = new ContinuousTransformer({
        skipOnError: false,
      });
      transformer.transformData = async () => {
        throw new Error('foo');
      };
      transformer.on('error', (error) => {
        transformError = error;
      });
      const writer = new ContinuousWriter();
      writer.writeData = async () => {
        // not necessary to do anything here
      };
      transformer.once('close', () => {
        try {
          expect(transformError).to.not.be.undefined;
          expect(transformError.message).to.be.equals('foo');
          resolve();
        } catch (error) {
          reject(error);
        }
      });
      reader.pipe(transformer).pipe(writer);
    });
  });

  it('should support timeout on writer', async () => {
    return new Promise((resolve, reject) => {
      let writeError;
      const reader = new ContinuousReader();
      reader.readData = async (count) => {
        return createDataArray(count);
      };
      const writer = new ContinuousWriter({
        skipOnError: false,
        timeoutMillis: 1000,
      });
      writer.writeData = async () => {
        await delay(99999);
      };
      writer.on('error', (error) => {
        writeError = error;
      });
      writer.once('close', () => {
        try {
          expect(writeError).to.not.be.undefined;
          expect(writeError.name).to.be.equals('TimeoutError');
          resolve();
        } catch (error) {
          reject(error);
        }
      });
      reader.pipe(writer);
    });
  });

  it('should support timeout on transformer', async () => {
    return new Promise((resolve, reject) => {
      let transformError;
      const reader = new ContinuousReader();
      reader.readData = async (count) => {
        return createDataArray(count);
      };
      const transformer = new ContinuousTransformer({
        skipOnError: false,
        timeoutMillis: 1000,
      });
      transformer.transformData = async (data) => {
        await delay(99999);
        return data; // simply pass through
      };
      transformer.on('error', (error) => {
        transformError = error;
      });
      const writer = new ContinuousWriter();
      writer.writeData = async () => {
        // not necessary to do anything here
      };
      transformer.once('close', () => {
        try {
          expect(transformError).to.not.be.undefined;
          expect(transformError.name).to.be.equals('TimeoutError');
          resolve();
        } catch (error) {
          reject(error);
        }
      });
      reader.pipe(transformer).pipe(writer);
    });
  });

  it('should terminate gracefully reader->writer', async () => {
    return new Promise((resolve) => {
      let readCounter = 0;
      let writeCounter = 0;
      const reader = new ContinuousReader({
        chunkSize: 100,
      });
      reader.readData = async (count) => {
        const data = await createDataArray(count);
        readCounter += data.length;
        return data;
      };
      const writer = new ContinuousWriter({
        parallelOps: 50,
      });
      writer.writeData = async () => {
        await delay.range(10, 50);
        writeCounter += 1;
        if (writeCounter === 1111) reader.stop();
      };
      writer.once('finish', () => {
        expect(writeCounter).to.be.at.least(1200);
        expect(writeCounter).to.be.equal(readCounter);
        resolve();
      });
      reader.pipe(writer);
    });
  });

  it('should terminate gracefully reader->transformer->writer', async () => {
    return new Promise((resolve) => {
      let readCounter = 0;
      let writeCounter = 0;
      const reader = new ContinuousReader({
        chunkSize: 100,
      });
      reader.readData = async (count) => {
        const data = await createDataArray(count);
        readCounter += data.length;
        return data;
      };
      const transformer = new ContinuousTransformer({
        parallelOps: 50,
      });
      transformer.transformData = async (data) => {
        await delay.range(10, 50);
        return data; // simply pass through
      };
      const writer = new ContinuousWriter({
        parallelOps: 50,
      });
      writer.writeData = async () => {
        await delay.range(10, 50);
        writeCounter += 1;
        if (writeCounter === 1111) reader.stop();
      };
      writer.once('finish', () => {
        expect(writeCounter).to.be.at.least(1200);
        expect(writeCounter).to.be.equal(readCounter);
        resolve();
      });
      reader.pipe(transformer).pipe(writer);
    });
  });
});
