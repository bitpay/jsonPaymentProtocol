# JSON Payment Protocol Specification

Revision 0.5

## Application Logic

1. (Web) User selects preferred currency on invoice if multiple options are available
2. (Client) Wallet obtains payment protocol uri
3. (Client) Fetches payment information from server
4. (Server) Verifies invoice exists and is still accepting payments, responds with payment request
5. (Client) Validates payment request hash
6. (Client) Generates a payment to match conditions on payment request
7. (Client) Submits proposed signed transaction to server
8. (Server) Validates invoice exists and is still accepting payments
9. (Server) Validates payment matches address, amount, and currency of invoice and has a reasonable transaction fee.
10. (Server) Broadcasts payment to network and notifies client payment was accepted.
11. (Client) If payment is accepted by server, wallet broadcasts payment

If at any time the payment is rejected by the server **your client should not broadcast the payment**.
Broadcasting a payment before getting a success notification back from the server will in most cases lead to a failed payment for the sender. The sender will bear the cost of paying transaction fees yet again to get their money back.

## Payment Request

### Request
A GET request should be made to the payment protocol url.

### Response
The response will be a JSON format payload quite similar to the BIP70 format.

#### Headers
On a successful request, the response will contain one header of note.

* `digest` - A SHA256 hash of the JSON response string, should be verified by the client before proceeding

#### Body
* `network` - Which network is this request for (main / test / regtest)
* `currency` - Three digit currency code representing which coin the request is based on
* `requiredFeePerByte` - The minimum fee per byte required on this transaction, if lower than that we will reject it
* `outputs` - What output(s) your transaction must include in order to be accepted
* `time` - ISO Date format of when the invoice was generated
* `expires` - ISO Date format of when the invoice will expire
* `memo` - A plain text description of the payment request, can be displayed to the user / kept for records
* `paymentUrl` - The url where the payment should be sent
* `paymentId` - The invoice ID, can be kept for records

#### Response Body Example
```
{
  "network": "test",
  "currency": "BTC",
  "requiredFeePerByte": 200,
  "outputs": [
    {
      "amount": 39300,
      "address": "mthVG9kuRTJQtXieJVDSrrvWyM7QDZ3rcV"
    }
  ],
  "time": "2018-01-12T22:04:54.364Z",
  "expires": "2018-01-12T22:19:54.364Z",
  "memo": "Payment request for BitPay invoice TmyrxFvAi4DjFNy3c7EjVm for merchant Robs Fake Business",
  "paymentUrl": "https://test.bitpay.com/i/TmyrxFvAi4DjFNy3c7EjVm",
  "paymentId": "TmyrxFvAi4DjFNy3c7EjVm"
}
```

## Payment Payload

### Request
A POST request should be made to the payment protocol url with a `Content-Type` header set to `application/payment`. A JSON format body should be included with the following fields:

```
{
  "currency": "<currency 3 letter code>",
  "transactions": [
    "<transaction in hexedecimal string format>"
  ]
}
```

#### Example Request Body
```
{
  "currency": "BTC",
  "transactions": [
    "02000000011f0f762184cbc8e94b307fab6f805168724f123a23cd48aac4a9bac8768cfd67000000004847304402205079b96def679f04de9698dd8b9f58dff3e4a13c075f5939c6edfbb8698c8cc802203eac5a3d6410a9f94a86828a4e207f8083fe0bf1c77a74a0cb7add49100d427001ffffffff0284990000000000001976a9149097a519e42061e4977b07b69735ed842b755c0088ac08cd042a010000001976a914cf4b90bca14deab1315c125b8b74b7d31eea97b288ac00000000"
  ]
}
```

### Response
The response will be a JSON format payload containing the original payment body and a memo field which should be displayed to the user.

#### Response Example
```
{
  "payment": {
    "transactions": [
      "020000000121053733b28b90707a3c63a48171f71abfdc7288bf9d78170e73cfedbbbdfcea00000000484730440220545d53b54873a5afbaf01a77943828f25c6a28d9c5ca4d0968130b5788fc6f9302203e45125723844e4752202792b764b6538342ad169d3828dad18eb231ea01f05101ffffffff02b09a0000000000001976a9149659267896dda4e5aef150e4ca83f0d76022c7b288ac84dd042a010000001976a914fa1a5ed99ce09fd901e9ca7d6f8fcc56d3d5eccf88ac00000000"
    ]
  },
  "memo": "Transaction received by BitPay. Invoice will be marked as paid if the transaction is confirmed."
}
```

### Curl Example
```
curl -v -H 'Content-Type: application/payment' -d '{"currency": "BTC", "transactions":["02000000012319227d3995427b05429df7ea30b87cb62f986ba3003311a2cf2177fb5b0ae8000000004847304402205bd75d6b654a70dcc8f548b630c39aec1d2c1de6900b5376ef607efc705f65b002202dd1036f091d4d6047e2f5bcd230ec8bcd5ad2f0785908d78f08a52b8850559f01ffffffff02b09a0000000000001976a9140b2a833c4183c51b86f5dcbb2eeeaca2dfb44bae88acdccb042a010000001976a914f0fd63e5880cbed2fa856e1f4174fc875eeccc5a88ac00000000"]}' https://test.bitpay.com/i/7QBCJ2TpazTKKnczzJQJMc 
*   Trying 127.0.0.1...
* TCP_NODELAY set
* Connected to test.bitpay.com (127.0.0.1) port 8088 (#0)
* TLS 1.2 connection using TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256
> POST /i/7QBCJ2TpazTKKnczzJQJMc HTTP/1.1
> Host: test.bitpay.com
> User-Agent: curl/7.54.0
> Accept: */*
> Content-Type: application/payment-ack
> Content-Length: 403
> 
* upload completely sent off: 403 out of 403 bytes
< HTTP/1.1 200 OK
< Content-Length: 520
< Date: Fri, 12 Jan 2018 22:44:13 GMT
< Connection: keep-alive
< 
* Connection #0 to host test.bitpay.com left intact
{"payment":{"transactions":["02000000012319227d3995427b05429df7ea30b87cb62f986ba3003311a2cf2177fb5b0ae8000000004847304402205bd75d6b654a70dcc8f548b630c39aec1d2c1de6900b5376ef607efc705f65b002202dd1036f091d4d6047e2f5bcd230ec8bcd5ad2f0785908d78f08a52b8850559f01ffffffff02b09a0000000000001976a9140b2a833c4183c51b86f5dcbb2eeeaca2dfb44bae88acdccb042a010000001976a914f0fd63e5880cbed2fa856e1f4174fc875eeccc5a88ac00000000"]},"memo":"Transaction received by BitPay. Invoice will be marked as paid if the transaction is confirmed."}%
```


## Errors

All errors are communicated in plaintext with an appropriate status code.

### Example Error

```
curl -v https://test.bitpay.com/i/48gZau8ao76bqAoEwAKSwx -H 'Accept: application/payment-request'
*   Trying 104.17.68.20...
* TCP_NODELAY set
* Connected to test.bitpay.com (104.17.68.20) port 443 (#0)
* TLS 1.2 connection using TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256
> GET /i/48gZau8ao76bqAoEwAKSwx HTTP/1.1
> Host: test.bitpay.com
> User-Agent: curl/7.54.0
> Accept: application/payment-request
> 
< HTTP/1.1 400 Bad Request
< Date: Fri, 26 Jan 2018 01:54:03 GMT
< Content-Type: text/html; charset=utf-8
< Content-Length: 44
< Connection: keep-alive
< Strict-Transport-Security: max-age=31536000
< X-Download-Options: noopen
< X-Content-Type-Options: nosniff
< Access-Control-Allow-Origin: *
< Access-Control-Allow-Methods: GET, POST, OPTIONS
< Access-Control-Allow-Headers: Host, Connection, Content-Length, Accept, Origin, User-Agent, Content-Type, Accept-Encoding, Accept-Language
< 
* Connection #0 to host test.bitpay.com left intact
This invoice is no longer accepting payments
```

### Common Errors

| Http Status Code | Response | Cause |
|---|---|---|
| 404 | This invoice was not found or has been archived | Invalid invoiceId, or invoice has been archived (current TTL is 3 days) |
| 400 | Unsupported Content-Type for payment | Your Content-Type header was not valid |
| 400 | Invoice no longer accepting payments | Invoice is either paid or has expired |
| 400 | We were unable to parse your payment. Please try again or contact your wallet provider | Request body could not be parsed / empty body |
| 400 | Request must include exactly one (1) transaction | Included no transaction in body / Included multiple transactions in body |
| 400 | Your transaction was an in an invalid format, it must be a hexadecimal string | Make sure you're sending the raw hex string format of your signed transaction
| 400 | We were unable to parse the transaction you sent. Please try again or contact your wallet provider | Transaction was hex, but it contained invalid transaction data or was in the wrong format |
| 400 | The transaction you sent does not have any output to the bitcoin address on the invoice | The transaction you sent does not pay to the address listed on the invoice |
| 400 | The amount on the transaction (X BTC) does not match the amount requested (Y BTC). This payment will not be accepted. | Payout amount to address does not match amount that was requested |
| 400 | Transaction fee (X sat/kb) is below the current minimum threshold (Y sat/kb) | Your fee must be at least the amount sent in the payment request as `requiredFeePerByte`|
| 400 | This invoice is priced in BTC, not BCH. Please try with a BTC wallet instead | Your transaction currency did not match the one on the invoice |
| 422 | One or more input transactions for your transaction were not found on the blockchain. Make sure you're not trying to use unconfirmed change | Spending outputs which have not yet been broadcast to the network |
| 422 | One or more input transactions for your transactions are not yet confirmed in at least one block. Make sure you're not trying to use unconfirmed change | Spending outputs which have not yet confirmed in at least one block on the network |
| 500 | Error broadcasting payment to network | Our Bitcoin node returned an error when attempting to broadcast your transaction to the network. This could mean our node is experiencing an outage or your transaction is a double spend. |

Another issue you may see is that you are being redirected to `bitpay.com/invoice?id=xxx` instead of being sent a payment-request. In that case you are not setting your `Accept` header to a valid value and we assume you are a browser or other unknown requester.

## MIME Types

|Mime|Description|
|---|---|
|application/payment-request| Associated with the server's payment request, this specified on the client `Accept` header when retrieving the payment request|
|application/payment| Used by the client when sending their proposed payment transaction payload|
|application/payment-ack| Used by the server to state acceptance of the client's proposed payment transaction|
