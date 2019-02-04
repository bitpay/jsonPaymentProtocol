# BIP-70 Modifications

In addition to JSON payment protocol, BitPay Bitcoin and Bitcoin Cash invoices use a mildly modified version of [BIP-70](https://github.com/bitcoin/bips/blob/master/bip-0070.mediawiki). We include
one additional field which specifies the fee rate the transaction must have in order to be accepted. This minimum fee is required to ensure a reasonable confirmation time for payments which are sent to BitPay.
To further ensure this we also require payments be made with confirmed inputs. Payments using unconfirmed inputs, such as unconfirmed change, will be rejected. Bitcoin (BTC) invoices are temporarily exempt from these rules to allow wallets time to adjust.

Since RBF payments can be modified after they are broadcast, they will also be rejected by our payment protocol server. Make sure to disable the RBF flag for any transactions sent to BitPay.

* `required_fee_rate` - The minimum fee per byte required on your transaction. Bitcoin Cash payments will be rejected if fee rate included for the transaction is not at least this value.  _May be fractional value_ ie 0.123 sat/byte

## Application Logic

Since rejecting invalid payments before they are broadcast to the network is a primary goal of payment protocol, we recommend following this
flow when submitting a payment.

1. Fetch payment from url (standard BIP 70)
2. Create unsigned, funded transaction (standard BIP 70)
3. Sign transaction, keep unsigned transaction (**bitpay specific**)
4. Send the unsigned transaction and weighed size of the signed transaction to the server (**bitpay specific**)
5. If server rejects at this point, do not continue. Otherwise, send via standard payment protocol and broadcast to p2p in parallel

Please note that you should **NOT** broadcast a payment to the P2P network if we respond with an http status code other than `200` in
the verification step. Broadcasting a payment before getting a success notification back from the server will lead to a failed payment
for the sender. The sender will bear the cost of paying transaction fees yet again to get their money back.

## Payment Request

### Request
A GET request should be made to the payment protocol url.

### Response
The response will payload identical to the BIP70 format with one additional field for `required_fee_rate`.

#### Headers
On a successful request, the response will contain the standard BIP-70 headers.


## Payment Verification

### Request
A POST request should be made to the payment protocol url with the header `application/bitcoin-verify-payment` or `application/bitcoincash-verify-payment`.

### Request Body
The body should contain the **unsigned** transaction as well as the weighted size in vbytes of the fully signed transaction. Weighted size
really only applies for transactions with segwit inputs, if you have a non-segwit transaction the byte size is the correct value to send.
With bitcoin core this is simply the vsize value of a transaction. If you're not certain about calculating the weighted size, please see
the [bitcoin documentation about it](https://en.bitcoin.it/wiki/Weight_units). The format of this request should be based on this protobuf
proto:
```
message PaymentVerification {
    required bytes unsigned_transaction = 1;
    required uint64 weighted_size = 2 [default = 0];
}
```

### Response
A 200 status code will be returned for valid payments, all other status codes will return with an error message stating why the payment was rejected.


## Payment

### Request
A POST request should be made to the payment protocol url with the standard BIP-70 payment header (`application/bitcoin-payment` or `application/bitcoincash-payment`)

### Request Body
The body should contain the **signed** transaction in BIP-70 format

### Response
A 200 status code will be returned for valid payments, all other status codes will return with an error message stating why the payment was rejected.


