require('./test-helper');
const delay = require('delay');
const { ContinuousTransformer } = require('../..');

describe('ContinuousTransformer', () => {
  it('should throw if method is not set specifically', async () => {
    const transformer = new ContinuousTransformer();
    await transformer.transformData()
      .should.be.rejectedWith('method to be implemented or assigned');
  });

  it('should set default values', () => {
    const transformer = new ContinuousTransformer();
    expect(transformer.skipOnError).to.be.equal(true);
    expect(transformer.timeoutMillis).to.be.equal(60000);
    expect(transformer.flightController.limit).to.be.equal(10);
  });

  it('should emit a skip event when transformData() rejects', async () => {
    const transformer = new ContinuousTransformer();
    const spy = sinon.spy();
    transformer.on('skip', spy);
    transformer.transformData = async () => {
      throw Error('foo');
    };
    await transformer._transform({}, null, () => {}); // eslint-disable-line no-underscore-dangle
    expect(spy).to.have.been.calledOnce;
  });

  it('should emit an error event when transformData() rejects', async () => {
    const transformer = new ContinuousTransformer({
      skipOnError: false,
    });
    const spy = sinon.spy();
    transformer.on('error', spy);
    transformer.transformData = async () => {
      throw Error('foo');
    };
    await transformer._transform({}, null, () => {}); // eslint-disable-line no-underscore-dangle
    await delay(100);
    expect(spy).to.have.been.calledOnce;
  });
});
