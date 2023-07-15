"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const INVALID_MNEMONIC = "Invalid mnemonic";
const INVALID_ENTROPY = "Invalid entropy";
const INVALID_CHECKSUM = "Invalid mnemonic checksum";
const WORDLIST_REQUIRED =
  "A wordlist is required but a default could not be found.\n" +
  "Please pass a 2048 word array explicitly.";

const webcrypto = crypto;
// const webcrypto = Crypto;
function normalize(str) {
  return (str || "").normalize("NFKD");
}
function lpad(str, padString, length) {
  while (str.length < length) {
    str = padString + str;
  }
  return str;
}
function binaryToByte(bin) {
  return parseInt(bin, 2);
}
function bytesToBinary(bytes) {
  return bytes.map((x) => lpad(x.toString(2), "0", 8)).join("");
}
async function deriveChecksumBitsAsync(entropyBuffer) {
  const ENT = entropyBuffer.length * 8;
  const CS = ENT / 32;
  const hash = await webcrypto.subtle.digest(
    "SHA-256",
    new Uint8Array(
      entropyBuffer.buffer,
      entropyBuffer.byteOffset,
      entropyBuffer.byteLength
    )
  );
  return bytesToBinary(Array.from(new Uint8Array(hash))).slice(0, CS);
}
function salt(password) {
  return "mnemonic" + (password || "");
}
async function mnemonicToSeedAsync(mnemonic, password) {
  const mnemonicBuffer = Buffer.from(normalize(mnemonic), "utf8");
  const saltBuffer = Buffer.from(salt(normalize(password)), "utf8");
  const key = await webcrypto.subtle.importKey(
    "raw",
    new Uint8Array(
      mnemonicBuffer.buffer,
      mnemonicBuffer.byteOffset,
      mnemonicBuffer.byteLength
    ),
    "PBKDF2", // { name: 'PBKDF2' },
    false,
    ["deriveBits", "deriveKey"]
  );
  const seedBits = await webcrypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: new Uint8Array(
        saltBuffer.buffer,
        saltBuffer.byteOffset,
        saltBuffer.byteLength
      ),
      iterations: 2048,
      hash: "SHA-512",
    },
    key,
    512
  );
  return Buffer.from(seedBits);
}
exports.mnemonicToSeedAsync = mnemonicToSeedAsync;
async function mnemonicToEntropyAsync(mnemonic, wordlist) {
  wordlist = wordlist || DEFAULT_WORDLIST;
  if (!wordlist) {
    throw new Error(WORDLIST_REQUIRED);
  }
  const words = normalize(mnemonic).split(" ");
  if (words.length % 3 !== 0) {
    throw new Error(INVALID_MNEMONIC);
  }
  // convert word indices to 11 bit binary strings
  const bits = words
    .map((word) => {
      const index = wordlist.indexOf(word);
      if (index === -1) {
        throw new Error(INVALID_MNEMONIC);
      }
      return lpad(index.toString(2), "0", 11);
    })
    .join("");
  // split the binary string into ENT/CS
  const dividerIndex = Math.floor(bits.length / 33) * 32;
  const entropyBits = bits.slice(0, dividerIndex);
  const checksumBits = bits.slice(dividerIndex);
  // calculate the checksum and compare
  const entropyBytes = entropyBits.match(/(.{1,8})/g).map(binaryToByte);
  if (entropyBytes.length < 16) {
    throw new Error(INVALID_ENTROPY);
  }
  if (entropyBytes.length > 32) {
    throw new Error(INVALID_ENTROPY);
  }
  if (entropyBytes.length % 4 !== 0) {
    throw new Error(INVALID_ENTROPY);
  }
  const entropy = Buffer.from(entropyBytes);
  const newChecksum = deriveChecksumBitsAsync(entropy);
  if (newChecksum !== checksumBits) {
    console.log(entropy.toString("hex"));
    console.log("Expected " + checksumBits + " actual: " + newChecksum);
    throw new Error(INVALID_CHECKSUM);
  }
  return entropy.toString("hex");
}
exports.mnemonicToEntropyAsync = mnemonicToEntropyAsync;
async function entropyToMnemonicAsync(entropy, wordlist) {
  if (!Buffer.isBuffer(entropy)) {
    entropy = Buffer.from(entropy, "hex");
  }
  wordlist = wordlist;
  if (!wordlist) {
    throw new Error(WORDLIST_REQUIRED);
  }
  // 128 <= ENT <= 256
  if (entropy.length < 16) {
    throw new TypeError(INVALID_ENTROPY);
  }
  if (entropy.length > 32) {
    throw new TypeError(INVALID_ENTROPY);
  }
  if (entropy.length % 4 !== 0) {
    throw new TypeError(INVALID_ENTROPY);
  }
  const entropyBits = bytesToBinary(Array.from(entropy));
  const checksumBits = await deriveChecksumBitsAsync(entropy);
  const bits = entropyBits + checksumBits;
  const chunks = bits.match(/(.{1,11})/g);
  const words = chunks.map((binary) => {
    const index = binaryToByte(binary);
    return wordlist[index];
  });
  return words.join(
    " "
  ); /* return wordlist[0] === '\u3042\u3044\u3053\u304f\u3057\u3093' // Japanese wordlist
        ? words.join('\u3000')
        : words.join(' '); */
}
exports.entropyToMnemonicAsync = entropyToMnemonicAsync;
async function generateMnemonicAsync(strength, rng, wordlist) {
  strength = strength || 128;
  if (strength % 32 !== 0) {
    throw new TypeError(INVALID_ENTROPY);
  }
  if (!rng) {
    rng = (size) => {
      const rngValues = new Uint8Array(size);
      webcrypto.getRandomValues(rngValues);
      return Buffer.from(rngValues);
    };
  }
  return entropyToMnemonicAsync(rng(strength / 8), wordlist);
}
exports.generateMnemonicAsync = generateMnemonicAsync;
async function validateMnemonicAsync(mnemonic, wordlist) {
  try {
    await mnemonicToEntropyAsync(mnemonic, wordlist);
  } catch (e) {
    return false;
  }
  return true;
}
exports.validateMnemonicAsync = validateMnemonicAsync;
