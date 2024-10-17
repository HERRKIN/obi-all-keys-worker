/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `wrangler dev src/index.ts` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `wrangler deploy src/index.ts --name my-worker` to deploy your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

import { base64ToBytes, bytesToBase64 } from "@tendermint/belt";

import { getWalletData } from "./walletHandling";
import { Twilio } from "./twilio";
import { TwilioError, TwilioResponse } from "./twilio/types";
import { sendTelegramMessage } from "./telegram";
import { Context, Hono } from "hono";
import { cors } from 'hono/cors'
import { ecdsaSign } from "secp256k1";
import {
  decryptM,
  getSendToNumber,
  getUUID,
  isValidEnumValue,
  validateStoredData,
} from "./utils";

export enum ComunicationType {
  SMS = "sms",
  VOICE = "voice",
  TELEGRAM = "telegram",
}

export enum Intents {
  Handle = "handle",
  Sign = "sign",
  Pubkey = "pubkey",
  Decrypt = "decrypt",
}
export interface Env {
  Bindings: {
    MAGIC_CODES_KV: KVNamespace;
  };
  variables: {
    TWILIO_ACCOUNT_SID: string;
    TWILIO_AUTH_TOKEN: string;
    TWILIO_FROM: string;
    TELEGRAM_BOT_TOKEN: string;
  };
}
type ComunicationData = {
  type: ComunicationType;
  message: string;
  number: string;
};

const app = new Hono<Env>();

const saveDataAndSendCode = async ({
  pubkey,
  sendToNumber,
  via,
  c,
  data,
}: {
  pubkey: string;
  sendToNumber: string;
  via: ComunicationType;
  c: Context;
  data: unknown;
}) => {
  const id = await getUUID();
  await c.env.MAGIC_CODES_KV.put(pubkey + "-" + id, JSON.stringify(data), {
    expirationTtl: 300,
  });

  await manageCommunication(
    {
      type: via,
      message: id,
      number: sendToNumber,
    },
    c,
  );
  return c.json({ message: "Code sent to " + sendToNumber });
};

const checkEmptyOrUndefined = (value: string | undefined) => {
  return value === "" || value === undefined;
};
const getDeterministicEntropy = (shares: {
  [key: string]: string; // Add index signature
}): string => {
  let concatenated = new Uint8Array();
  for (const key in shares) {
    const decoded = base64ToBytes(shares[key].trim());
    const newConcatenated = new Uint8Array(
      concatenated.length + decoded.length,
    );
    newConcatenated.set(concatenated, 0);
    newConcatenated.set(decoded, concatenated.length);
    concatenated = newConcatenated;
  }
  return bytesToBase64(concatenated);
};

const handler = async (c: Context) => {
  if (
    checkEmptyOrUndefined(c.env.SHARE_A) ||
    checkEmptyOrUndefined(c.env.SHARE_B) ||
    checkEmptyOrUndefined(c.env.SHARE_C) ||
    checkEmptyOrUndefined(c.env.SHARE_D)
  ) {
    return c.json(
      {
        message: "Please check the shares in the env variables",
      },
      400,
    );
  }

  const intent = c.req.param("intent") as Intents;
  // code is optional
  const query = c.req.query();
  // check if the code is in the query and its 8chars long
  if (Object.keys(query).includes("code") && query.code.length < 8) {
    return c.json(
      {
        message: "Invalid code",
      },
      400,
    );
  }

  const body = await c.req.json();
  if (!intent || !isValidEnumValue(Intents, intent)) {
    return c.text("Invalid request");
  }

  // validate the intent is valid using the enum
  if (isValidEnumValue(Intents, intent) === false) {
    return c.json(
      {
        message: "Invalid intent " + intent,
      },
      400,
    );
  }
  const { answer, to, via, ...rest } = body;
  // validate the communication type
  if (isValidEnumValue(ComunicationType, via) === false) {
    return c.json({ message: "Invalid communication type " + via });
  }
  if (!answer || !to) {
    return c.json({
      message: "Invalid request to " + intent,
      req: body,
    });
  }
  const sendToNumber = getSendToNumber(to, via);
  const entropy = getDeterministicEntropy({
    SHARE_A: c.env.SHARE_A,
    SHARE_B: c.env.SHARE_B,
    SHARE_C: c.env.SHARE_C,
    SHARE_D: c.env.SHARE_D,
  });

  const { wallet } = await getWalletData({
    entropyMod: entropy + sendToNumber.replace("+", "") + answer,
  });

  const { publicKey } = wallet;
  const pubkey = bytesToBase64(publicKey);

  switch (intent) {
    case Intents.Handle: {
      const { signHashes, decryptMessages } = rest;
      const data = {
        intent,
        body: {
          to,
          via,
          answer,
          signHashes,
          decryptMessages,
        },
      };

      if (!query.code) {
        return await saveDataAndSendCode({
          pubkey,
          sendToNumber,
          via,
          c,
          data,
        });
      }
      try {
        await validateStoredData(pubkey, query.code, data, c);
      } catch (e) {
        const error = e as unknown as Error;
        return c.json({ message: error.message }, 404);
      }

      const [signedHashes, decryptedMessages] = await Promise.all([
        await Promise.all(
          signHashes.map(async (hash: string) => {
            return ecdsaSign(base64ToBytes(hash), wallet.privateKey);
          }),
        ),
        await decryptMessages(decryptMessages, wallet),
      ]);

      return c.json({
        publicKey: pubkey,
        signedHashes,
        decryptedMessages,
      });
    }

    case Intents.Sign: {
      const { message } = rest;
      if (!message) {
        return c.json({ message: "Invalid request to " + intent });
      }
      const data = {
        intent,
        body: {
          to,
          via,
          answer,
          message,
        },
      };

      if (!query.code) {
        return await saveDataAndSendCode({
          pubkey,
          sendToNumber,
          via,
          c,
          data,
        });
      }
      try {
        await validateStoredData(pubkey, query.code, data, c);
      } catch (e) {
        const error = e as unknown as Error;
        return c.json({ message: error.message }, 404);
      }

      const signedData = ecdsaSign(base64ToBytes(message), wallet.privateKey);
      const signature = bytesToBase64(signedData.signature);
      return c.json({ signature });
    }
    case Intents.Pubkey: {
      const data = {
        intent,
        body: {
          to,
          via,
          answer,
        },
      };
      if (!query.code) {
        return await saveDataAndSendCode({
          pubkey,
          sendToNumber,
          via,
          c,
          data,
        });
      }
      try {
        await validateStoredData(pubkey, query.code, data, c);
      } catch (e) {
        const error = e as unknown as Error;
        return c.json({ message: error.message }, 404);
      }
      return c.json({ pubkey });
    }
    case Intents.Decrypt: {
      const { encryptedMessages } = rest;
      if (!encryptedMessages || encryptedMessages.length === 0) {
        return c.json({ message: "Invalid request to " + intent }, 400);
      }
      const data = {
        intent,
        body: {
          to,
          via,
          answer,
          encryptedMessages,
        },
      };
      if (!query.code) {
        return await saveDataAndSendCode({
          pubkey,
          sendToNumber,
          via,
          c,
          data,
        });
      }
      try {
        await validateStoredData(pubkey, query.code, data, c);
      } catch (e) {
        const error = e as unknown as Error;
        return c.json({ message: error.message }, 404);
      }
      const decryptedMessages = await decryptM(encryptedMessages, wallet);

      return c.json({ data: decryptedMessages });
    }
    default: {
      return c.json({ message: "Invalid intent", intent });
    }
  }
};

app.options("*", async (c) => {
  return c.json({ message: "ok" });
});
app.post("/:intent", handler, cors());
app.post("/:intent/", handler, cors());

app.fire();
export default app;

const manageCommunication = async (
  data: ComunicationData,
  c: Context,
): Promise<TwilioResponse | TwilioError | undefined> => {
  const { type, message, number } = data;
  switch (type) {
    case ComunicationType.SMS: {
      console.log("SMS");
      const twilio = new Twilio(c.env);
      const twilioResponse = await twilio.sendText({
        message: `Your magic Obi code is: ${message}`,
        number,
      });
      return twilioResponse;
    }
    case ComunicationType.VOICE: {
      console.log("VOICE");
      const twilio = new Twilio(c.env);
      return await twilio.requestCall({
        message,
        number,
      });
    }
    case ComunicationType.TELEGRAM:
      console.log("TELEGRAM");
      await sendTelegramMessage(number, `Your magic Obi code is:`, c.env);
      await sendTelegramMessage(number, `${message}`, c.env);
      await sendTelegramMessage(number, `Copy and paste it in the app`, c.env);
      return undefined;
    default: {
      throw new Error("Invalid communication type " + type);
    }
  }
};
