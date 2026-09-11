import type { VideoMetadata } from "./posts.schema";

type Metadata = NonNullable<VideoMetadata>;
type MetadataKey = keyof Metadata;

export type VideoMetadataRow = {
  key: string;
  label: string;
  settings?: string;
  value: string;
};

const METADATA_LABELS = {
  BitDepth: "Bit depth",
  BitRate: "Bit rate",
  ChromaSubsampling: "Chroma subsampling",
  CodecID: "Codec",
  ColorSpace: "Color space",
  DisplayAspectRatio: "Display aspect ratio",
  Duration: "Duration",
  Encoded_Library_Name: "Encoding library",
  Encoded_Library_Settings: "Encoding settings",
  Format_Profile: "Format profile",
  FrameCount: "Frame count",
  FrameRate: "Frame rate",
  Height: "Height",
  Width: "Width",
  colour_primaries: "Color primaries",
} as const satisfies Record<MetadataKey, string>;

const METADATA_ORDER: readonly MetadataKey[] = [
  "CodecID",
  "Format_Profile",
  "Width",
  "Height",
  "DisplayAspectRatio",
  "FrameRate",
  "FrameCount",
  "Duration",
  "BitRate",
  "BitDepth",
  "ColorSpace",
  "ChromaSubsampling",
  "colour_primaries",
  "Encoded_Library_Name",
  "Encoded_Library_Settings",
];

const decimalFormatter = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 3,
});

const integerFormatter = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 0,
});

const formatNumber = (value: string | number): string =>
  decimalFormatter.format(Number(value));

const formatMetadataValue = (
  key: Exclude<MetadataKey, "Height" | "Width">,
  value: string | number,
): string => {
  switch (key) {
    case "BitDepth":
      return `${formatNumber(value)} bit`;
    case "BitRate":
      return `${decimalFormatter.format(Number(value) / 1_000)} kbps`;
    case "Duration":
      return `${formatNumber(value)} s`;
    case "FrameCount":
      return integerFormatter.format(Number(value));
    case "FrameRate":
      return `${formatNumber(value)} fps`;
    default:
      return String(value);
  }
};

export const getVideoMetadataRows = (
  metadata: VideoMetadata | undefined,
): readonly VideoMetadataRow[] => {
  if (!metadata) return [];

  const rows: VideoMetadataRow[] = [];
  const width = metadata.Width;
  const height = metadata.Height;

  for (const key of METADATA_ORDER) {
    if (key === "Height") continue;

    if (key === "Width") {
      if (width !== undefined || height !== undefined) {
        const dimensions = [width, height]
          .map((value) => (value === undefined ? "?" : formatNumber(value)))
          .join(" × ");
        rows.push({
          key: "Resolution",
          label: "Resolution",
          value: `${dimensions} px`,
        });
      }
      continue;
    }

    const value = metadata[key];
    if (value === undefined || value === "") continue;

    if (key === "Encoded_Library_Settings") {
      rows.push({
        key,
        label: METADATA_LABELS[key],
        settings: String(value),
        value: "View settings",
      });
      continue;
    }

    rows.push({
      key,
      label: METADATA_LABELS[key],
      value: formatMetadataValue(key, value),
    });
  }

  return rows;
};
