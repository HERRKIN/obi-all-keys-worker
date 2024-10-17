import { Coin } from "@cosmjs/amino";
import { entropyToMnemonic, wordlists } from "bip39";

import { sha256 } from "js-sha256";

import { Wallet } from "secretjs";

const englishWords = wordlists["english"];

export const getWalletData = async ({ entropyMod }: { entropyMod: string }) => {
  // const entropyMod = sendToNumber.replace("+", "") + answer;
  //   +context.DETERMINISTIC_ENTROPY;
  const hash = sha256.hex(entropyMod);
  const mnem = entropyToMnemonic(hash, englishWords);

  const wallet = await new Wallet(mnem);

  return {
    wallet,
  };
};
