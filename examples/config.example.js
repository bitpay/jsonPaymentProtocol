module.exports = {
  network: 'test',
  currency: 'BTC',
  rpcServer: {
    // should set this to match your own bitcoin rpc settings
    username: 'fakeUser',
    password: 'fakePassword',
    ipAddress: '127.0.0.1',
    port: '18332'
  },
  trustedKeys: {
    // The idea is that you or the wallet provider will populate this with keys that are trusted, we have provided a few possible approaches
    // in the specification.md document within the 'key-storing suggestions' section

    // Each key here is the pubkey hash so that we can do quick look-ups using the x-identity header sent in the payment request
    'mh65MN7drqmwpCRZcEeBEE9ceQCQ95HtZc': {
      // This is displayed to the user, somewhat like the organization field on an SSL certificate
      owner: 'BitPay (TESTNET ONLY - DO NOT TRUST FOR ACTUAL BITCOIN)',
      // Which bitcoin networks is this key valid for (regtest, test, main)
      networks: ['test'],
      // Which domains this key is valid for
      domains: ['test.bitpay.com'],
      // The actual public key which should be used to validate the signatures
      publicKey: '03159069584176096f1c89763488b94dbc8d5e1fa7bf91f50b42f4befe4e45295a',
    }
  }
};
