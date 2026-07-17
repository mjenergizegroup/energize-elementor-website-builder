import "server-only";
import { isIP } from "node:net";
import { lookup } from "node:dns/promises";

const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
]);

export interface RemoteImage {
  bytes: Uint8Array;
  mimeType: string;
  finalUrl: string;
}

export type AddressResolver = (hostname: string) => Promise<string[]>;

export async function assertPublicImageUrl(
  value: string,
  resolver: AddressResolver = resolveAddresses,
): Promise<URL> {
  const url = new URL(value);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Media URL must use HTTP or HTTPS.");
  }
  if (url.username || url.password) throw new Error("Media URL cannot contain credentials.");
  if (url.port && url.port !== "80" && url.port !== "443") {
    throw new Error("Media URL uses a blocked port.");
  }
  const addresses = isIP(url.hostname) ? [url.hostname] : await resolver(url.hostname);
  if (addresses.length === 0 || addresses.some(isPrivateAddress)) {
    throw new Error("Media URL resolves to a private or unavailable address.");
  }
  return url;
}

export async function fetchRemoteImage(
  value: string,
  options: {
    fetchImpl?: typeof fetch;
    resolver?: AddressResolver;
    maxBytes?: number;
  } = {},
): Promise<RemoteImage> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const resolver = options.resolver ?? resolveAddresses;
  const maxBytes = options.maxBytes ?? MAX_IMAGE_BYTES;
  let current = value;

  for (let redirect = 0; redirect <= 3; redirect += 1) {
    const url = await assertPublicImageUrl(current, resolver);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20_000);
    try {
      const response = await fetchImpl(url, {
        redirect: "manual",
        signal: controller.signal,
        headers: { Accept: "image/avif,image/webp,image/png,image/jpeg,image/gif" },
        cache: "no-store",
      });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location || redirect === 3) throw new Error("Media redirect limit exceeded.");
        current = new URL(location, url).toString();
        continue;
      }
      if (!response.ok || !response.body) throw new Error(`Media fetch returned ${response.status}.`);
      const mimeType = (response.headers.get("content-type") ?? "").split(";")[0].toLowerCase();
      if (!ALLOWED_MIME.has(mimeType)) throw new Error(`Unsupported media type: ${mimeType || "unknown"}.`);
      const contentLength = Number(response.headers.get("content-length") ?? 0);
      if (contentLength > maxBytes) throw new Error("Media file exceeds the size limit.");
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let total = 0;
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        total += part.value.byteLength;
        if (total > maxBytes) {
          await reader.cancel();
          throw new Error("Media file exceeds the size limit.");
        }
        chunks.push(part.value);
      }
      const bytes = new Uint8Array(total);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
      }
      if (!matchesImageSignature(bytes, mimeType)) throw new Error("Media content does not match its declared type.");
      return { bytes, mimeType, finalUrl: url.toString() };
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error("Media redirect limit exceeded.");
}

export function isPrivateAddress(address: string): boolean {
  const normalized = address.toLowerCase().replace(/^\[|\]$/g, "");
  if (normalized === "::1" || normalized === "::" || normalized.startsWith("fe80:")) return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  if (normalized.startsWith("ff") || normalized.startsWith("2001:db8:")) return true;
  const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  const ipv4 = mapped ?? (isIP(normalized) === 4 ? normalized : "");
  if (!ipv4) return false;
  const [a, b, c] = ipv4.split(".").map(Number);
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 0 || b === 168)) ||
    (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224;
}

async function resolveAddresses(hostname: string): Promise<string[]> {
  return (await lookup(hostname, { all: true, verbatim: true })).map((item) => item.address);
}

function matchesImageSignature(bytes: Uint8Array, mimeType: string): boolean {
  if (mimeType === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8;
  if (mimeType === "image/png") return bytes.slice(0, 8).every((value, i) => value === [137,80,78,71,13,10,26,10][i]);
  if (mimeType === "image/gif") return new TextDecoder().decode(bytes.slice(0, 6)).startsWith("GIF8");
  if (mimeType === "image/webp") return new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP";
  if (mimeType === "image/avif") return new TextDecoder().decode(bytes.slice(4, 12)).includes("ftypavif");
  return false;
}
