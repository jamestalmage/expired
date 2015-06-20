module.exports = expect;
var assert = require('assert');
var parseDuration = require('duration-parser');


function expect(opts) {

  if(!opts.fetch && 'function' === typeof opts) {
    opts = {fetch: opts};
  }

  var fetch = opts.fetch;
  assert.equal(typeof fetch, 'function', 'fetch should be a function');
  var now = checkDefault('now', 'function', _now);
  var expires = makeExpiryFunction(opts.expires);
  var transform = checkDefault('transform', 'function', _identity);
  var copy = checkDefault('copy', 'function', _identity);
  var buffer = duration('buffer');
  var prefetch = duration('prefetch');
  var retry = duration('retry');

  var currentResult;
  var currentExpiration = Number.NEGATIVE_INFINITY;
  var nextPrefetch;
  var fetching = false;
  var queue = [];

  return function(done) {
    var t = now();
    if(t < currentExpiration) {
      callAsync(done, null, currentResult);
      if(!fetching && (t >= nextPrefetch)) {
        callFetch();
      }
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
      if (err) {
        nextPrefetch += retry;
      } else {
        currentResult = transform(result);
        currentExpiration = expires(result) - buffer;
        nextPrefetch = currentExpiration - prefetch;
        flushQueue(null, result);
      }
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

  function checkDefault(optionName, expectedType, defaultValue){
    var option = opts[optionName] || defaultValue;

    if(expectedType !== typeof option) {
      assert.fail(typeof option, expectedType, 'opts.' + optionName);
    }

    return option;
  }

  function duration(optionName) {
    var opt = opts[optionName];
    if ('string' == typeof  opt) {
      return parseDuration(opt);
    }
    return checkDefault(optionName, 'number', 0);
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

function makeExpiryFunction(expired) {
  if(!expired) {
    return _expiration;
  }

  if('function' === typeof expired) {
    return expired;
  }

  if('string' === typeof expired) {
    return function(obj) {
      return obj[expired];
    };
  }

  throw new Error('opts.expires must be a string or function');
}
