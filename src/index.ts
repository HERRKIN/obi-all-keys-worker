/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `wrangler dev src/index.ts` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `wrangler deploy src/index.ts --name my-worker` to deploy your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */
import { entropyToMnemonicAsync } from "./utils/bip39";
import { DecryptMessage } from "./decryptMessage";
import { english_words } from "./words.json";
import { sendText } from "./twilio";
import { sha256 } from "js-sha256";
import { getChainData } from "./utils";
import { Slip10RawIndex } from "@cosmjs/crypto";
import { base64ToBytes, bytesToBase64 } from "@tendermint/belt";
import { ecdsaSign } from "secp256k1";

import {
  AminoMsg,
  Secp256k1HdWallet,
  coins,
  pubkeyToAddress,
  pubkeyType,
} from "@cosmjs/amino";
import { SigningStargateClient, StargateClient } from "@cosmjs/stargate";

// import { createMasterKeyFromMnemonic } from "@tendermint/sig";
// import { createWalletFromMnemonic } from "@tendermint/sig";
import { createWalletFromMnemonic } from "@tendermint/sig";

const DEBUG_MODE = true;
export interface Env {
  // Example binding to KV. Learn more at https://developers.cloudflare.com/workers/runtime-apis/kv/
  // MY_KV_NAMESPACE: KVNamespace;
  //
  // Example binding to Durable Object. Learn more at https://developers.cloudflare.com/workers/runtime-apis/durable-objects/
  // MY_DURABLE_OBJECT: DurableObjectNamespace;
  //
  // Example binding to R2. Learn more at https://developers.cloudflare.com/workers/runtime-apis/r2/
  // MY_BUCKET: R2Bucket;
  //
  // Example binding to a Service. Learn more at https://developers.cloudflare.com/workers/runtime-apis/service-bindings/
  // MY_SERVICE: Fetcher;
}

// const client = Twilio(accountSid, authToken);
type requestBody = {
  To: string;
  Parameters: { trigger_body: { body: string; voice: boolean } };
};

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    const contentType = request.headers.get("content-type");
    if (contentType !== "application/json") {
      return new Response("Bad Request", { status: 400 });
    }
    // console.log(JSON.stringify(env), JSON.stringify(request.cf));
    // grab text and number from request body
    const req: requestBody = await request.json();
    // console.log(req);
    const { To, Parameters } = req;
    // console.log(text, number);
    // // return new Response(JSON.stringify(request.cf), { status: 200 });
    // return sendText({ message: text, number: number });
    const decryptedMessage = await DecryptMessage(
      req.Parameters.trigger_body.body
    );
    // if res.action is defined, then we have a valid response
    if (!("action" in decryptedMessage)) {
      return new Response(JSON.stringify(decryptedMessage), { status: 400 });
    }

    //TODO: check below
    // Occassionally, US numbers will be passed without the preceding
    // country code - check for this eventuality and fix it
    // We need 100% consistency of number, after all
    const sendToNumber = To[0] === "+" ? To : `+1${To}`;
    let entropyMod = sendToNumber.substring(1) + +decryptedMessage.answer;
    //   +context.DETERMINISTIC_ENTROPY;
    var hash = sha256.hex(entropyMod);

    let mnem = await entropyToMnemonicAsync(hash, english_words);

    const chainData = getChainData(decryptedMessage.chain);
    if (!chainData) {
      return new Response(`Invalid Chain ${decryptedMessage.chain}`, {
        status: 400,
      });
    }
    const { rpc, prefix, denom, derivation } = chainData;

    console.log(decryptedMessage);

    const this_hdpath = [
      Slip10RawIndex.hardened(44),
      Slip10RawIndex.hardened(derivation),
      Slip10RawIndex.hardened(0),
      Slip10RawIndex.normal(0),
      Slip10RawIndex.normal(0),
    ];
    // IMPORTANT: callback needs to make sure it is sending back to FROM number, and not just replying to a potential spoofer
    const options = {
      /** The password to use when deriving a BIP39 seed from a mnemonic. */
      bip39Password: "",
      /** The bech32 address prefix (human readable part). Defaults to "cosmos". */
      prefix: prefix,
      hdPaths: [this_hdpath],
    };

    const wallet = await Secp256k1HdWallet.fromMnemonic(mnem, options);

    const raw_sign_wallet = await createWalletFromMnemonic(
      mnem,
      prefix,
      "m/44'/" + derivation + "'/0'/0/0"
    );
    console.log(
      raw_sign_wallet.address,
      raw_sign_wallet.publicKey,
      wallet.mnemonic
    );

    const client = await SigningStargateClient.connectWithSigner(rpc, wallet);

    let [firstAccount] = await wallet.getAccounts();

    const wallet_address = firstAccount.address;

    const check_account = await client.getAccount(wallet_address);

    const fee = {
      amount: coins(4000, denom),
      gas: "222000", // 222k
    };
    let balance = await client.getBalance(wallet_address, denom);

    console.log(balance);

    if (DEBUG_MODE) {
      console.error("ready to check account: " + JSON.stringify(check_account));
      console.error("balance comes back as: " + JSON.stringify(balance));
    }

    if (
      check_account === null ||
      (balance.amount === "0" && balance.denom === denom)
    ) {
      console.log("account not found, sending to fee lender");
      try {
        let response = await fetch(
          "https://fee-lender-worker.obiwallet.workers.dev/",
          {
            method: "POST",
            headers: {
              "Content-Type": "text/plain",
            },
            body: decryptedMessage.chain + "," + wallet_address,
          }
        );

        console.error("response from fee lender: " + JSON.stringify(response));
        const check_account = await client.getAccount(wallet_address);
        if (check_account != null) {
          client.sendTokens(
            wallet_address,
            wallet_address,
            coins(100, denom),
            fee,
            ""
          );
        }
      } catch (error) {
        console.error("error funding account: ", error);
      }
    } else if (check_account.pubkey === null) {
      const memo = "Activating Account";
      await client.sendTokens(
        wallet_address,
        wallet_address,
        coins(100, denom),
        fee,
        memo
      );
    }
    // sanity check
    if (raw_sign_wallet.address != wallet_address) {
      console.error("ERROR: key mismatch!");
      // this_intent = "fail";
    }
    if (DEBUG_MODE) {
      console.error(
        "pubkey in base64: " + bytesToBase64(raw_sign_wallet.publicKey)
      );
    }

    switch (decryptedMessage.action) {
      case "address":
        console.log({ sender_address: wallet_address });
        break;
      case "pub":
        console.log({ pubkey: bytesToBase64(raw_sign_wallet.publicKey) });
        break;
      case "sign":
        console.error(
          "sanity check, bytes to sign: " +
            JSON.stringify(decryptedMessage.message) +
            ", pubkey: " +
            raw_sign_wallet.publicKey +
            " and signature pending..."
        );
        const signedBytes = await ecdsaSign(
          base64ToBytes(decryptedMessage.message),
          raw_sign_wallet.privateKey
        );
        const convertedBytes = await bytesToBase64(signedBytes.signature);
        console.log({ signed_message: convertedBytes });
        break;
      default:
        console.log({
          sender_address:
            "create_use_key failed. Intent is: " + decryptedMessage.action,
          pubkey:
            "create_use_key failed. Intent is: " + decryptedMessage.action,
          signed_message:
            "create_use_key failed. Intent is: " + decryptedMessage.action,
        });
    }

    return new Response("Hello world!", { status: 200 });
  },
};
