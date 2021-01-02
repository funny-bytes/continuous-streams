require('./test-helper');
const { expect } = require('chai');
const { ContinuousReader } = require('../..');

describe('ContinuousReader', () => {
  it('should throw if method is not set specifically', async () => {
    const reader = new ContinuousReader();
    await reader.readData()
      .should.be.rejectedWith('method to be implemented or assigned');
  });

  it('should set default values', () => {
    const reader = new ContinuousReader();
    expect(reader.skipOnError).to.be.equal(true);
    expect(reader.waitAfterEmpty).to.be.equal(5000);
    expect(reader.waitAfterLow).to.be.equal(1000);
    expect(reader.waitAfterError).to.be.equal(10000);
  });

  it('should emit a skip event when readData() rejects', async () => {
    const reader = new ContinuousReader({
      waitAfterError: 0,
    });
    const spy = sinon.spy();
    reader.on('skip', spy);
    reader.readData = async () => {
      throw Error('foo');
    };
    await reader._read(); // eslint-disable-line no-underscore-dangle
    expect(spy).to.have.been.calledOnce;
  });

  it('should emit an error event when readData() rejects', async () => {
    const reader = new ContinuousReader({
      skipOnError: false,
      waitAfterError: 0,
    });
    const spy = sinon.spy();
    reader.on('error', spy);
    reader.readData = async () => {
      throw Error('foo');
    };
    await reader._read(); // eslint-disable-line no-underscore-dangle
    expect(spy).to.have.been.calledOnce;
  });
});
