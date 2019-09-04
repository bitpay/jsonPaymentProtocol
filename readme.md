### JSON Payment Protocol Interface v2

This is the second version of the JSON payment protocol interface. If you have questions about the v2 specification itself, [view the documentation](v2/specification.md).

[If you have questions about the first version of the specification view the documentation](v1/specification.md).


### Getting Started with v2

`npm install json-payment-protocol`

### v2 Usage

This library is now using async await structure for all functions. Be careful to follow the notes about when to broadcast your payment.
Broadcasting a payment before getting a success notification back from the server in most cases will lead to a failed payment for the sender.
The sender will bear the cost of paying transaction fees yet again to get their money back.
 
#### Example
```js
const JsonPaymentProtocol = require('json-payment-protocol');

// Options such as additional headers, etc which you want to pass to the node https client on every request
const requestOptions = {};

const trustedKeys = {
  'mh65MN7drqmwpCRZcEeBEE9ceQCQ95HtZc': {
    // This is displayed to the user, somewhat like the organization field on an SSL certificate
    owner: 'BitPay (TESTNET ONLY - DO NOT TRUST FOR ACTUAL BITCOIN)',
    // Which domains this key is valid for
    domains: ['test.bitpay.com'],
    // The actual public key which should be used to validate the signatures
    publicKey: '03159069584176096f1c89763488b94dbc8d5e1fa7bf91f50b42f4befe4e45295a',
  }
};

const client = new JsonPaymentProtocol(requestOptions, trustedKeys);


let requestUrl = 'bitcoin:?r=https://test.bitpay.com/i/Jr629pwsXKdTCneLyZja4t';

const paymentOptions = await client.getPaymentOptions(requestUrl);

// The paymentOptions response will contain one or more currency / chain options. If you are a multi-currency wallet then you should
// display the compatible payment options to the user. If only one option is supported it is 

const { responseData: paymentRequest } = await client.selectPaymentOption(paymentOptions.requestUrl, userChoice.chain, userChoice.currency);

// Parse response data instructions and create an appropriate unsigned and signed transaction
// This is pseudocode
let unsignedTransaction = await myWallet.createTransaction(responseData);
let signedTransaction = await myWallet.signTransaction(unsignedTransaction);

// We send the unsigned transaction(s) first with their size to verify if this payment will be accepted
try {
  await client.verifyUnsignedPayment({
    paymentUrl: paymentOptions.requestUrl,
    chain: userChoice.chain,
    // For chains which can support multiple currencies via tokens, a currency code is required to identify which token is being used
    currency: userChoice.currency,
    unsignedTransactions: [{
      tx: unsignedTransaction.rawHex,
      // `vsize` for bitcoin core w/ segwit support, `size` for other clients
      weightedSize: signedTransaction.vsize || signedTransaction.size
    }]
  });
} catch (e) {
  // If an error occurs here, it is most likely an issue with the transaction (insufficient fee, rbf, unconfirmed inputs, etc)
  // It could also be a network error or the invoice may no longer be accepting payments (already paid or expired)
  return console.log('Error verifying payment with server', e);
}

// If the payment is valid we send the signed payment
try {
  await client.sendSignedPayment({
    paymentUrl: paymentOptions.requestUrl,
    chain: choice.chain,
    currency: choice.currency,
    signedTransactions: [{
      tx: signedTransaction,
      // `vsize` for bitcoin core w/ segwit support, `size` for other clients
      weightedSize: signedTransaction.vsize || signedTransaction.size
    }]
  });
  await broadcastP2P(signedTransaction);
  console.log('Payment successfully sent');
} catch (e) {
  console.log('Error sending payment', e);
}
```

### Options

Options passed to `new JsonPaymentProtocol()` are passed to request, so if you need to use a proxy or set any other request.js flags you can do so by including them when instantiating your instance. For example:

```js
new JsonPaymentProtocol({
  proxy: 'socks://mySocksProxy.local',
  headers: {
    'user-agent': 'myWallet'
  }
})
```

### URI Formats
You can provide either the `bitcoin:?r=https://bitpay.com/i/invoice` format or `https://bitpay.com/i/invoice` directly.

