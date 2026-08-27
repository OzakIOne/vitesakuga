// Magic-byte checks run server-side: the media bucket is publicly served, so
// they stop attackers from storing arbitrary HTML/JS under an image or video
// key even when they control the Content-Type header of their upload.
export const JPEG_MAGIC_BYTES = [0xff, 0xd8, 0xff] as const;
// PNG: 8-byte signature `\x89PNG\r\n\x1a\n`; first four suffice as a guard.
export const PNG_MAGIC_BYTES = [0x89, 0x50, 0x4e, 0x47] as const;
// WebP: RIFF container with a WEBP FourCC at offset 8.
export const WEBP_MAGIC_PREFIX = "RIFF";
export const WEBP_MAGIC_FOURCC = "WEBP";

const matchesMagicBytes = (head: Uint8Array, magic: readonly number[]) =>
  magic.every((byte, index) => head[index] === byte);

const decodeAscii = (bytes: Uint8Array): string =>
  String.fromCharCode(...bytes);

// oxlint-disable-next-line effecttsgo/async-function -- reading File bytes is inherently async (no sync File read in Workers/Node); this plain utility is shared by the server validator and unit tests.
export const hasJpegMagicBytes = async (file: File): Promise<boolean> => {
  const head = new Uint8Array(
    await file.slice(0, JPEG_MAGIC_BYTES.length).arrayBuffer(),
  );
  return matchesMagicBytes(head, JPEG_MAGIC_BYTES);
};

// oxlint-disable-next-line effecttsgo/async-function -- see hasJpegMagicBytes above.
export const assertThumbnailIsJpeg = async (file: File): Promise<void> => {
  if (!(await hasJpegMagicBytes(file))) {
    throw new Error("Thumbnail is not a valid JPEG image");
  }
};

// oxlint-disable-next-line effecttsgo/async-function -- see hasJpegMagicBytes above.
export const assertSupportedImageFile = async (file: File): Promise<void> => {
  // WebP needs up to byte 11; PNG and JPEG fit well inside that window too,
  // so one read covers every supported format.
  const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const name = file.name.toLowerCase();
  if (matchesMagicBytes(head, JPEG_MAGIC_BYTES) && /\.jpe?g$/.test(name)) {
    return;
  }
  if (matchesMagicBytes(head, PNG_MAGIC_BYTES) && /\.png$/.test(name)) {
    return;
  }
  if (
    decodeAscii(head.slice(0, 4)) === WEBP_MAGIC_PREFIX &&
    decodeAscii(head.slice(8, 12)) === WEBP_MAGIC_FOURCC &&
    /\.webp$/.test(name)
  ) {
    return;
  }
  throw new Error("Image must be a valid JPEG, PNG or WebP file");
};
