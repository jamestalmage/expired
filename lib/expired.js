module.exports = expect;

function expect(opts) {

  if(!opts.fetch && 'function' === typeof opts) {
    opts = {fetch: opts};
  }

  var fetch = opts.fetch;
  var now = opts.now || _now;
  var buffer = opts.buffer || 0;


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
        fetching = true;
        fetch(function(err, result){
          fetching = false;
          currentResult = result;
          currentExpiration = result.expires - buffer;
          flushQueue(err, result);
        });
      }
    }
  };

  function flushQueue(err, result) {
    var q = queue;
    queue = [];
    for (var i = 0; i < q.length; i++) {
      callAsync(q[i], err, result);
    }
  }

  function callAsync(cb, err, result) {
    setTimeout(function(){
      cb(err, result);
    });
  }
}

function _now() {
  return new Date().getTime();
}
