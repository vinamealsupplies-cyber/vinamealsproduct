// Kiểm tra file tài liệu miễn thuế do khách tải lên.
//
// Đây là bề mặt tấn công dễ bị lợi dụng nhất của tính năng này, nên KHÔNG tin
// vào phần mở rộng hay Content-Type trình duyệt khai báo — cả hai đều do client
// đặt tuỳ ý. Ta đọc "magic bytes" ở đầu file và chỉ chấp nhận đúng 4 định dạng.

export const MAX_FILES = 3;
export const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB
export const ACCEPTED_LABEL = "PDF, JPEG, PNG, or WebP up to 5 MB each (max 3 files)";

type Detected = { contentType: string; extension: string };

/** Nhận diện định dạng THẬT từ vài byte đầu, bỏ qua tên file và MIME khai báo. */
export function detectFileType(bytes: Uint8Array): Detected | null {
  const startsWith = (...signature: number[]) =>
    signature.length <= bytes.length && signature.every((byte, index) => bytes[index] === byte);

  // %PDF-
  if (startsWith(0x25, 0x50, 0x44, 0x46, 0x2d)) {
    return { contentType: "application/pdf", extension: "pdf" };
  }
  // JPEG: FF D8 FF
  if (startsWith(0xff, 0xd8, 0xff)) {
    return { contentType: "image/jpeg", extension: "jpg" };
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) {
    return { contentType: "image/png", extension: "png" };
  }
  // WebP: "RIFF" .... "WEBP"
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

export type CheckedFile = {
  bytes: Uint8Array;
  contentType: string;
  extension: string;
  size: number;
  originalFilename: string;
};

export type FileCheckResult = { ok: true; file: CheckedFile } | { ok: false; message: string };

/** Kiểm tra một file đã đọc vào bộ nhớ. */
export function checkUploadedFile(input: {
  name: string;
  size: number;
  buffer: ArrayBuffer;
}): FileCheckResult {
  if (input.size <= 0) return { ok: false, message: `"${input.name}" is empty.` };
  if (input.size > MAX_FILE_BYTES) {
    return { ok: false, message: `"${input.name}" is larger than 5 MB.` };
  }

  const bytes = new Uint8Array(input.buffer);
  const detected = detectFileType(bytes);
  if (!detected) {
    // Đây là chỗ chặn file .exe/.js/.svg đổi đuôi thành .pdf/.png.
    return {
      ok: false,
      message: `"${input.name}" is not a real PDF or image file. Accepted: ${ACCEPTED_LABEL}.`
    };
  }

  return {
    ok: true,
    file: {
      bytes,
      contentType: detected.contentType,
      extension: detected.extension,
      size: input.size,
      // Chỉ giữ để hiển thị cho admin; KHÔNG dùng làm tên lưu trữ.
      originalFilename: input.name.slice(0, 120)
    }
  };
}
