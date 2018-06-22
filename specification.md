# JSON Payment Protocol Specification

Revision 0.6

## Application Logic

1. (Web) User selects preferred currency on invoice if multiple options are available
2. (Client) Wallet obtains payment protocol uri
3. (Client) Fetches payment information from server
4. (Server) Verifies invoice exists and is still accepting payments, responds with payment request
5. (Client) Validates payment request hash
6. (Client) Validates payment request signature
7. (Client) Generates a payment to match conditions on payment request
8. (Client) Submits proposed signed transaction to server
9. (Server) Validates invoice exists and is still accepting payments
10. (Server) Validates payment matches address, amount, and currency of invoice and has a reasonable transaction fee.
11. (Server) Broadcasts payment to network and notifies client payment was accepted.
12. (Client) If payment is accepted by server, wallet broadcasts payment

In general, the payment should not be broadcast by the client. If at any time the payment is rejected by the server **your client must not broadcast the payment**.
Broadcasting a payment before getting a success notification back from the server will in most cases lead to a failed payment for the sender. The sender will bear the cost of paying transaction fees yet again to get their money back.

## Payment Request

### Request
A GET request should be made to the payment protocol url.

### Response
The response will be a JSON format payload quite similar to the BIP70 format.

#### Headers
On a successful request, the response will contain the following headers.

* `digest` - A SHA256 hash of the JSON response string, should be verified by the client before proceeding
* `x-identity` - An identifier to represent which public key should be used to verify the signature. For example for BitPay's ECC keys we will include the public key hash in this header. Implementations should **NOT** include the public key here directly.
* `x-signature-type` The signature format used to sign the payload. For the foreseeable future BitPay will always use `ECC`. However, we wanted to grant some flexibility to the specification.
* `x-signature` - A cryptographic signature of the SHA256 hash of the payload. This is to prove that the payment request was not tampered with before being received by the wallet.

#### Body
* `network` - Which network is this request for (main / test / regtest)
* `currency` - Three digit currency code representing which coin the request is based on
* `requiredFeeRate` - The minimum fee per byte required on this transaction. Payment will be rejected if fee rate included for the transaction is not at least this value. _May be fractional value_ ie 0.123 sat/byte
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

## Signatures

Many wallet developers have voiced complaints about needing to use x509 PKI in order to verify payments, so here we're attempting to provide an answer. We will ensure payload integrity for all payment requests via an ECDSA signature.
For those unaware, this is the exact same method all bitcoin transactions are authenticated. This should make it much easier for wallets to implement since they already have code to do this. We will distribute public keys which can be used to verify the signatures.
How you choose to store the keys for verifying providers is up to you as a wallet developer, but we do make some recommendations below.

Since there will potentially be multiple providers using this system each with multiple keys, the payment request will include an `x-identity` header will contain a unique identifier to indicate which public key was used to sign the payload. In the case of ECSDA signatures we
will provide the RIPEMD160+SHA256 hash of the public key in this header (same format as a bitcoin address). We have chosen not to send the public key itself here as that would lead to the possibility of wallet developers naively trusting whatever public key was sent via the header
and verifying against that. By only sending a hash of the public key the wallet developer is required to follow best practices of retrieving the public keys from a trusted source.

### Key Distribution
The JSON payment protocol provider will make keys available via the route:
* <paymentRequestDomain>/signingKeys/paymentProtocol.json

This route will serve a JSON payload which conforms to the format:

```
{
  "owner": "Company name that may be displayed to the user",
  "expirationDate": "ISO format date when these keys expire",
  "validDomains": [
    "myDomain.com",
    "payments.myDomain.com"
  ],
  "publicKeys": [
    "hexadecimalEncodedPublicKeyHere"
  ]
}
```

An example of this fully completed:
```
{
  "owner": "BitPay, Inc.",
  "expirationDate": "2018-06-01T00:00:00.000Z",
  "validDomains": [
    "test.bitpay.com"
  ],
  "publicKeys": [
    "03361b5c0d5d2fec5c9313ab79b82266c576254697546a4868d860423557f3a52f"
  ]
}
```


### Key Signature Distribution
The JSON payment protocol provider will distribute PGP signatures of the distributed keys available via:
* <paymentRequestDomain>/signatures/<sha256HashOfKeyPayload>.json

The SHA256 should be performed on the raw body of the keys sent down by the server.

This ensures that even if the provider's SSL certificate is compromised that the attacker cannot forge payment requests.

This route will server a JSON payload which conforms to the format:
```
{
  "keyHash": "SHA256 hash of key payload",
  "signatures": [
    {
      "created": "ISO Date when this signature was created",
      "identifier": "PGP fingerprint",
      "signature": "hexadecimal encoded detached PGP signature of key payload"
    }
  ]
}
```

An example of this fully completed:
```
{
  "keyHash": "622c5dc05501b848221a9e0b2e9a84c0869cdb7604d785a0486fe817c9c34fe1",
  "signatures": [
    {
      "created": "2018-03-07T01:46:39.310Z",
      "identifier": "3c936ad8b8fa8de3290bc45cae7eefda5240818d",
      "signature": "2d2d2d2d2d424547494e20504750205349474e41545552452d2d2d2d2d0a436f6d6d656e743a20475047546f6f6c73202d2068747470733a2f2f677067746f6f6c732e6f72670a0a6951497a424141424367416446694545504a4e71324c6a366a654d7043385263726e3776326c4a4167593046416c714d62574d4143676b51726e3776326c4a410a6759306c73672f2b4e7839486577622b31527631347038676e7a4c563763536c6f4f422f5262586b694136426a76336a4166735a55623175484d6e617a3644370a736e6c306e47775233497966554c6d3254647536444e3043314e767549367374442f7362666473572b6c726a72666d6d6b377a2f36726c593169684a6d5061330a6758344f4d63577061352f4e56636a436f432b546b51434b4d77684237424b7030344a363679326f78382f583736574c6d685544366b6b6155565979656637520a79566666784c6d766747627a476d7433445958316a59524a766d4e6b6f5749466f30557254576d7a55457961505538457950386d415075347a413749453834650a546f57634e38714b576564797879396e615147493679376a5149445a72454a30315a56785371326b6352506e464d694432772f6c69704b6b504a4e577556764e0a3834644f4372324859302b584769726c74744c673167363077314a5333455354714938374a786766716f53695257666c4d4f736667712f6e302b7243337057620a535030397245457a307069705376374d5a723944436142435261544142333156567a6f4c48536e67452b4a4f5264615a4a2f7274796f315366634c5a75314d320a4241735178786c7142306449617174534830386b50496e6a5a746776346358766142556443507178774d6f444c664d643152324330705033337453465533534b0a4e6b786b4d326744536a41392b2b5754625267553543556c3642725942516a62415836773673715354775a42796e736e6270366c6d6f6f6c4b314341762b55500a7144444d4c6e6a696a62465861324476326833495650456246786178336a73303367557448496e4141552f4c4b4b4948583730664d644b45566c735845482b4b0a53395238446c4c355854467a38435175693175692f394f484f77523549672b5436532f5a3678504f51594d4d69562f6e6a48553d0a3d62357a450a2d2d2d2d2d454e4420504750205349474e41545552452d2d2d2d2d"
    },
    {
      "created": "2018-03-07T01:46:39.310Z",
      "identifier": "3c936ad8b8fa8de3290bc45cae7eefda5240818d",
      "signature": "2d2d2d2d2d424547494e20504750205349474e41545552452d2d2d2d2d0a436f6d6d656e743a20475047546f6f6c73202d2068747470733a2f2f677067746f6f6c732e6f72670a0a6951497a424141424367416446694545504a4e71324c6a366a654d7043385263726e3776326c4a4167593046416c714d62574d4143676b51726e3776326c4a410a6759306c73672f2b4e7839486577622b31527631347038676e7a4c563763536c6f4f422f5262586b694136426a76336a4166735a55623175484d6e617a3644370a736e6c306e47775233497966554c6d3254647536444e3043314e767549367374442f7362666473572b6c726a72666d6d6b377a2f36726c593169684a6d5061330a6758344f4d63577061352f4e56636a436f432b546b51434b4d77684237424b7030344a363679326f78382f583736574c6d685544366b6b6155565979656637520a79566666784c6d766747627a476d7433445958316a59524a766d4e6b6f5749466f30557254576d7a55457961505538457950386d415075347a413749453834650a546f57634e38714b576564797879396e615147493679376a5149445a72454a30315a56785371326b6352506e464d694432772f6c69704b6b504a4e577556764e0a3834644f4372324859302b584769726c74744c673167363077314a5333455354714938374a786766716f53695257666c4d4f736667712f6e302b7243337057620a535030397245457a307069705376374d5a723944436142435261544142333156567a6f4c48536e67452b4a4f5264615a4a2f7274796f315366634c5a75314d320a4241735178786c7142306449617174534830386b50496e6a5a746776346358766142556443507178774d6f444c664d643152324330705033337453465533534b0a4e6b786b4d326744536a41392b2b5754625267553543556c3642725942516a62415836773673715354775a42796e736e6270366c6d6f6f6c4b314341762b55500a7144444d4c6e6a696a62465861324476326833495650456246786178336a73303367557448496e4141552f4c4b4b4948583730664d644b45566c735845482b4b0a53395238446c4c355854467a38435175693175692f394f484f77523549672b5436532f5a3678504f51594d4d69562f6e6a48553d0a3d62357a450a2d2d2d2d2d454e4420504750205349474e41545552452d2d2d2d2d"
    }
  ]
}
```
Please note that these example signatures may not match the example key payload, don't use them for testing


### PGP Key Distribution
It is ultimately up to the JSON payment protocol provider as to how they will distribute the PGP public keys used to sign their payment protocol signing keys. We recommend using multiple distribution paths, at least one of which should not be on the same domain as the payment requests.

### BitPay Specific Signature Details

#### Signing
For the foreseeable future all of BitPay's payment requests will be signed via ECDSA using the SECP 256 k1 curve (the same as used in Bitcoin itself). This is to allow very simple compatibility with wallets, as every wallet should already be fully able to verify ECC signatures of bitcoin transactions.

#### PGP Key Distribution
BitPay will make its PGP keys available via the following resources:

* https://github.com/bitpay/pgp-keys
* https://bitpay.com/pgp-keys (or in JSON format https://bitpay.com/pgp-keys.json)

Please take time to verify the keys in both places.

#### Key-storing suggestions
Some wallets may not be sure about the best way to store the ECC public keys for JSON payment protocol providers. There are likely to be two or three common approaches. Regardless of your approach, we recommend keeping in mind that keys can be compromised and therefore may require being changed
relatively quickly. It also may also be reasonable for advanced users to want to add their own keys for development purposes, but keep in mind that less advanced users may be tricked into doing this if appropriate warnings are not provided. Remember you will always need to store the domains and the
owner for each key so that you can prevent a key from being used on the wrong domain, and so that the user knows who owns the key.

##### Approach one
The simplest approach would be to simply verify all the keys we've distributed locally and then directly bake them into your wallet code. This has the advantage of being quite secure, however the direct disadvantage is that if a key is revoked or the keys change for any reason your user is stuck until
you release an update.

##### Pros:
* Wallet signature logic is very simple

##### Cons:
* Key revocation may result in needing to push emergency updates to your wallet (remember Apple App store can be slow to accept updates)

##### Approach two
The second approach would be to generate your own ECC key pair and hard code it's public key into your app. You would then verify our (and others) keys in your development environment and if valid publish them to your own API, signed by your own ECC key. Wallets would then verify against the keys from
your API each time they wanted to verify a payment request. This allows for relatively quick changing of which keys are considered valid by simply updating your own API.

##### Pros:
* Usable across multiple providers
* Pretty reasonable key update time

##### Cons:
* Still have cases where keys could be out of date for hours (or days for some wallets)

##### Approach three
The third approach is to bake our PGP keys into your wallet. On first boot the wallet would retrieve our signing keys and their signatures and verify them. Once verified the app would store the SHA256 hash of the keys. The wallet could then periodically retrieve our key list and only re-validate them
if the SHA256 hash is different than the one previously stored.
##### Pros:
* Always up to date
##### Cons:
* Potentially need a specific implementation per-provider

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
