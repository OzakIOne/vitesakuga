// JPEG files start with the SOI marker (0xFF 0xD8 0xFF). Checking it server-side
// stops attackers from storing arbitrary HTML/JS under a .jpg key on the public
// media bucket, even when they control the Content-Type header of their upload.
export const JPEG_MAGIC_BYTES = [0xff, 0xd8, 0xff] as const;

// oxlint-disable-next-line effecttsgo/async-function -- reading File bytes is inherently async (no sync File read in Workers/Node); this plain utility is shared by the server validator and unit tests.
export const hasJpegMagicBytes = async (file: File): Promise<boolean> => {
  const head = new Uint8Array(
    await file.slice(0, JPEG_MAGIC_BYTES.length).arrayBuffer(),
  );
  return JPEG_MAGIC_BYTES.every((byte, index) => head[index] === byte);
};

// oxlint-disable-next-line effecttsgo/async-function -- see hasJpegMagicBytes above.
export const assertThumbnailIsJpeg = async (file: File): Promise<void> => {
  if (!(await hasJpegMagicBytes(file))) {
    throw new Error("Thumbnail is not a valid JPEG image");
  }
};
