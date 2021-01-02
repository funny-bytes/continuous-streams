require('./test-helper');
const delay = require('delay');
const { ContinuousWriter } = require('../..');

describe('ContinuousWriter', () => {
  it('should throw if method is not set specifically', async () => {
    const writer = new ContinuousWriter();
    await writer.writeData()
      .should.be.rejectedWith('method to be implemented or assigned');
  });

  it('should set default values', () => {
    const writer = new ContinuousWriter();
    expect(writer.skipOnError).to.be.equal(true);
    expect(writer.timeoutMillis).to.be.equal(60000);
    expect(writer.flightController.limit).to.be.equal(10);
  });

  it('should emit a skip event when writeData() rejects', async () => {
    const writer = new ContinuousWriter();
    const spy = sinon.spy();
    writer.on('skip', spy);
    writer.writeData = async () => {
      throw Error('foo');
    };
    await writer._write({}, null, () => {}); // eslint-disable-line no-underscore-dangle
    expect(spy).to.have.been.calledOnce;
  });

  it('should emit an error event when writeData() rejects', async () => {
    const writer = new ContinuousWriter({
      skipOnError: false,
    });
    const spy = sinon.spy();
    writer.on('error', spy);
    writer.writeData = async () => {
      throw Error('foo');
    };
    await writer._write({}, null, () => {}); // eslint-disable-line no-underscore-dangle
    await delay(100);
    expect(spy).to.have.been.calledOnce;
  });
});
