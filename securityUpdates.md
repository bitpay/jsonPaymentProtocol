# Security Updates

### 2019-02-01
Recently a bitcoin community member discussed a potential bug in our modified BIP-70 and JSON payment protocol flows when implemented by a
malicious server. This bug would not affect BitPay itself, but has the potential to affect wallets using our payment process
recommendations. This was due to an implicit trust by the client that the server is not malicious. 

A proposed malicious flow is as follows:

1. In person Eve asks Adam if she can buy his bitcoin, hands him cash provides a payment protocol url
2. Adams wallet interacts with the url, and sends signed transaction to the server for verification
3. Server rejects signed transaction, but secretly stores it
4. Wallet notifies Adam that the transaction was rejected
5. Eve asks for her money back, Adam complies since transaction was rejected
6. Later Eve has the server broadcast the signed transaction, Eve now has both the cash and the crypto

To resolve this we're advising a change to the payment protocol flow to protect users.

#### Existing flow:

1. Wallet requests payment data
2. Wallet creates unsigned transaction
2. Wallet signs transaction
3. Wallet sends **SIGNED** transaction to server for verification
4. Server verifies or rejects payment and notifies wallet
5. Wallet broadcasts if server accepts, stops if rejected 

#### Updated flow:

1. Wallet requests payment data
2. Wallet creates unsigned transaction
3. Wallet signs transaction
4. Wallet sends **UNSIGNED** transaction and weighted size of signed transaction to server for verification
5. Server verifies or rejects payment and notifies wallet
6. Wallet sends **SIGNED** transaction to server and broadcasts to p2p at the same time

This new flow prevents a malicious server from being able to broadcast without the user's knowledge as it now only ever has access to the
unsigned transaction before accepting or rejecting. This is also why we recommend broadcasting to the p2p network at the same time as the
sending the payment via payment protocol to the server. Since you've already gotten approval you should be free to broadcast and ignore
any rejections by the server.

While JSON payment protocol is vulnerable, trying to use a malicious server is less viable than the modified BIP-70 flow due to the need
for each wallet to whitelist ECC keys. Since BIP-70 only requires a valid x509 certificate, anyone with a domain could run a malicious
server. If your wallet uses the modified BIP-70 flow you should update as soon as possible.

Our servers will remain backwards compatible with the old flow for the interim, however to protect users we highly recommend wallets update
to use the more secure flow.

More details of *what* exactly needs to be sent *where* can be found in the updated specification document.
