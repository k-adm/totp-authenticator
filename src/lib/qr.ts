import { BrowserQRCodeReader } from "@zxing/browser";

function reader(): BrowserQRCodeReader {
  return new BrowserQRCodeReader();
}

/** Decode a QR code from an image URL (object URL or data URL). Throws if none found. */
export async function decodeQrFromUrl(url: string): Promise<string> {
  const result = await reader().decodeFromImageUrl(url);
  return result.getText();
}

/** Decode a QR code from an uploaded image file. Throws if none found. */
export async function decodeQrFromFile(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    return await decodeQrFromUrl(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Decode a QR code from a canvas region (used by the screenshot scanner). */
export async function decodeQrFromCanvas(
  canvas: HTMLCanvasElement,
): Promise<string> {
  return decodeQrFromUrl(canvas.toDataURL("image/png"));
}
