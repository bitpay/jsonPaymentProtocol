# BIP-70 Modifications

In addition to JSON payment protocol, BitPay Bitcoin and Bitcoin Cash invoices use a mildly modified version of [BIP-70](https://github.com/bitcoin/bips/blob/master/bip-0070.mediawiki). We include
one additional field which specifies the fee rate the transaction must have in order to be accepted. This minimum fee is required to ensure a reasonable confirmation time for payments which are sent to BitPay.
To further ensure this we also require payments be made with confirmed inputs. Payments using unconfirmed inputs, such as unconfirmed change, will be rejected. Bitcoin (BTC) invoices are temporarily exempt from these rules to allow wallets time to adjust.

* `required_fee_rate` - The minimum fee per byte required on your transaction. Bitcoin Cash payments will be rejected if fee rate included for the transaction is not at least this value.  _May be fractional value_ ie 0.123 sat/byte

## Application Logic
Please note that you should **NOT** broadcast a payment to the P2P network if we respond with an http status code other than `200`. Broadcasting a payment before getting a success notification back from the server will
lead to a failed payment for the sender. The sender will bear the cost of paying transaction fees yet again to get their money back.
