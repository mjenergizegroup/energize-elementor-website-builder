import "server-only";
import type { BrandKit } from "@/lib/types";

type BrandAsset = { filename: string; dataBase64: string };

export function validateBrandKitAssets(brandKit: BrandKit): void {
  if (brandKit.logo) validateBrandAsset(brandKit.logo, "logo");
  if (brandKit.favicon) validateBrandAsset(brandKit.favicon, "favicon");
}

export function validateBrandAsset(
  asset: BrandAsset,
  kind: "logo" | "favicon",
): void {
  const maximum = kind === "logo" ? 2 * 1024 * 1024 : 500 * 1024;
  if (asset.dataBase64.length > Math.ceil(maximum * 1.5) + 200) {
    throw new Error(`${label(kind)} exceeds its encoded size limit.`);
  }
  const encoded = stripDataUri(asset.dataBase64);
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded) || encoded.length % 4 !== 0) {
    throw new Error(`${label(kind)} is not valid base64 data.`);
  }
  const bytes = Buffer.from(encoded, "base64");
  if (bytes.length === 0 || bytes.length > maximum) {
    throw new Error(`${label(kind)} exceeds its decoded size limit.`);
  }
  const extension = asset.filename.split(".").pop()?.toLowerCase();
  if (kind === "favicon") {
    if (extension === "png" && isPng(bytes)) return;
    if (extension === "ico" && isIco(bytes)) return;
    throw new Error("Favicon content must match a PNG or ICO filename.");
  }
  if (extension === "png" && isPng(bytes)) return;
  if ((extension === "jpg" || extension === "jpeg") && isJpeg(bytes)) return;
  if (extension === "svg" && isSafeSvg(bytes)) return;
  throw new Error("Logo content must match a PNG, JPG, or safe SVG filename.");
}

function isPng(bytes: Uint8Array): boolean {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  return signature.every((value, index) => bytes[index] === value);
}

function isJpeg(bytes: Uint8Array): boolean {
  return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

function isIco(bytes: Uint8Array): boolean {
  return (
    bytes[0] === 0 &&
    bytes[1] === 0 &&
    bytes[2] === 1 &&
    bytes[3] === 0
  );
}

function isSafeSvg(bytes: Buffer): boolean {
  const source = bytes.toString("utf8").trim();
  if (!/^<svg(?:\s|>)/i.test(source) && !/^<\?xml[\s\S]*?<svg(?:\s|>)/i.test(source)) {
    return false;
  }
  return !/(?:<script|<style|<foreignObject|<!DOCTYPE|<!ENTITY|\son[a-z]+\s*=|@import|url\s*\(\s*["']?\s*(?:https?:|data:|javascript:)|\b(?:href|src)\s*=\s*["']\s*(?:https?:|data:|javascript:))/i.test(
    source,
  );
}

function stripDataUri(value: string): string {
  const marker = value.indexOf("base64,");
  return (marker >= 0 ? value.slice(marker + 7) : value).replace(/\s/g, "");
}

function label(kind: "logo" | "favicon"): string {
  return kind === "logo" ? "Logo" : "Favicon";
}
