'use strict';
const async = require('async');
const request = require('request');
const promptly = require('promptly');

const JsonPaymentProtocol = require('../index'); //or require('json-payment-protocol')
const paymentProtocol = new JsonPaymentProtocol({strictSSL: false});

let config;

try {
  config = require('./config');
} catch(e) {
  return console.log('You need to create a config.js file in examples based on the config.example.js file');
}

/**
 * While this client does show effective use of json payment protocol, it may not follow best practices generate
 * payments via bitcoinRPC. We do not recommend copying this code verbatim in any product designed for actual users.
 */

let requestUrl;
let paymentUrl;
let requiredFee = 0;
let outputObject = {};

async.waterfall([
  function askForPaymentUrl(cb) {
    promptly.prompt('What is the payment protocol uri?', {required: true}, cb);
  },
  function retrievePaymentRequest(uri, cb) {
    paymentProtocol.getRawPaymentRequest(uri, (err, rawResponse) => {
      if (err) {
        console.log('Error retrieving payment request', err);
        return cb(err);
      }
      return cb(null, rawResponse);
    });
  },
  function parsePaymentRequest(rawResponse, cb) {
    paymentProtocol.parsePaymentRequest(rawResponse.rawBody, rawResponse.headers, (err, paymentRequest) => {
      if (err) {
        console.log('Error parsing payment request', err);
        return cb(err);
      }
      requestUrl = rawResponse.requestUrl;
      return cb(null, paymentRequest);
    });
  },
  function verifyRequestSignature(paymentRequest, cb) {
    paymentProtocol.verifyPaymentRequest(requestUrl, paymentRequest, config.trustedKeys, function (err, keyOwner) {
      cb(err, paymentRequest, keyOwner);
    });
  },
  function checkAndDisplayPaymentRequestToUser(paymentRequest, keyOwner, cb) {
    requiredFee = (paymentRequest.requiredFeeRate * 1000) / 1e8;

    //Make sure request is for the currency we support
    if (paymentRequest.currency.toLowerCase() !== config.currency.toLowerCase()) {
      console.log('Server requested a payment in', paymentRequest.currency, 'but we are configured to accept',
        config.currency);
      return cb(new Error('Payment request currency did not match our own'));
    }

    if (paymentRequest.network.toLowerCase() !== config.network.toLowerCase()) {
      console.log('Server requested a payment on the', paymentRequest.network, 'network but we are configured for the',
        config.network, 'network');
      return cb(new Error('Payment request network did not match our own'));
    }

    console.log('Server is requesting payment(s) for:');
    console.log('---');

    paymentRequest.outputs.forEach(function (output) {
      let cryptoAmount = round(output.amount / 1e8, 8);
      console.log(cryptoAmount + ' to ' + output.address);
      outputObject[output.address] = cryptoAmount;
    });

    console.log('---');

    paymentUrl = paymentRequest.paymentUrl;

    console.log('Request signed by:', keyOwner);

    promptly.confirm('Create transaction for this payment request? (y/n)', function (err, accept) {
      if (!accept) {
        console.log('Payment cancelled');
        return cb(new Error('Payment Cancelled'));
      }
      return cb();
    });
  },
  function createRawTransaction(cb) {
    let createCommand = {
      jsonrpc: '1.0',
      method: 'createrawtransaction',
      params: [
        [],
        outputObject
      ]
    };

    execRpcCommand(createCommand, (err, rawTransaction) => {
      if (err) {
        console.log('Error creating raw transaction', err);
        return cb(err);
      }
      else if (!rawTransaction) {
        console.log('No raw tx generated');
        return cb(new Error('No tx generated'));
      }
      else {
        return cb(null, rawTransaction);
      }
    });
  },
  function fundRawTransaction(rawTransaction, cb) {
    let fundCommand = {
      jsonrpc: '1.0',
      method: 'fundrawtransaction',
      params: [
        rawTransaction,
        {
          feeRate: requiredFee
        }
      ]
    };

    execRpcCommand(fundCommand, (err, fundedRawTransaction) => {
      if (err) {
        console.log('Error funding transaction', err);
        return cb(err);
      }
      if (!fundedRawTransaction) {
        console.log('No funded tx generated');
        return cb(new Error('No funded tx generated'));
      }
      else {
        cb(null, fundedRawTransaction.hex);
      }
    });
  },
  function signRawTransaction(fundedRawTransaction, cb) {
    let command = {
      jsonrpc: '1.0',
      method: 'signrawtransaction',
      params: [fundedRawTransaction]
    };

    execRpcCommand(command, function (err, signedTransaction) {
      if (err) {
        console.log('Error signing transaction:', err);
        return cb(err);
      }
      if (!signedTransaction) {
        console.log('Bitcoind did not return a signed transaction');
        return cb(new Error('Missing signed tx'));
      }
      cb(null, fundedRawTransaction, signedTransaction.hex);
    });
  },
  function getSignedTransactionSize(fundedRawTransaction, signedRawTransaction, cb) {
    let command = {
      jsonrpc: '1.0',
      method: 'decoderawtransaction',
      params: [signedRawTransaction]
    };

    execRpcCommand(command, function (err, decodedTransaction) {
      if (err) {
        console.log('Error signing transaction:', err);
        return cb(err);
      }
      if (!decodedTransaction) {
        console.log('Bitcoind did not decode the transaction');
        return cb(new Error('Missing decoded tx'));
      }

      // `vsize` for bitcoin core w/ segwit support, `size` for other clients
      let signedTransactionSize = decodedTransaction.vsize || decodedTransaction.size;
      cb(null, fundedRawTransaction, signedRawTransaction,  signedTransactionSize);
    });
  },
  function checkIfTransactionWillBeAccepted(fundedRawTransaction, signedRawTransaction, weightedSize, cb) {
    console.log('Sending unsigned transaction to server for verification...');

    paymentProtocol.sendPaymentForVerification(config.currency, fundedRawTransaction, weightedSize, paymentUrl, (err) => {
      if (err) {
        console.log('Error verifying payment with server', err);
        return cb(err);
      } else {
        console.log('Payment verified by server');
        return cb(null, signedRawTransaction);
      }
    });
  },
  //Note we only broadcast AFTER a SUCCESS response from the server verification request
  function displayTransactionToUserForApproval(signedRawTransaction, cb) {
    let command = {
      jsonrpc: '1.0',
      method: 'decoderawtransaction',
      params: [signedRawTransaction]
    };

    execRpcCommand(command, function (err, decodedTransaction) {
      if (err) {
        console.log('Error signing transaction:', err);
        return cb(err);
      }
      if (!decodedTransaction) {
        console.log('Bitcoind did not return a decoded transaction');
        return cb(new Error('Missing decoded tx'));
      }

      console.log(JSON.stringify(decodedTransaction, null, 2));

      promptly.confirm('Send payment shown above? (y/n)', function (err, accept) {
        if (!accept) {
          console.log('Payment cancelled');
          return cb(new Error('Payment Cancelled'));
        }
        return cb(null, signedRawTransaction);
      });
    });
  },
  function broadcastPayment(signedRawTransaction, cb) {
    async.parallel([
      function sendToServer(cb) {
        paymentProtocol.sendSignedPayment(config.currency, signedRawTransaction, paymentUrl, function(err) {
          if (err) {
            console.log('Error sending payment to server', err);
            return cb(err);
          }
          else {
            console.log('Payment accepted by server');
            return cb(null, signedRawTransaction);
          }
        });
      },
      function broadcastP2P(cb) {
        let command = {
          jsonrpc: '1.0',
          method: 'sendrawtransaction',
          params: [signedRawTransaction]
        };

        execRpcCommand(command, function (err, signedTransaction) {
          if (err) {
            console.log('Error broadcasting transaction:', err);
            return cb(err);
          }
          if (!signedTransaction) {
            console.log('Bitcoind failed to broadcast transaction');
            return cb(new Error('Failed to broadcast tx'));
          }
          cb();
        });
      }
    ], cb);
  }
], function (err) {
  if (err) {
    console.log('Error', err);
  }
});

function execRpcCommand(command, callback) {
  request
    .post({
      url: 'http://' + config.rpcServer.ipAddress + ':' + config.rpcServer.port,
      body: command,
      json: true,
      auth: {
        user: config.rpcServer.username,
        pass: config.rpcServer.password,
        sendImmediately: false
      }
    }, function (err, response, body) {
      if (err) {
        return callback(err);
      }
      if (!body) {
        return callback(new Error('No body returned by bitcoin RPC server'));
      }
      if (body.error) {
        return callback(body.error);
      }
      if (body.result) {
        return callback(null, body.result);
      }
      return callback();
    });
}

function round(value, places) {
  let tmp = Math.pow(10, places);
  return Math.ceil(value * tmp) / tmp;
}
