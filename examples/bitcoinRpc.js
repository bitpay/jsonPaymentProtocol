const promptly = require('promptly');
const request = require('request');

const PaymentProtocol = require('../index'); // or require('json-payment-protocol')

let config;

try {
  config = require('./config');
} catch (e) {
  return console.log('You need to create a config.js file in examples based on the config.example.js file');
}

const client = new PaymentProtocol({
  rejectUnauthorized: false,
  headers: {
    bp_partner: 'BitPay', // Your wallet name here
    bp_partner_version: '0.1.0' // Your current wallet version here
  }
}, config.trustedKeys);

let rpcUrl;
let rpcUser;
let rpcPass;

async function main() {
  const url = await promptly.prompt('What is the payment protocol uri?', { required: true });
  const paymentOptions = await client.getPaymentOptions(url);
  const rates = await fetchExchangeRates();

  // Show user information about the payment
  console.log(paymentOptions.responseData.memo);

  let index = 1;
  let choices = [];
  let unavailable = [];

  // Add methods for ease of calculating rates later
  function getBaseRate(code) {
    const rate = rates.data.find((el) => {
      return el.code === code;
    });
    return rate.rate;
  }

  function getExchangeRate(fromCode, toCode) {
    const fromRate = getBaseRate(fromCode);
    const toRate = getBaseRate(toCode);
    return round(toRate / fromRate, 8);
  }

  let choice;
  let selected = paymentOptions.responseData.paymentOptions.filter((option) => {
    return option.selected;
  })[0];

  if (selected) {
    let { chain, estimatedAmount, decimals, minerFee } = selected;

    // Must display network cost if provided, not doing so would be hiding costs
    const networkCost = minerFee / Math.pow(10, decimals);
    const usdCost = networkCost * getExchangeRate(chain, 'USD');

    console.log('Currency is already selected on this invoice:', `${chain} ${round(estimatedAmount * Math.pow(10, -decimals), decimals)} - (Network Cost: $${round(usdCost, 2)})`);

    choice = selected;
  } else {
    for (let { chain, estimatedAmount, decimals, minerFee } of paymentOptions.responseData.paymentOptions) {
      if (!config.rpcServers[chain]) {
        return unavailable.push({ chain, estimatedAmount, decimals });
      }
      choices.push(index);

      // Must display network cost if provided, not doing so would be hiding costs
      const networkCost = minerFee / Math.pow(10, decimals);
      const usdCost = networkCost * getExchangeRate(chain, 'USD');
      console.log(`${index++}. ${chain} ${round(estimatedAmount * Math.pow(10, -decimals), decimals)} - (Network Cost: $${round(usdCost, 2)})`);
    }

    if (unavailable.length) {
      console.log(`There are ${unavailable.length} additional options that this wallet does not support or for which you do not have sufficient balance:`);
      for (let { chain, estimatedAmount, decimals } of unavailable) {
        console.log(`- ${chain} ${estimatedAmount * Math.pow(10, -decimals)}`);
      }
    }

    console.log('---');

    choice = await promptly.choose('What payment method would you like to use?', choices);
    choice = paymentOptions.responseData.paymentOptions[choice - 1];
  }

  let rpcConfig = config.rpcServers[choice.chain];
  rpcUrl = `http://${rpcConfig.ipAddress}:${rpcConfig.port}`;
  rpcUser = rpcConfig.username;
  rpcPass = rpcConfig.password;

  const { responseData: paymentRequest } = await client.selectPaymentOption(paymentOptions.requestUrl, choice.chain, choice.currency);

  /**
   * Wallet creates a transaction matching data in the instructions
   */

  // Format outputs as expected for bitcoin rpc client
  let outputObject = {};
  paymentRequest.instructions.forEach((instruction) => {
    instruction.outputs.forEach(function(output) {
      let cryptoAmount = round(output.amount / 1e8, 8);
      console.log(cryptoAmount + ' to ' + output.address);
      outputObject[output.address] = cryptoAmount;
    });
  });

  let fundedTx;
  let signedTx;
  let decodedTx;

  try {
    let rawTx = await createRawTransaction(outputObject);
    fundedTx = await fundRawTransaction(rawTx, paymentRequest.instructions[0].requiredFeeRate / 1000);
    signedTx = await signRawTransaction(fundedTx);
    decodedTx = await decodeRawTransaction(signedTx);
  } catch (e) {
    console.log('Error generating payment transaction');
    throw e;
  }

  /**
   * Send un-signed transaction to server for verification of fee and output amounts
   */

  try {
    await client.verifyUnsignedPayment({
      paymentUrl: paymentOptions.requestUrl,
      chain: choice.chain,
      // For chains which can support multiple currencies via tokens, a currency code is required to identify which token is being used
      currency: choice.currency,
      unsignedTransactions: [{
        tx: fundedTx,
        // `vsize` for bitcoin core w/ segwit support, `size` for other clients
        weightedSize: decodedTx.vsize || decodedTx.size
      }]
    });
  } catch (e) {
    console.log('Error verifying payment');
    throw e;
  }

  // Display tx to user for confirmation
  console.log(JSON.stringify(decodedTx, null, 2));

  const signPayment = await promptly.confirm('Send this payment? (y/n)');
  if (!signPayment) {
    throw new Error('User aborted');
  }

  /**
   * Send signed transaction to server for actual payment
   */

  await sendPayment();
  await sendP2pPayment();

  async function sendPayment() {
    try {
      await client.sendSignedPayment({
        paymentUrl: paymentOptions.requestUrl,
        chain: choice.chain,
        currency: choice.currency,
        signedTransactions: [{
          tx: signedTx,
          // `vsize` for bitcoin core w/ segwit support, `size` for other clients
          weightedSize: decodedTx.vsize || decodedTx.size
        }]
      });
      console.log('Payment successfully sent via payment protocol');
    } catch (e) {
      console.log('Error sending payment', e);
      let confirm = promptly.confirm('Retry payment?', { default: false });
      if (confirm) {
        return await sendPayment();
      } else {
        throw e;
      }
    }
  }

  async function sendP2pPayment() {
    try {
      await broadcastP2P(signedTx);
    } catch (e) {
      console.log('Error broadcasting transaction to p2p network', e);
      let confirm = promptly.confirm('Retry broadcast?', { default: false });
      if (confirm) {
        return await sendPayment();
      } else {
        throw e;
      }
    }
  }
}

function fetchExchangeRates() {
  return new Promise((resolve, reject) => {
    request({
      method: 'GET',
      uri: 'https://bitpay.com/rates/',
      json: true
    }, (err, response, body) => {
      if (err) {
        return reject(err);
      }
      return resolve(body);
    });
  });
}

/**
 * Generates a bitcoin Transaction
 * @param outputObject {Object} addresses and output amounts
 * @return {Promise<String>} Raw Transaction in hex format
 */
async function createRawTransaction(outputObject) {
  let createCommand = {
    jsonrpc: '1.0',
    method: 'createrawtransaction',
    params: [
      [],
      outputObject,
    ]
  };
  let rawTransaction;

  try {
    rawTransaction = await execRpcCommand(createCommand);
  } catch (err) {
    console.log('Error creating raw transaction', err);
    throw err;
  }

  if (!rawTransaction) {
    console.log('No raw tx generated');
    throw new Error('No tx generated');
  }

  return rawTransaction;
}

/**
 * Adds inputs and change output to a given raw transaction
 * @param {String} rawTransaction - hexadecimal format transaction
 * @param {Number} requiredFee - fee in sat per kb
 * @return {Promise<String>} - funded raw transaction in hexadecimal format
 */
async function fundRawTransaction(rawTransaction, requiredFee) {
  let fundCommand = {
    jsonrpc: '1.0',
    method: 'fundrawtransaction',
    params: [
      rawTransaction,
      { feeRate: requiredFee },
    ]
  };

  let fundedRawTransaction;

  try {
    fundedRawTransaction = await execRpcCommand(fundCommand);
  } catch (err) {
    console.log('Error funding transaction', err);
    throw err;
  }

  if (!fundedRawTransaction) {
    console.log('No funded tx generated');
    throw new Error('No funded tx generated');
  }

  return fundedRawTransaction.hex;
}

/**
 * Signs transaction for broadcast
 * @param {String} fundedRawTransaction - Hexadecimal format funded transaction
 * @return {Promise<String>} - signedTransaction in hexadecimal format
 */
async function signRawTransaction(fundedRawTransaction) {
  let command = {
    jsonrpc: '1.0',
    method: 'signrawtransaction',
    params: [fundedRawTransaction]
  };

  let signedTransaction;

  try {
    signedTransaction = await execRpcCommand(command);
  } catch (err) {
    console.log('Error signing transaction', err);
    throw err;
  }

  if (!signedTransaction) {
    console.log('Bitcoind did not return a signed transaction');
    throw new Error('Missing signed tx');
  }

  return signedTransaction.hex;
}

/**
 * Decodes a hexadecimal format transaction
 * @param {string} rawTransaction
 * @return {Promise<*>}
 */
async function decodeRawTransaction(rawTransaction) {
  let command = {
    jsonrpc: '1.0',
    method: 'decoderawtransaction',
    params: [rawTransaction]
  };

  let decodedTransaction;

  try {
    decodedTransaction = await execRpcCommand(command);
  } catch (err) {
    console.log('Error decoding transaction', err);
    throw err;
  }

  if (!decodedTransaction) {
    console.log('Bitcoind did not decode the transaction');
    throw new Error('Missing decoded tx');
  }

  return decodedTransaction;
}

/**
 * Sends a signed transaction to the bitcoin p2p network
 * @param signedTransaction
 * @return {Promise<*>}
 */
async function broadcastP2P(signedTransaction) {
  let command = {
    jsonrpc: '1.0',
    method: 'sendrawtransaction',
    params: [signedTransaction]
  };

  let result;

  try {
    result = await execRpcCommand(command);
  } catch (err) {
    console.log('Error broadcasting transaction');
    throw err;
  }

  if (!result) {
    console.log('Bitcoind failed to broadcast transaction');
    throw new Error('Failed to broadcast tx');
  }

  return result;
}

/**
 * Executes an RPC command
 * @param {Object} command
 * @return {Promise<any>}
 */
function execRpcCommand(command) {
  return new Promise((resolve, reject) => {
    request
      .post({
        url: rpcUrl,
        body: command,
        json: true,
        auth: {
          user: rpcUser,
          pass: rpcPass,
          sendImmediately: false
        }
      }, function(err, response, body) {
        if (err) {
          return reject(err);
        }
        if (!body) {
          return reject(new Error('No body returned by bitcoin RPC server'));
        }
        if (body.error) {
          return reject(body.error);
        }
        if (body.result) {
          return resolve(body.result);
        }
        return resolve();
      });
  });
}

/**
 * Rounds a number to a specific precision of digits
 * @param value
 * @param places
 * @return {number}
 */
function round(value, places) {
  let tmp = Math.pow(10, places);
  return Math.round(value * tmp) / tmp;
}

main().catch(e => console.log(e));
