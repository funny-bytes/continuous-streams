/* eslint-disable arrow-body-style */
require('./test-helper');
const { expect } = require('chai');
const delay = require('delay');
const { pipeline } = require('stream');
const { ContinuousReader, ContinuousWriter, ContinuousTransformer } = require('../..');

// eslint-disable-next-line no-promise-executor-return
const wait = async (millis = 1000) => new Promise((resolve) => setTimeout(resolve, millis));

describe('Continuous pipeline', () => {
  const createDataArray = async (count) => {
    const chunk = `${Date.now()}`;
    const result = Array
      .from(new Array(count).keys())
      .map((idx) => ({ idx, name: `row-${chunk}-${idx}` }));
    return result;
  };

  it('should stream continuously reader->writer', async () => {
    return new Promise((resolve) => {
      const end = sinon.spy();
      const finish = sinon.spy();
      let counter = 0;
      const reader = new ContinuousReader();
      reader.readData = async (count) => createDataArray(count);
      reader.on('end', end);
      const writer = new ContinuousWriter();
      writer.writeData = async () => {
        counter += 1;
        if (counter === 1000) reader.stop();
      };
      writer.on('finish', finish);
      pipeline(
        reader,
        writer,
        (error) => {
          expect(counter).to.be.at.least(1000);
          expect(end).to.have.been.calledOnce;
          expect(finish).to.have.been.calledOnce;
          expect(error).to.be.undefined;
          resolve();
        },
      );
    });
  });

  it('should stream continuously reader->transformer->writer', async () => {
    return new Promise((resolve) => {
      const end = sinon.spy();
      const finish = sinon.spy();
      let counter = 0;
      const reader = new ContinuousReader();
      reader.readData = async (count) => createDataArray(count);
      reader.on('end', end);
      const transformer = new ContinuousTransformer();
      transformer.transformData = async (data) => data;
      const writer = new ContinuousWriter();
      writer.writeData = async () => {
        counter += 1;
        if (counter === 1000) reader.stop();
      };
      writer.on('finish', finish);
      pipeline(
        reader,
        transformer,
        writer,
        (error) => {
          expect(counter).to.be.at.least(1000);
          expect(end).to.have.been.calledOnce;
          expect(finish).to.have.been.calledOnce;
          expect(error).to.be.undefined;
          resolve();
        },
      );
    });
  });

  it('should pass data reader->transformer->transformer->writer', async () => {
    return new Promise((resolve) => {
      const collection = [];
      const reader = new ContinuousReader();
      reader.readData = async (count) => createDataArray(count);
      const transformer1 = new ContinuousTransformer();
      transformer1.transformData = async (data) => ({ ...data, foo: true });
      const transformer2 = new ContinuousTransformer();
      transformer2.transformData = async (data) => ({ ...data, bar: true });
      const writer = new ContinuousWriter();
      writer.writeData = async (data) => {
        collection.push(data);
        if (collection.length === 1000) reader.stop();
      };
      pipeline(
        reader,
        transformer1,
        transformer2,
        writer,
        (error) => {
          expect(collection.length).to.be.at.least(1000);
          expect(error).to.be.undefined;
          collection.forEach((data) => {
            expect(data).to.have.property('foo', true);
            expect(data).to.have.property('bar', true);
          });
          resolve();
        },
      );
    });
  });

  it('should support specific chunk sizes by reader', async () => {
    return new Promise((resolve, reject) => {
      const collection = [];
      let counter = 0;
      const reader = new ContinuousReader({
        chunkSize: 44,
      });
      reader.readData = async (count) => {
        collection.push(count);
        return createDataArray(count);
      };
      const writer = new ContinuousWriter();
      writer.writeData = async () => {
        counter += 1;
        if (counter === 1000) reader.stop();
      };
      writer.once('finish', () => {
        try {
          expect(collection.length).to.be.greaterThan(0);
          collection.forEach((count) => {
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

  it('should work if reader temporarily provides no data reader->writer', async () => {
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
      pipeline(
        reader,
        writer,
        (error) => {
          expect(error).to.be.undefined;
          resolve();
        },
      );
    });
  });

  it('should work if reader temporarily provides no data reader->transformer->writer', async () => {
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
      const transformer = new ContinuousTransformer();
      transformer.transformData = async (data) => data;
      const writer = new ContinuousWriter();
      writer.writeData = async () => {
        counter += 1;
        if (counter === 1000) reader.stop();
      };
      pipeline(
        reader,
        transformer,
        writer,
        (error) => {
          expect(error).to.be.undefined;
          resolve();
        },
      );
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

  it('should fork items by transformer (one to many)', async () => {
    return new Promise((resolve) => {
      let readCounter = 0;
      let writeCounter = 0;
      const reader = new ContinuousReader();
      reader.readData = async (count) => {
        const data = await createDataArray(count);
        readCounter += data.length;
        return data;
      };
      const transformer = new ContinuousTransformer();
      transformer.transformData = async (item) => ([
        { ...item, foo: true },
        { ...item, bar: true },
      ]);
      const writer = new ContinuousWriter();
      writer.writeData = async () => {
        writeCounter += 1;
        if (writeCounter === 1000) reader.stop();
      };
      pipeline(
        reader,
        transformer,
        writer,
        (error) => {
          expect(error).to.be.undefined;
          expect(writeCounter).to.be.equal(readCounter * 2);
          resolve();
        },
      );
    });
  });

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

  it('should terminate gracefully when reader buffer is empty', async () => {
    return new Promise((resolve) => {
      const reader = new ContinuousReader();
      reader.readData = async () => {
        await wait(200);
        return []; // never any data
      };
      const writer = new ContinuousWriter();
      writer.writeData = async () => {
        await wait(200);
      };
      writer.on('finish', () => {
        resolve();
      });
      reader.pipe(writer);
      setTimeout(() => {
        reader.stop();
      }, 1000);
    });
  });

  it('should terminate gracefully when reader data is low and autoStop=true', async () => {
    const data = ['a', 'b', 'c'];
    let readerIndex = 0;
    return new Promise((resolve) => {
      const reader = new ContinuousReader({ chunkSize: 2, autoStop: true });
      reader.readData = async (count) => {
        await wait(100);
        const chunk = data.slice(readerIndex, readerIndex + count);
        readerIndex += chunk.length;
        return chunk;
      };
      const writerSpy = sinon.spy();
      const writer = new ContinuousWriter();
      writer.writeData = async (d) => {
        await wait(100);
        writerSpy(d);
      };
      writer.once('finish', () => {
        expect(writerSpy).to.have.been.calledThrice;
        resolve();
      });
      reader.pipe(writer);
    });
  });

  it('should terminate gracefully when reader data is empty and autoStop=true', async () => {
    const data = ['a', 'b', 'c', 'd'];
    let readerIndex = 0;
    return new Promise((resolve) => {
      const reader = new ContinuousReader({ chunkSize: 2, autoStop: true });
      reader.readData = async (count) => {
        await wait(100);
        const chunk = data.slice(readerIndex, readerIndex + count);
        readerIndex += chunk.length;
        return chunk;
      };
      const writerSpy = sinon.spy();
      const writer = new ContinuousWriter();
      writer.writeData = async (d) => {
        await wait(100);
        writerSpy(d);
      };
      writer.once('finish', () => {
        expect(writerSpy.callCount).to.be.equals(4);
        resolve();
      });
      reader.pipe(writer);
    });
  });
});
