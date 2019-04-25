### JSON Payment Protocol Interface v2

This is the second version of the JSON payment protocol interface. If you have questions about the v2 specification itself, [view the documentation](v2/specification.md).

[If you have questions about the first version of the specification view the documentation](v1/specification.md).


### Getting Started with v2
This is actively being implemented. The plan is to:
* Update the bitpay side to send the v2 structure
* Change the json-payment-protocol client code to work with v1 and v2

### Getting Started with v1

`npm install json-payment-protocol`

### v1 Usage

We support both callbacks and promises. For promises just add Async to the end of the function name. Be careful to follow the notes about when to broadcast your payment. **Broadcasting a payment before getting a success notification back from the server in most cases will lead to a failed payment for the sender.** The sender will bear the cost of paying transaction fees yet again to get their money back.

#### Callbacks
```js
const JsonPaymentProtocol = require('json-payment-protocol');
const paymentProtocol = new JsonPaymentProtocol();

let requestUrl = 'bitcoin:?r=https://test.bitpay.com/i/Jr629pwsXKdTCneLyZja4t';

paymentProtocol.getRawPaymentRequest(requestUrl, function (err, response) {
  if (err) {
    return console.log('Error retrieving payment request', err);
  }
  paymentProtocol.parsePaymentRequest(response.rawBody, response.headers, function (err, paymentRequest) {
    if (err) {
      return console.log('Error parsing payment request', err);
    }

    console.log('Payment request retrieved');
    console.log(paymentRequest);

    //TODO: Create the rawTransaction and sign it in your wallet instead of this, do NOT broadcast yet
    let currency = 'BTC';
    
    // Funded unsigned raw transaction
    let unsignedRawTransaction = '02000000016b7bceefa3ff3bf6f3ad39a99cf6def9126a6edf8f49462bd06e4cb74366dab00100000000feffffff0248590095000000001976a9141b4f4e0c5354ce950ea702cc79be34885e7a60af88ac0c430100000000001976a914072053b485736e002f665d5fc65c443fb379256e88ac00000000'
    // Signed version of that transaction
    let signedRawTransaction = '02000000016b7bceefa3ff3bf6f3ad39a99cf6def9126a6edf8f49462bd06e4cb74366dab0010000006b4830450221008d8852576eb8e505832a53569dd756a1d0c304606c27e81d0ac1a83e78250969022058b2bde3f2e1ea7e6a62e69d99f7219e846f04c1c58ff163e2996669a935c31501210206e855c3cfd24a5e154cf94ff7a214d598dfc2d62966011fd83c360cf229777ffeffffff0248590095000000001976a9141b4f4e0c5354ce950ea702cc79be34885e7a60af88ac0c430100000000001976a914072053b485736e002f665d5fc65c443fb379256e88ac00000000';
    // total size of the signed transaction (note the way shown here is incorrect for segwit, see the code in /examples for getting vsize from RPC)
    let signedRawTransactionSize = Buffer.from(signedRawTransaction, 'hex').byteLength;

    paymentProtocol.sendPaymentForVerification(currency, unsignedRawTransaction, signedRawTransactionSize, paymentRequest.paymentUrl, function(err, response) {
      if (err) {
        // If server rejects, stop, don't broadcast, show user the error
        return console.log('Error verifying payment with server', err);
      }

      // Execute these in parallel
      // Sending payment to server via payment protocol
      paymentProtocol.broadcastPayment(currency, signedRawTransaction, paymentRequest.paymentUrl, function(err, response) {
        console.log('Ignore any errors here if you already received verified above');
      });
      // Sending payment to bitcoin p2p network
      myWallet.broadcastp2p(signedRawTransaction);
    });
  });
});
```

#### Promises
```js
const JsonPaymentProtocol = require('json-payment-protocol');
const paymentProtocol = new JsonPaymentProtocol();

let requestUrl = 'bitcoin:?r=https://test.bitpay.com/i/Jr629pwsXKdTCneLyZja4t';
let response = await paymentProtocol.getRawPaymentRequestAsync(requestUrl);
let paymentRequest = await paymentProtocol.parsePaymentRequestAsync(response.rawBody, response.headers);

console.log('Payment request retrieved');
console.log(paymentRequest);

//TODO: Create the rawTransaction and sign it in your wallet instead of this example, do NOT broadcast yet
// Funded unsigned raw transaction
let unsignedRawTransaction = '02000000016b7bceefa3ff3bf6f3ad39a99cf6def9126a6edf8f49462bd06e4cb74366dab00100000000feffffff0248590095000000001976a9141b4f4e0c5354ce950ea702cc79be34885e7a60af88ac0c430100000000001976a914072053b485736e002f665d5fc65c443fb379256e88ac00000000'
// Signed version of that transaction
let signedRawTransaction = '02000000016b7bceefa3ff3bf6f3ad39a99cf6def9126a6edf8f49462bd06e4cb74366dab0010000006b4830450221008d8852576eb8e505832a53569dd756a1d0c304606c27e81d0ac1a83e78250969022058b2bde3f2e1ea7e6a62e69d99f7219e846f04c1c58ff163e2996669a935c31501210206e855c3cfd24a5e154cf94ff7a214d598dfc2d62966011fd83c360cf229777ffeffffff0248590095000000001976a9141b4f4e0c5354ce950ea702cc79be34885e7a60af88ac0c430100000000001976a914072053b485736e002f665d5fc65c443fb379256e88ac00000000';
// total size of the signed transaction (note the way shown here is incorrect for segwit, see the code in /examples for getting vsize from RPC)
let signedRawTransactionSize = Buffer.from(signedRawTransaction, 'hex').byteLength;

// This sends the proposed unsigned transaction to the server
try {
  await paymentProtocol.sendPaymentForVerificationAsync(currency, unsignedRawTransaction, signedRawTransactionSize, paymentRequest.paymentUrl);
} catch (e) {
  // Payment was rejected, do not continue, tell the user why they were rejected
  return console.log('Proposed payment rejected', e);
}

// This sends the fully signed transaction
try {
  await paymentProtocol.sendSignedPaymentAsync(currency, signedRawTransaction, paymentRequest.paymentUrl);
} catch (e) {
  // ignore errors here 
}

// Broadcast from your wallet to p2p
myWallet.broadcastp2p(signedRawTransaction);
```

### Options

Options passed to `new JsonPaymentProtocol()` are passed to request, so if you need to use a proxy or set any other request.js flags you can do so by including them when instantiating your instance. For example:

```js
new JsonPaymentProtocol({
  proxy: 'socks://mySocksProxy.local'
})
```

### URI Formats
You can provide either the `bitcoin:?r=https://bitpay.com/i/invoice` format or `https://bitpay.com/i/invoice` directly.

