module.exports = expect;
var assert = require('assert');
var parseDuration = require('duration-parser');
var unpromisify = require('unpromisify');

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

  var currentResult = null;
  var currentExpiration = Number.NEGATIVE_INFINITY;
  var nextPrefetch;
  var alreadyFetching = false;
  var queue = [];

  return function(done) {
    var t = now();
    if(t < currentExpiration) {
      callAsync(done, null, currentResult);
      if(t >= nextPrefetch) {
        callFetch();
      }
    }
    else {
      queue.push(done);
      callFetch();
    }
  };

  function callFetch(){
    if (alreadyFetching) {
      return;
    }
    alreadyFetching = true;

    function handleFetch(err, result) {
      alreadyFetching = false;
      if (!err) {
        try {
          var newResult = transform(result);
          var newExpiration = expires(result) - buffer;
          var newNextPrefetch = newExpiration - prefetch;
          currentResult = newResult;
          currentExpiration = newExpiration;
          nextPrefetch = newNextPrefetch;
        } catch (e) {
          err = new Error(e);
        }
      }
      if (err) {
        if (now() >= currentExpiration) {
          flushQueue(err, null);
        }
        else {
          nextPrefetch += retry;
        }
      } else {
        flushQueue(null, currentResult);
      }
    }

    unpromisify(fetch, handleFetch);
  }

  function flushQueue(err, result) {
    var q = queue;
    queue = [];
    for (var i = 0; i < q.length; i++) {
      callAsync(q[i], err, result);
    }
  }

  function callAsync(cb, err, result) {
    if(!err) {
      try {
        result = copy(result);
      } catch (e) {
        err = new Error(e);
      }
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

function _identity(obj){
  return obj;
}

function makeExpiryFunction(expired) {
  expired = expired || 'expires';

  if('function' === typeof expired) {
    return wrapExpiryFunction(expired);
  }

  if('string' === typeof expired) {
    return wrapExpiryFunction(function(obj) {
      return obj[expired];
    });
  }

  throw new Error('opts.expires must be a string or function');
}

function wrapExpiryFunction(fn) {
  return function(obj) {
    var expiration = fn(obj);
    if (isNaN(expiration)) {
      expiration = new Date(expiration).getTime();
    } else if ('string' === typeof expiration) {
      expiration = parseInt(expiration);
    } else if (expiration instanceof Date) {
      expiration = expiration.getTime();
    }
    return expiration;
  }
}
