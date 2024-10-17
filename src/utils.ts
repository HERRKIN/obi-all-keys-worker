import { Context } from "hono";
import { base64ToBytes } from "@tendermint/belt";
import { ComunicationType } from ".";

export function isValidEnumValue<T extends Record<string, unknown>>(
  enumObj: T,
  value: unknown,
): value is T[keyof T] {
  return Object.values(enumObj).includes(value);
}
export const getEcies = async () => {
  const [eciesWasm, bg] = await Promise.all([
    import("ecies-wasm"),
    // @ts-expect-error
    import("ecies-wasm/ecies_wasm_bg.wasm"),
  ]);
  await eciesWasm.default(bg.default);
  return eciesWasm;
};
// unique 8 digit number
export const getUUID = (): string => {
  // Create a new Uint32Array with one element
  const arr = new Uint32Array(1);
  window.crypto.getRandomValues(arr);

  // Get the random number from the array
  let randomNumber: number = arr[0];

  const randomNumberStr: string = randomNumber
    .toString()
    .padStart(8, "0")
    .slice(0, 8);
  return randomNumberStr;
};
export const getSendToNumber = (To: string, type: ComunicationType) => {
  if (type === ComunicationType.TELEGRAM) {
    return To;
  }
  const sendToNumber = To[0] === "+" ? To : `+1${To}`;
  return sendToNumber;
};

export const validateStoredData = async (
  pubkey: string,
  code: string,
  data: unknown,
  c: Context,
): Promise<void | Response> => {
  const r = await c.env.MAGIC_CODES_KV.get(`${pubkey}-${code}`);

  if (!r) {
    throw new Error("No code found, may have already been used");
  }
  // we need to compare the received data with the stored data
  if (JSON.stringify(data) !== r.toString()) {
    throw new Error("Data does not match");
  }
  await c.env.MAGIC_CODES_KV.delete(`${pubkey}-${code}`);
  return;
};
export const decryptM = async (
  encryptedMessages: string[],
  wallet: { privateKey: Uint8Array },
) => {
  const ecies = await getEcies();
  return Promise.all(
    encryptedMessages.map(async (encryptedMessage: string) => {
      const decrypted = ecies.decrypt(
        wallet.privateKey,
        base64ToBytes(encryptedMessage),
      );
      return new TextDecoder().decode(decrypted);
    }),
  );
};
