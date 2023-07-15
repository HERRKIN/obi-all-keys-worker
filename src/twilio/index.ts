import { TwilioError, TwilioResponse } from "./types";

const accountSid = "ACa8c9304882b8eea384a020ce34981f2e";
const authToken = "50a1367ee21a1607228524d62dedad90";
const FROM = "+19148638557";
const RECIPIENT = "+56971296872";

export async function sendText({
  message,
  number,
}: {
  message: string;
  number?: string;
}) {
  const endpoint =
    "https://api.twilio.com/2010-04-01/Accounts/" +
    accountSid +
    "/Messages.json";

  let encoded = new URLSearchParams();
  encoded.append("To", number || RECIPIENT);
  encoded.append("From", FROM);
  encoded.append("Body", message);

  let token = btoa(accountSid + ":" + authToken);

  const request = {
    body: encoded,
    method: "POST",
    headers: {
      Authorization: `Basic ${token}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
  };
  try {
    const res = await fetch(endpoint, request);
    const resData: TwilioResponse | TwilioError = await res.json();
    console.log(JSON.stringify(resData));

    if ("code" in resData) {
      return new Response(resData.message, { status: 400 });
    }

    return new Response(JSON.stringify(resData), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify(e), { status: 500 });
  }
}
