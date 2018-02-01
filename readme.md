### JSON Payment Protocol Interface

This is the first version of the JSON payment protocol interface. If you have questions about the specification itself, [view the documentation](specification.md).

### Getting Started

`npm install json-payment-protocol`

### Usage

We support both callbacks and promises. For promises just add Async to the end of the function name. Be careful to follow the notes about when to broadcast your payment. **Broadcasting a payment before getting a success notification back from the server in most cases will lead to a failed payment for the sender.** The sender will bear the cost of paying transaction fees yet again to get their money back.

#### Callbacks
```
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
    let currency = 'BTC'
    let signedRawTransaction = '02000000010c2b0d60448d5cdfebe222014407bdb408b8427f837447484911efddea700323000000006a47304402201d3ed3117f1968c3b0a078f15f8462408c745ff555b173eff3dfe0a25e063c0c02200551572ec33d45ece8e64275970bd1b1694621f0ed8fac2f7e18095f170fe3fe012102d4edb773e3bd94e1251790f5cc543cbfa76c2b0abad14898674b1c4e27176ef2ffffffff02c44e0100000000001976a914dd826377dcf2075e5065713453cfad675ba9434f88aca070002a010000001976a914e7d0344ba970301e93cd7b505c7ae1b5bcf5639288ac00000000';

    paymentProtocol.sendPayment(currency, signedRawTransaction, paymentRequest.paymentUrl, function(err, response) {
      if (err) {
        //DO NOT BROADCAST PAYMENT
        return console.log('Error sending payment to server');
      }
      console.log('Payment sent successfully');
      //TODO: Broadcast payment to network here
    });
  });
});
```

#### Promises
```
const JsonPaymentProtocol = require('json-payment-protocol');
const paymentProtocol = new JsonPaymentProtocol();

let requestUrl = 'bitcoin:?r=https://test.bitpay.com/i/Jr629pwsXKdTCneLyZja4t';
paymentProtocol
  .getRawPaymentRequestAsync(requestUrl)
  .then((response) => {
    return paymentProtocol.parsePaymentRequestAsync(response.rawBody, response.headers);
  })
  .then((paymentRequest) => {
    console.log('Payment request retrieved');
    console.log(paymentRequest);
    
    //TODO: Create the rawTransaction and sign it in your wallet instead of this, do NOT broadcast yet
    let currency = 'BTC'
    let signedRawTransaction = '02000000010c2b0d60448d5cdfebe222014407bdb408b8427f837447484911efddea700323000000006a47304402201d3ed3117f1968c3b0a078f15f8462408c745ff555b173eff3dfe0a25e063c0c02200551572ec33d45ece8e64275970bd1b1694621f0ed8fac2f7e18095f170fe3fe012102d4edb773e3bd94e1251790f5cc543cbfa76c2b0abad14898674b1c4e27176ef2ffffffff02c44e0100000000001976a914dd826377dcf2075e5065713453cfad675ba9434f88aca070002a010000001976a914e7d0344ba970301e93cd7b505c7ae1b5bcf5639288ac00000000';

    return paymentProtocol.sendPaymentAsync(currency, signedRawTransaction, paymentRequest.paymentUrl);
  })
  .then((response) => {
    console.log('Payment sent successfully');
    //TODO: Broadcast payment to network here
  })
  .catch((err) => {
    //DO NOT BROADCAST PAYMENT
    return console.log('Error processing payment request', err);
  });
```

### Options

Options passed to `new JsonPaymentProtocol()` are passed to request, so if you need to use a proxy or set any other request.js flags you can do so by including them when instantiating your instance. For example:

```
new JsonPaymentProtocol({
  proxy: 'socks://mySocksProxy.local'
})
```

### URI Formats
You can provide either the `bitcoin:?r=https://bitpay.com/i/invoice` format or `https://bitpay.com/i/invoice` directly.

