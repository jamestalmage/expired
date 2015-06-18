# unexpired                          

Simple API for keeping your expiring resources fresh! 

[![Build Status](https://travis-ci.org/jamestalmage/expired.svg?branch=master)](https://travis-ci.org/jamestalmage/expired)
[![Coverage Status](https://coveralls.io/repos/jamestalmage/expired/badge.svg?branch=master)](https://coveralls.io/r/jamestalmage/expired?branch=master)
[![Code Climate](https://codeclimate.com/github/jamestalmage/expired/badges/gpa.svg)](https://codeclimate.com/github/jamestalmage/expired)
[![Dependency Status](https://david-dm.org/jamestalmage/expired.svg)](https://david-dm.org/jamestalmage/expired)
[![devDependency Status](https://david-dm.org/jamestalmage/expired/dev-status.svg)](https://david-dm.org/jamestalmage/expired#info=devDependencies)

[![NPM](https://nodei.co/npm/unexpired.png)](https://www.npmjs.com/package/unexpired/)

## usage

Set up an expiring resource by providing a `fetch` function.

```javascript
  var unexpired = require('unexpired');
  
  var freshCertificate = unexpired(function fetch(cb){
    // fetch a fresh copy of whatever your resource you are after,
    // then pass the result and expiration to the callback
    cb(null, {
      certId: id,
      key: encryptionKey,
      expires: expiration //in milliseconds sense epoch
    });
  });
```

The generated function will lazily call your `fetch` function as necessary to provide fresh resources.

```javascript
  freshCertificate(function(err, certificate){
     if (err) {
      throw new Error('something went wrong fetching my resource');
     }
     // do something with the resource - it is guaranteed fresh
     console.log('using cert:', certificate.certId );
  });
```

Your `fetch` function may also allowed to return a promise instead of calling the supplied callback.
`unexpired` will check for a `then` method on your return value, and use that.

## options

You can customize the behavior by passing an options object instead.

```javascript
  unexpired({
    fetch: function(cb){/* your fetch function */},
    buffer: 200, // safety buffer in milliseconds,
    now: fn, // alternate method for determining current time
    expires: fn, // alternate method for extracting expiration from fetch result
    transform: fn  // transform the fetch result before passing to callbacks
    copy: fn // create a defensive copy for each callback
  });
```

Only `fetch` is required, everything else is optional.

  * `fetch`: _Function_
  
         The fetch function. 
         It must accept a node style callback (i.e. `cb(err, result)`).
         By default, the callback should be called with an object that has an `expires` property.
         The `expires` property should be an integer, representing the time the resource expires 
         (in milliseconds since epoch).
         
  * `buffer`: _Number_
  
         The safety buffer in milliseconds.
         Forcibly refresh resources a little earlier than necessary.
         This is useful for resources (like authentication tokens) that you want to use over the network. 
         It mitigates problems arising from network latency and slightly off system clocks.

  * `expires`: _Function_ or _String_
  
         Alternate method for extracting the expiration from the fetch result.
         It will be called with the fetch results, and must return a number representing the expiration 
         (in milliseconds since epoch).
         By default, it just returns the `expires` property of the fetch result.
         Possible use would be parsing the `notAfter` result of an `X509` certificate.
         If you provide a string, it will use that named property of the fetch result.

  * `transform`: _Function_
  
         Transform the result before passing to callbacks.
         
  * `copy`: _Function_
  
         Create a defensive copy of the result before passing to each callback.
         
  * `now`: _Function_

         Alternate method of fetching the current time.