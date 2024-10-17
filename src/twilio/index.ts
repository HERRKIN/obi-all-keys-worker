import { Env } from "..";
import { TwilioError, TwilioResponse } from "./types";

//twilio class to handle all twilio related stuff
export class Twilio {
  private endpoints: {
    sms: string;
    voice: string;
  };
  private twilioAccountSid: string;
  private twilioAuthToken: string;
  private twilioFrom: string;
  constructor(env: Env["variables"]) {
    const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM } = env;
    //check all vars are set
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM) {
      throw new Error("Twilio env vars not set");
    }
    this.endpoints = {
      sms:
        "https://api.twilio.com/2010-04-01/Accounts/" +
        TWILIO_ACCOUNT_SID +
        "/Messages.json",
      voice:
        "https://studio.twilio.com/v2/Flows/FW4b9a86c0be976c8510a7675e0be92841/Executions",
    };
    this.twilioAccountSid = TWILIO_ACCOUNT_SID;
    this.twilioAuthToken = TWILIO_AUTH_TOKEN;
    this.twilioFrom = TWILIO_FROM;
  }
  async sendText({
    message,
    number,
  }: {
    message: string;
    number: string;
  }): Promise<TwilioResponse | TwilioError> {
    const endpoint =
      "https://api.twilio.com/2010-04-01/Accounts/" +
      this.twilioAccountSid +
      "/Messages.json";

    let encoded = new URLSearchParams();
    encoded.append("To", number);
    encoded.append("From", this.twilioFrom);
    encoded.append("Body", `${message}`);

    let token = btoa(this.twilioAccountSid + ":" + this.twilioAuthToken);

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
      const resData = (await res.json()) as TwilioResponse | TwilioError;

      // check if its of type TwilioError
      if ("code" in resData) {
        throw new Error("Error sending SMS. " + resData.message);
      }

      return resData as TwilioResponse;
    } catch (e) {
      throw new Error("Error sending SMS. " + e);
    }
  }
  async requestCall({
    number,
    message,
  }: {
    message: string;
    number: string;
  }): Promise<TwilioResponse | TwilioError> {
    let encoded = new URLSearchParams();
    encoded.append("To", number);
    encoded.append("From", this.twilioFrom);
    encoded.append("Parameters", JSON.stringify({ number: message }));

    let token = btoa(this.twilioAccountSid + ":" + this.twilioAuthToken);

    const request = {
      body: encoded,
      method: "POST",
      headers: {
        Authorization: `Basic ${token}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    };
    try {
      const res = await fetch(this.endpoints.voice, request);
      const resData = (await res.json()) as TwilioResponse | TwilioError;
      // check if its of type TwilioError
      if ("code" in resData) {
        throw new Error("Error making voice call. " + resData.message);
      }

      return resData;
    } catch (e) {
      throw new Error("Error making voice call. " + e);
    }
  }
}
