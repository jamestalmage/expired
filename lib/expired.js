module.exports = expect;

function expect(opts) {

  if(!opts.fetch && 'function' === typeof opts) {
    opts = {fetch: opts};
  }

  var fetch = opts.fetch;
  var now = opts.now || _now;
  var expires = makeExpiryFunction(opts.expires, opts.buffer);
  var transform = opts.transform || _identity;
  var copy = opts.copy || _identity;

  var currentResult;
  var currentExpiration = Number.NEGATIVE_INFINITY;
  var fetching = false;
  var queue = [];

  return function(done) {
    if(now() < currentExpiration) {
      callAsync(done, null, currentResult);
    }
    else {
      queue.push(done);
      if(!fetching) {
        callFetch();
      }
    }
  };

  function callFetch(){
    fetching = true;
    var fetchComplete = false;

    function handleFetch(err, result) {
      if(fetchComplete) {
        return;
      }
      fetchComplete = true;
      fetching = false;
      currentResult = transform(result);
      currentExpiration = expires(result);
      flushQueue(err, result);
    }

    var maybePromise = fetch(handleFetch);

    if (maybePromise && ('function' === typeof maybePromise.then)) {
      maybePromise.then(function(result){
        handleFetch(null, result);
      }, handleFetch);
    }
  }

  function flushQueue(err, result) {
    var q = queue;
    queue = [];
    for (var i = 0; i < q.length; i++) {
      callAsync(q[i], err, result);
    }
  }

  function callAsync(cb, err, result) {
    if(result) {
      result = copy(result);
    }
    setTimeout(function(){
      cb(err, result);
    });
  }
}

function _now() {
  return new Date().getTime();
}

function _expiration(obj){
  return obj.expires;
}

function _identity(obj){
  return obj;
}

function makeExpiryFunction(expired, buffer) {
  var fn = _makeExpiryFunction(expired);

  if(buffer) {
    return function(obj) {
      return fn(obj) - buffer;
    }
  }

  return fn;
}

function _makeExpiryFunction(expired) {
  if(!expired) return _expiration;

  if('function' === typeof expired) return expired;

  if('string' === typeof expired) return function(obj) {
    return obj[expired];
  };

  throw new Error('opts.expires must be a string or function')
}
