There must be a .dev.vars file with the following vars

```
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
TWILIO_FROM
HASTEBIN_URL
```

```
There is only one endpoint, "/:intent"
```

We have common attributes `to`, `via` and `answer`.

`via` is one of `sms`,`voice` or `telegram`

`to` is the phone number or the chat id in case `via` is `telegram`

`answer` is the answer of the security question

To get the pubkey we use `/pubkey` sending the following body

```
{
  to,
  answer,
  via
}
```

#

To get a signature we use `sign` sending the body

```
{
  to,
  answer,
  via,
  message
}
```

`message` is the uint8array (in base64) message to be signed.

#

To get a signature we use `sign` sending the body\*

```
{
  to,
  answer,
  via,
  encryptedMessage
}
```

`encryptedMessages` an array of messages encrypted using the pubkey encoded in base64

All endpoints responds with

```
{
  "message":"code sent to xxxxxxxxx"
}
```

# Magic code

To get the intent executed we need to provide the code, we use the same exact endpoint and data providing the query parameter `code` like in `/intent?code=xxxx...`

The responses change this time

For `/pubkey?code=12345678`

```
{
  "pubkey":"the pubkey in base64"
}
```

For `/sign?code=12345678`

```
{
  "signature":"the signature in base64"
}
```

For `/decrypt?code=12345678`

```
{
  "data":["the decrypted message in plain text"]
}
```
