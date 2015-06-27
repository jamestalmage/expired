describe('expired', function(){

  var expired = require('..');
  var Promise = require('bluebird');
  var unpromisify = require('unpromisify');
  var chai = require('chai');
  var expect = chai.expect;
  var sinon = require('sinon');
  chai.use(require('sinon-chai'));

  var clock, oldScheduler, oldScheduler2, fetch, cbs, cb1, cb2, cb3, cb4, error;

  beforeEach(function(){
    cbs = [];
    fetch = sinon.spy(function fetchSpy(cb){
      cbs.push(cb);
    });
    cb1 = sinon.spy(function cb1Spy(err, result){});
    cb2 = sinon.spy(function cb2Spy(err, result){});
    cb3 = sinon.spy(function cb3Spy(err, result){});
    cb4 = sinon.spy(function cb4Spy(err, result){});

    clock = sinon.useFakeTimers();
    oldScheduler = Promise.setScheduler(setTimeout);
    oldScheduler2 = unpromisify.setScheduler(setTimeout);

    error = new Error('blah');
  });

  afterEach(function(){
    Promise.setScheduler(oldScheduler);
    unpromisify.setScheduler(oldScheduler2);
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


    cbs[1](null, {result:"b", expires: 2000});

    expect(cb2.called).to.equal(false);

    clock.tick();

    expect(cb1).to.have.been.calledWith(null, {result:"a", expires: 1000});
    expect(cb2).to.have.been.calledOnce.and.calledWith(null, {result:"b", expires: 2000});

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

  it('can supply custom transform functions', function() {
    var resource = expired({
      fetch:fetch,
      transform: function(obj) {
        return obj.result;
      }
    });

    resource(cb1);

    cbs[0](null, {result:'a', expires:1000});

    clock.tick(1001);

    resource(cb2);

    cbs[1](null, {result:'b', expires:2000});
  });

  it('can create defensive copies', function() {
    var resource = expired({
      fetch: fetch,
      copy: function(obj) {
        return {
          result: obj.result,
          expires: obj.expires
        };
      }
    });

    cb1 = sinon.spy(function cb1Spy(err, result){
      expect(result).to.eql({result:'a', expires:1000});
      result.result = 'modified';
    });

    cb2 = sinon.spy(function cb2Spy(err, result){
      expect(result).to.eql({result:'a', expires:1000});
      result.result = 'modified';
    });

    cb3 = sinon.spy(function cb3Spy(err, result){
      expect(result).to.eql({result:'b', expires:2000});
      result.result = 'modified';
    });

    resource(cb1);

    cbs[0](null, {result:'a', expires:1000});
    clock.tick();
    expect(cb1.called).to.equal(true);

    clock.tick(501);
    resource(cb2);
    clock.tick();
    expect(cb2.called).to.equal(true);

    clock.tick(501);
    resource(cb3);
    cbs[1](null, {result:'b', expires:2000});
    clock.tick();
    expect(cb3.called).to.equal(true);
  });

  it('fetch can return a promise', function() {
    var resolvers = [];
    var resource = expired(function(cb){
      var d = Promise.pending();
      cbs.push(cb);
      resolvers.push(d);
      return d.promise;
    });

    resource(cb1);
    expect(resolvers.length).to.equal(1);
    resolvers[0].resolve({result:'a', expires:1000});
    clock.tick();
    clock.tick();
    expect(cb1).to.have.been.calledOnce.and.calledWith(null, {result:'a', expires:1000});

    clock.tick(500);
    resource(cb2);
    expect(resolvers.length).to.equal(1);
    clock.tick();
    expect(cb2).to.have.been.calledOnce.and.calledWith(null, {result:'a', expires:1000});

    clock.tick(500);
    resource(cb3);
    expect(resolvers.length).to.equal(2);
    resolvers[1].resolve({result:'b', expires:2000});
    clock.tick();
    expect(cb3).to.have.been.calledOnce.and.calledWith(null, {result:'b', expires:2000});
  });

  it('guards against calling the same callback multiple times', function() {
    var resource = expired(fetch);

    resource(cb1);
    cbs[0](null, {result:'a', expires:1000});
    clock.tick(100);
    cbs[0](null, {result:'b', expires:2000});
    clock.tick(100);
    cbs[0](null, {result:'c', expires:3000});
    clock.tick(1000);

    expect(cb1).to.have.been.calledOnce.and.calledWith(null, {result:'a', expires:1000});
  });

  it('custom now function', function() {
    var time = 0;

    var resource = expired({
      fetch: fetch,
      now: function() {
        return time;
      }
    });

    resource(cb1);
    cbs[0](null, {result:'a', expires:1000});
    clock.tick();
    expect(cb1.callCount).to.equal(1);
    time = 500;
    resource(cb2);
    clock.tick();
    expect(cb2.callCount).to.equal(1);
    time = 1000;
    resource(cb3);
    clock.tick();
    expect(cb3.callCount).to.equal(0);
    cbs[1](null, {result:'b', expires:2000});
    clock.tick();
    expect(cb3.callCount).to.equal(1);
  });

  it('prefetch will fetch before expired', function() {
    var resource = expired({
      fetch: fetch,
      prefetch: 300
    });

    resource(cb1);
    cbs[0](null, {result:'a', expires:1000});
    clock.tick();
    expect(cb1.callCount).to.equal(1);
    expect(fetch.callCount).to.equal(1);
    clock.tick(500);
    resource(cb2);
    clock.tick();
    expect(cb2.callCount).to.equal(1);
    expect(fetch.callCount).to.equal(1);
    clock.tick(200);
    resource(cb3);
    clock.tick();
    expect(cb3.callCount).to.equal(1);
    expect(fetch.callCount, 'second fetch called').to.equal(2);
    cbs[1](null, {result:'b', expires:2000});
    clock.tick();
    resource(cb4);
    clock.tick();
    expect(cb4).to.have.been.calledOnce.and.calledWith(null, {result:'b', expires:2000});
  });

  it('prefetch retry on error', function() {
    var resource = expired({
      fetch: fetch,
      prefetch: 500,
      retry:200
    });

    resource(cb1);
    cbs[0](null, {result:'a', expires:1000});
    clock.tick(500);
    resource(cb1);
    expect(fetch.callCount).to.equal(2);
    cbs[1](new Error('could not fetch'), null);
    clock.tick();
    clock.tick(100);
    resource(cb2);
    clock.tick();
    expect(fetch.callCount).to.equal(2); // will not retry until additional 200ms have passed
    expect(cb2).to.have.been.calledOnce.and.calledWith(null, {result:'a', expires:1000});
    clock.tick(100);
    resource(cb3);
    clock.tick();
    expect(cb3).to.have.been.calledOnce.and.calledWith(null, {result:'a', expires:1000});
    expect(fetch.callCount).to.equal(3);
    cbs[2](null, {result:'b', expires:2000});
    clock.tick();
    resource(cb4);
    clock.tick();
    expect(cb4).to.have.been.calledOnce.and.calledWith(null, {result:'b', expires:2000});
  });

  it('pass buffer as string', function() {
    var resource = expired({
      fetch: fetch,
      buffer: '2 seconds'
    });

    resource(cb1);
    cbs[0](null, {result:'a', expires:'6000'});
    clock.tick(3999);
    resource(cb2);
    clock.tick(0);
    expect(fetch.callCount).to.equal(1);
    clock.tick(1);
    resource(cb3);
    expect(fetch.callCount).to.equal(2);
  });

  it('will throw errors for nonsensical values', function() {
    expect(function(){
      expired('hello');
    }).to.throw();

    expect(function(){
      expired({
        fetch:'hello'
      })
    }).to.throw();

    expect(function() {
      expired({
        fetch:fetch,
        now: 3
      })
    }).to.throw();

    expect(function() {
      expired({
        fetch:fetch,
        buffer: 'blah'
      })
    }).to.throw();
  });

  it('an initial error will propagate to the queue', function() {
    var resource = expired(fetch);

    resource(cb1);
    resource(cb2);
    expect(fetch.callCount).to.equal(1);
    cbs[0](error);
    expect(cb1.called, 'errors should be async also').to.equal(false);
    clock.tick();
    expect(cb1).to.have.been.calledOnce.and.calledWith(error);
    expect(cb2).to.have.been.calledOnce.and.calledWith(error);
  });

  it('an error after expiration will propagate to the queue', function() {
    var resource = expired(fetch);

    resource(cb1);
    clock.tick();
    cbs[0](null, {result:'a', expires:100});
    clock.tick(100);
    resource(cb2);
    clock.tick();
    cbs[1](error);
    clock.tick();
    expect(cb2).to.have.been.calledOnce.and.calledWith(error);
  });

  it('expirations as timestamps', function() {
    var resource = expired(fetch);
    resource(cb1);
    clock.tick();
    cbs[0](null, {result:'a', expires:'Thu, 01 Jan 1970 00:00:01 GMT'});
    clock.tick(999);
    resource(cb2);
    clock.tick();
    expect(fetch.callCount).to.equal(1);
    clock.tick(1);
    resource(cb3);
    clock.tick();
    expect(fetch.callCount).to.equal(2);
  });

  it('expirations as Date objects', function() {
    var resource = expired(fetch);
    resource(cb1);
    clock.tick();
    cbs[0](null, {result:'a', expires:new Date(1000)});
    clock.tick(999);
    resource(cb2);
    clock.tick();
    expect(fetch.callCount).to.equal(1);
    clock.tick(1);
    resource(cb3);
    clock.tick();
    expect(fetch.callCount).to.equal(2);
  });

  it('error in copy function is passed to waiting callbacks', function() {
    var error = new Error('myError');
    var copy = sinon.stub();
    copy.throws(error);
    var resource = expired({
      fetch: fetch,
      copy: copy
    });

    resource(cb1);
    clock.tick();
    cbs[0](null, {result:'a', expires:2000});
    expect(cb1.called).to.equal(false);
    clock.tick();
    expect(cb1).to.have.been.calledOnce.and.calledWith(error);
  });

  it('error in transform function is passed to waiting callbacks', function() {
    var error = new Error('myError');
    var copy = sinon.stub();
    copy.throws(error);
    var resource = expired({
      fetch: fetch,
      transform: copy
    });

    resource(cb1);
    clock.tick();
    cbs[0](null, {result:'a', expires:2000});
    expect(cb1.called).to.equal(false);
    clock.tick();
    expect(cb1).to.have.been.calledOnce.and.calledWith(error);
  });
});