'use strict';
//Native
const crypto = require('crypto');
const query = require('querystring');
const url = require('url');
const util = require('util');

//Modules
const _ = require('lodash');
const request = require('request');

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
  if (paymentUrlObject.protocol !== 'http' && paymentUrlObject.protocol !== 'https') {
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

    return callback(null, {rawBody: response.body, headers: response.headers});
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

  return callback(null, paymentRequest);
};

/**
 * Given a raw payment protocol body, parses it and validates it against the digest header
 * @param rawBody {string} Raw JSON string retrieved from the payment protocol server
 * @param headers {object} Headers sent by the payment protocol server
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

