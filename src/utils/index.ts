const CryptoJS = require("crypto-js");
// export const decryptWithAES = (ciphertext, passphrase) => {
//   try {
//     //console.error("Trying to decrypt: " + ciphertext + " with passphrase: " + passphrase);
//     const bytes = CryptoJS.AES.decrypt(ciphertext, passphrase);
//     const originalText = bytes.toString(CryptoJS.enc.Utf8);
//     console.log("Decrypted: " + originalText);
//     return { decrypted_trigger: originalText };
//   } catch (err) {
//     console.error("Decrypt error: " + err.toString());
//     return { error: err.toString() };
//   }
// };
interface DefaultOutput {
  answer: string;
  chain: string;
}
interface AddressOutput extends DefaultOutput {
  action: "address";
}
interface SignOutput extends DefaultOutput {
  action: "sign";
  message: string;
}
interface PubOutput extends DefaultOutput {
  action: "pub";
}
interface DebugOutput {
  debug: string;
}
export type OutputType = AddressOutput | SignOutput | PubOutput | DebugOutput;

export const parseData = (data: string): OutputType => {
  const body = data;
  const elements = body.split(/[:,]+/);
  const intent = elements[0];
  //sanitize answer
  const answer = elements[1]
    .replace(/([^a-z0-9áéíóúñü_-\s\.,]|[\s\t\n\f\r\v\0])/gim, "")
    .trim()
    .toLowerCase();

  switch (intent) {
    case "address":
      return {
        action: intent,
        answer,
        chain: elements[2] || "juno-1",
      } as const;

    case "sign":
      return {
        action: intent,
        answer,
        message: elements[2],
        chain: elements[3] || "juno-1",
      };

    case "pub":
      return {
        action: intent,
        answer,
        chain: elements[2] || "juno-1",
      } as const;
    default:
      console.error("Unknown intent: " + intent);
      return { debug: data };
  }
};
interface ChainData {
  rpc: string;
  denom: string;
  prefix: string;
  derivation: number;
}
export const getChainData = (chain: string): ChainData | undefined => {
  switch (chain) {
    case "juno-1":
      return {
        rpc: "https://rpc-juno.itastakers.com/",
        denom: "ujuno",
        prefix: "juno",
        derivation: 118,
      };

    case "uni-3":
      return {
        rpc: "https://rpc-juno.itastakers.com/",
        denom: "ujunox",
        prefix: "juno",
        derivation: 118,
      };
    case "phoenix-1":
      return {
        rpc: "https://terra2-rpc.dalnim.finance/",
        denom: "uluna",
        prefix: "terra",
        derivation: 330,
      };
    case "pisco-1":
      return {
        rpc: "https://pisco-rpc.dalnim.finance/",
        denom: "uluna",
        prefix: "terra",
        derivation: 330,
      };
    case "osmo-test-5":
      return {
        rpc: "https://rpc.osmotest5.osmosis.zone/",
        denom: "uosmo",
        prefix: "osmo",
        derivation: 118,
      };
    default:
      console.error("Unknown chain id: " + chain);
  }
};
