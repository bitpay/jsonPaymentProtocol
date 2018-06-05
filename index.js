'use strict';
//Native
const crypto = require('crypto');
const query = require('querystring');
const url = require('url');
const util = require('util');

//Modules
const _ = require('lodash');
const request = require('request');
const secp256k1 = require('secp256k1');

function PaymentProtocol(options) {
  this.options = _.merge({
    strictSSL: true
  }, options);
}

/**
 * Makes a request to the given url and returns the raw JSON string retrieved as well as the headers
 * @param paymentUrl {string} the payment protocol specific url
 * @param callback {function} (err, body, headers)
 */
PaymentProtocol.prototype.getRawPaymentRequest = function getRawPaymentRequest(paymentUrl, callback) {
  let paymentUrlObject = url.parse(paymentUrl);

  //Detect 'bitcoin:' urls and extract payment-protocol section
  if (paymentUrlObject.protocol !== 'http:' && paymentUrlObject.protocol !== 'https:') {
    let uriQuery = query.decode(paymentUrlObject.query);
    if (!uriQuery.r) {
      return callback(new Error('Invalid payment protocol url'));
    }
    else {
      paymentUrl = uriQuery.r;
    }
  }

  let requestOptions = _.merge(this.options, {
    url: paymentUrl,
    headers: {
      'Accept': 'application/payment-request'
    }
  });

  request.get(requestOptions, (err, response) => {
    if (err) {
      return callback(err);
    }
    if (response.statusCode !== 200) {
      return callback(new Error(response.body.toString()));
    }

    return callback(null, {rawBody: response.body, headers: response.headers, requestUrl: paymentUrl});
  });
};

/**
 * Makes a request to the given url and returns the raw JSON string retrieved as well as the headers
 * @param url {string} the payment protocol specific url (https)
 */
PaymentProtocol.prototype.getRawPaymentRequestAsync = util.promisify(PaymentProtocol.prototype.getRawPaymentRequest);

/**
 * Given a raw payment protocol body, parses it and validates it against the digest header
 * @param rawBody {string} Raw JSON string retrieved from the payment protocol server
 * @param headers {object} Headers sent by the payment protocol server
 * @param callback {function} (err, paymentRequest)
 */
PaymentProtocol.prototype.parsePaymentRequest = function parsePaymentRequest(rawBody, headers, callback) {
  let paymentRequest;

  if (!rawBody) {
    return callback(new Error('Parameter rawBody is required'));
  }
  if (!headers) {
    return callback(new Error('Parameter headers is required'));
  }

  try {
    paymentRequest = JSON.parse(rawBody);
  }
  catch (e) {
    return callback(new Error(`Unable to parse request - ${e}`));
  }

  if (!headers.digest) {
    return callback(new Error('Digest missing from response headers'));
  }

  let digest = headers.digest.split('=')[1];
  let hash = crypto.createHash('sha256').update(rawBody, 'utf8').digest('hex');

  if (digest !== hash) {
    return callback(new Error(`Response body hash does not match digest header. Actual: ${hash} Expected: ${digest}`));
  }

  paymentRequest.hash = hash;
  paymentRequest.headers = headers;

  return callback(null, paymentRequest);
};

/**
 * Given a raw payment protocol body, parses it and validates it against the digest header
 * @param rawBody {string} Raw JSON string retrieved from the payment protocol server
 * @param headers {object} Headers sent by the payment protocol server
 */
PaymentProtocol.prototype.parsePaymentRequestAsync = util.promisify(PaymentProtocol.prototype.parsePaymentRequest);

/**
 * Verifies the signature of a given payment request is both valid and from a trusted key
 * @param requestUrl {String} The url used to fetch this payment request
 * @param paymentRequest {Object} The payment request object returned by parsePaymentRequest
 * @param trustedKeys {Object} An object containing all keys trusted by this client
 * @param callback {function} If no error is returned callback will contain the owner of the key which signed this request (ie BitPay Inc.)
 */
PaymentProtocol.prototype.verifyPaymentRequest = function verifyPaymentRequest(requestUrl, paymentRequest, trustedKeys, callback) {
  let hash = paymentRequest.headers.digest.split('=')[1];
  let signature = paymentRequest.headers.signature;
  let signatureType = paymentRequest.headers['x-signature-type'];
  let identity = paymentRequest.headers['x-identity'];
  let host;

  if (!requestUrl) {
    return callback(new Error('You must provide the original payment request url'));
  }
  if (!trustedKeys) {
    return callback(new Error('You must provide a set of trusted keys'))
  }

  try {
    host = url.parse(requestUrl).hostname;
  }
  catch(e) {}

  if (!host) {
    return callback(new Error('Invalid requestUrl'));
  }
  if (!signatureType) {
    return callback(new Error('Response missing x-signature-type header'));
  }
  if (typeof signatureType !== 'string') {
    return callback(new Error('Invalid x-signature-type header'));
  }
  if (signatureType !== 'ecc') {
    return callback(new Error(`Unknown signature type ${signatureType}`))
  }
  if (!signature) {
    return callback(new Error('Response missing signature header'));
  }
  if (typeof signature !== 'string') {
    return callback(new Error('Invalid signature header'));
  }
  if (!identity) {
    return callback(new Error('Response missing x-identity header'));
  }
  if (typeof identity !== 'string') {
    return callback(new Error('Invalid identity header'));
  }

  if (!trustedKeys[identity]) {
    return callback(new Error(`Response signed by unknown key (${identity}), unable to validate`));
  }

  let keyData = trustedKeys[identity];
  if (keyData.domains.indexOf(host) === -1) {
    return callback(new Error(`The key on the response (${identity}) is not trusted for domain ${host}`));
  } else if (!keyData.networks.includes(paymentRequest.network)) {
    return callback(new Error(`The key on the response is not trusted for transactions on the '${paymentRequest.network}' network`));
  }

  let valid = secp256k1.verify(
    new Buffer(hash, 'hex'),
    new Buffer(signature, 'hex'),
    new Buffer(keyData.publicKey, 'hex')
  );

  if (!valid) {
    return callback(new Error('Response signature invalid'));
  }

  return callback(null, keyData.owner);
};

/**
 * Verifies the signature of a given payment request is both valid and from a trusted key
 * @param requestUrl {String} The url used to fetch this payment request
 * @param paymentRequest {Object} The payment request object returned by parsePaymentRequest
 * @param trustedKeys {Object} An object containing all keys trusted by this client
 * @returns {String} The owner of the key which signed this request (ie BitPay Inc.) which should be displayed to the user
 */
PaymentProtocol.prototype.parsePaymentRequestAsync = util.promisify(PaymentProtocol.prototype.parsePaymentRequest);


/**
 * Sends a given payment to the server for validation
 * @param currency {string} Three letter currency code of proposed transaction (ie BTC, BCH)
 * @param signedRawTransaction {string} Hexadecimal format raw signed transaction
 * @param url {string} the payment protocol specific url (https)
 * @param callback {function} (err, response)
 */
PaymentProtocol.prototype.sendPayment = function sendPayment(currency, signedRawTransaction, url, callback) {
  let paymentResponse;

  //Basic sanity checks
  if (typeof signedRawTransaction !== 'string') {
    return callback(new Error('signedRawTransaction must be a string'));
  }
  if (!/^[0-9a-f]+$/i.test(signedRawTransaction)) {
    return callback(new Error('signedRawTransaction must be in hexadecimal format'));
  }

  let requestOptions = _.merge(this.options, {
    url: url,
    headers: {
      'Content-Type': 'application/payment'
    },
    body: JSON.stringify({
      currency: currency,
      transactions: [signedRawTransaction]
    })
  });

  request.post(requestOptions, (err, response) => {
    if (err) {
      return callback(err);
    }
    if (response.statusCode !== 200) {
      return callback(new Error(response.body.toString()));
    }

    try {
      paymentResponse = JSON.parse(response.body);
    }
    catch (e) {
      return callback(new Error('Unable to parse response from server'));
    }

    callback(null, paymentResponse);
  });
};

/**
 * Sends a given payment to the server for validation
 * @param currency {string} Three letter currency code of proposed transaction (ie BTC, BCH)
 * @param signedRawTransaction {string} Hexadecimal format raw signed transaction
 * @param url {string} the payment protocol specific url (https)
 */
PaymentProtocol.prototype.sendPaymentAsync = util.promisify(PaymentProtocol.prototype.sendPayment);

module.exports = PaymentProtocol;

