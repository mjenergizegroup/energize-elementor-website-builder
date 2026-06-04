import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";

// AES-256-GCM encryption for WP application passwords at rest.
// The key comes from ENCRYPTION_KEY (64 hex chars / 32 bytes).
// Stored format: "v1:<ivHex>:<authTagHex>:<cipherHex>".

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96-bit nonce, recommended for GCM
const FORMAT_VERSION = "v1";

function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex) {
    throw new Error("ENCRYPTION_KEY is not set");
  }
  const key = Buffer.from(hex, "hex");
  if (key.length !== 32) {
    throw new Error(
      "ENCRYPTION_KEY must be 64 hex characters (32 bytes). Generate with: openssl rand -hex 32",
    );
  }
  return key;
}

export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return [
    FORMAT_VERSION,
    iv.toString("hex"),
    authTag.toString("hex"),
    encrypted.toString("hex"),
  ].join(":");
}

export function decrypt(payload: string): string {
  const key = getKey();
  const parts = payload.split(":");
  if (parts.length !== 4 || parts[0] !== FORMAT_VERSION) {
    throw new Error("Invalid encrypted payload format");
  }
  const [, ivHex, authTagHex, cipherHex] = parts;
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(cipherHex, "hex")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}
