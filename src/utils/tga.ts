// Simple uncompressed 32-bit TGA encoder (BGRA, top-left origin)

export type EncodedImage = {
  width: number;
  height: number;
  data: Uint8Array;
};

export function encodeTGA(width: number, height: number, rgba: Uint8ClampedArray): EncodedImage {
  const header = new Uint8Array(18);
  header[0] = 0; // id length
  header[1] = 0; // no color map
  header[2] = 2; // uncompressed true-color image
  // color map spec (5 bytes) already 0
  // x-origin
  header[8] = 0; header[9] = 0;
  // y-origin
  header[10] = 0; header[11] = 0;
  // width
  header[12] = width & 0xff;
  header[13] = (width >> 8) & 0xff;
  // height
  header[14] = height & 0xff;
  header[15] = (height >> 8) & 0xff;
  header[16] = 32; // 32 bits per pixel
  header[17] = 0x28; // 8 bits alpha (0x08) + top-left origin (0x20)

  const pixelCount = width * height;
  const body = new Uint8Array(pixelCount * 4);
  // Convert RGBA -> BGRA, preserving top-left origin
  for (let i = 0; i < pixelCount; i++) {
    const r = rgba[i * 4 + 0];
    const g = rgba[i * 4 + 1];
    const b = rgba[i * 4 + 2];
    const a = rgba[i * 4 + 3];
    const o = i * 4;
    body[o + 0] = b;
    body[o + 1] = g;
    body[o + 2] = r;
    body[o + 3] = a;
  }

  const out = new Uint8Array(header.length + body.length);
  out.set(header, 0);
  out.set(body, header.length);
  return { width, height, data: out };
}


