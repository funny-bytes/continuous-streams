require('./setup');
const FlightController = require('../src/FlightController');

describe('services/streams/FlightController', () => {
  it('should not call callback if limit is reached', () => {
    const fc = new FlightController({ limit: 2 });
    const cb1 = sinon.spy();
    const cb2 = sinon.spy();

    expect(fc.getInflight()).to.equal(0);

    fc.up(cb1);
    expect(fc.getInflight()).to.equal(1);
    expect(cb1).to.have.been.calledOnce;

    fc.up(cb2);
    expect(fc.getInflight()).to.equal(2);
    expect(cb2).not.to.have.been.called;

    fc.down();
    expect(fc.getInflight()).to.equal(1);
    expect(cb1).to.have.been.calledOnce;

    fc.down();
    expect(fc.getInflight()).to.equal(0);
    expect(cb2).to.have.been.calledOnce;
  });

  it('should work with limit 1', () => {
    const fc = new FlightController({ limit: 1 });
    const cb = sinon.spy();

    expect(fc.getInflight()).to.equal(0);

    fc.up(cb);
    expect(fc.getInflight()).to.equal(1);
    expect(cb).to.not.have.been.called; // limit is already reached

    fc.down();
    expect(fc.getInflight()).to.equal(0);
    expect(cb).to.have.been.calledOnce; // but now
  });
});
