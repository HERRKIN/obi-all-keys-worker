import { parseData } from "./utils";

const { totp } = require("otplib");
const cryptoJS = require("crypto-js");
import jsSHA from "jssha";
const url = "https://obi-hastebin.herokuapp.com//raw/";
const options = {
  headers: {},
};
const secret = "12766cbqtpp5x6fplhkbmecj67290gynn090dlhrdj17u36fbcdpg";

export const DecryptMessage = async (body: string) => {
  //   if (body.substr(0, 10) === "plaintext:") {
  //     return callback(null, { decrypted_trigger: body.substr(10) });
  //   }
  let res = await fetch(url + body, options);
  let data = await res.text();

  console.log(data);
  //   if (data.substr(0, 10) === "plaintext:") {
  //     return callback(null, { decrypted_trigger: data.substr(10) });
  //   }

  //   totp.options = {
  //     digits: 64,
  //     step: 600,
  //     window: 1,
  //     crypto: cryptoJS,
  //   }; //high step for testing. Lower for production.
  //   const token = totp.generate(secret);
  //   try {
  //   totp.verify({ token, secret });
  //   } catch (err) {
  //     // Possible errors
  //     // - options validation
  //     // - "Invalid input - it is not base32 encoded string"
  //     console.error("TOTP error: " + err.toString());
  //     return callback(null, { error: err.toString() });
  //   }
  console.log(parseData(data));
  //   return decryptWithAES(data,);
  return parseData(data);
};
