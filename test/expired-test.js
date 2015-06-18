describe('expired', function(){

  var expired = require('..');
  //var Promise = require('bluebird');
  var chai = require('chai');
  var expect = chai.expect;
  var sinon = require('sinon');
  chai.use(require('sinon-chai'));

  var clock, fetch, cbs, cb1, cb2, cb3;

  beforeEach(function(){
    cbs = [];
    fetch = sinon.spy(function fetchSpy(cb){
      cbs.push(cb);
    });
    cb1 = sinon.spy(function cb1Spy(err, result){});
    cb2 = sinon.spy(function cb2Spy(err, result){});
    cb3 = sinon.spy(function cb3Spy(err, result){});
    clock = sinon.useFakeTimers();
  });

  afterEach(function(){
    clock.restore();
  });

  it('will fetch a new resource on the first call', function() {
    var resource = expired(fetch);

    expect(fetch.called).to.equal(false);

    resource();

    expect(fetch.callCount).to.equal(1);
  });

  it('will pass the result to the callback', function() {
    var resource = expired(fetch);

    expect(fetch.called).to.equal(false);
    resource(cb1);
    expect(fetch.called).to.equal(true);
    expect(cb1.called).to.equal(false);

    cbs[0](null, {result:"a", expires: 1000});

    clock.tick();

    expect(cb1).to.have.been.calledWith(null, {result:"a", expires: 1000})
  });

  it('will not re-fetch if before expiration', function() {
    var resource = expired(fetch);

    resource(cb1);

    cbs[0](null, {result:"a", expires: 1000});

    clock.tick(900);

    resource(cb2);

    expect(cb2.called).to.equal(false);

    clock.tick();

    expect(cb1).to.have.been.calledWith(null, {result:"a", expires: 1000});
    expect(cb2).to.have.been.calledWith(null, {result:"a", expires: 1000});

    expect(fetch.callCount).to.equal(1);
  });

  it('will re-fetch after  expiration', function() {
    var resource = expired(fetch);

    resource(cb1);
    cbs[0](null, {result:"a", expires: 1000});

    clock.tick(1001);

    resource(cb2);

    cbs[1](null, {result:"b", expires: 2000});

    expect(cb2.called).to.equal(false);

    clock.tick();

    expect(cb1).to.have.been.calledWith(null, {result:"a", expires: 1000});
    expect(cb2).to.have.been.calledWith(null, {result:"b", expires: 2000});

    expect(fetch.callCount).to.equal(2);
  });

  it('a safety buffer can be specified', function() {
    var resource = expired({
      buffer: 100,
      fetch: fetch
    });

    resource(cb1);

    cbs[0](null, {result:"a", expires: 1000});

    clock.tick(900);

    resource(cb2);

    expect(fetch.callCount).to.equal(2);


    cbs[0](null, {result:"b", expires: 2000});

    expect(cb2.called).to.equal(false);

    clock.tick();

    expect(cb1).to.have.been.calledWith(null, {result:"a", expires: 1000});
    expect(cb2).to.have.been.calledWith(null, {result:"b", expires: 2000});

    expect(fetch.callCount).to.equal(2);
  });

  it('will not fetch while current fetch is pending', function() {
    var resource = expired(fetch);

    resource(cb1);
    resource(cb2);
    expect(fetch.callCount).to.equal(1);
  });

  it('custom expiration property', function() {
    var resource = expired({
      fetch:fetch,
      expires:'notAfter'
    });

    resource(cb1);

    cbs[0](null, {result:'a', notAfter:2000});

    clock.tick(1001);

    resource(cb2);

    expect(fetch.callCount).to.equal(1);

    clock.tick(1001);

    resource(cb3);

    expect(fetch.callCount).to.equal(2);

    cbs[1](null, {result:'b', notAfter:4000});

    clock.tick();

    expect(cb1).to.have.been.calledWith(null, {result:"a", notAfter: 2000});
    expect(cb2).to.have.been.calledWith(null, {result:"a", notAfter: 2000});
    expect(cb3).to.have.been.calledWith(null, {result:"b", notAfter: 4000});
  });

  it('custom expiry function', function() {
    var resource = expired({
      fetch:fetch,
      expires:function(obj) {
        return obj.notAfter * 1000;
      }
    });

    resource(cb1);

    cbs[0](null, {result:'a', notAfter:2});

    clock.tick(1001);

    resource(cb2);

    expect(fetch.callCount).to.equal(1);

    clock.tick(1001);

    resource(cb3);

    expect(fetch.callCount).to.equal(2);

    cbs[1](null, {result:'b', notAfter:4});

    clock.tick();

    expect(cb1).to.have.been.calledWith(null, {result:"a", notAfter: 2});
    expect(cb2).to.have.been.calledWith(null, {result:"a", notAfter: 2});
    expect(cb3).to.have.been.calledWith(null, {result:"b", notAfter: 4});
  });

  it('bad expires option throws', function() {
    expect(function() {
      expired({
        fetch:fetch,
        expires:3
      });
    }).to.throw();
  });
});