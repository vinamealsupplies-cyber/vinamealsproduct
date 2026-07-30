// Magic-byte file checks for business application documents (private R2).

import {
  BUSINESS_DOC_ACCEPTED_LABEL,
  MAX_BUSINESS_DOC_BYTES,
  MAX_BUSINESS_DOCS
} from "@/lib/business-application/constants";

export { MAX_BUSINESS_DOCS, MAX_BUSINESS_DOC_BYTES, BUSINESS_DOC_ACCEPTED_LABEL };

type Detected = { contentType: string; extension: string };

export function detectFileType(bytes: Uint8Array): Detected | null {
  const startsWith = (...signature: number[]) =>
    signature.length <= bytes.length && signature.every((byte, index) => bytes[index] === byte);

  if (startsWith(0x25, 0x50, 0x44, 0x46, 0x2d)) {
    return { contentType: "application/pdf", extension: "pdf" };
  }
  if (startsWith(0xff, 0xd8, 0xff)) {
    return { contentType: "image/jpeg", extension: "jpg" };
  }
  if (startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) {
    return { contentType: "image/png", extension: "png" };
  }
  if (
    startsWith(0x52, 0x49, 0x46, 0x46) &&
    bytes.length >= 12 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return { contentType: "image/webp", extension: "webp" };
  }
  return null;
}

export type CheckedBusinessFile = {
  bytes: Uint8Array;
  contentType: string;
  extension: string;
  size: number;
  originalFilename: string;
};

export type FileCheckResult =
  | { ok: true; file: CheckedBusinessFile }
  | { ok: false; message: string };

export function checkBusinessUpload(input: {
  name: string;
  size: number;
  buffer: ArrayBuffer;
}): FileCheckResult {
  if (input.size <= 0) return { ok: false, message: `"${input.name}" is empty.` };
  if (input.size > MAX_BUSINESS_DOC_BYTES) {
    return {
      ok: false,
      message: `"${input.name}" exceeds the allowed limit of 10 MB.`
    };
  }

  const bytes = new Uint8Array(input.buffer);
  const detected = detectFileType(bytes);
  if (!detected) {
    return {
      ok: false,
      message: `"${input.name}" is not a supported file type. Accepted: ${BUSINESS_DOC_ACCEPTED_LABEL}.`
    };
  }

  return {
    ok: true,
    file: {
      bytes,
      contentType: detected.contentType,
      extension: detected.extension,
      size: input.size,
      originalFilename: input.name.slice(0, 120)
    }
  };
}
