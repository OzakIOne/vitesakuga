import { describe, expect, it } from "vitest";

import { getVideoMetadataRows } from "./video-metadata";

describe(getVideoMetadataRows, () => {
  it("labels and formats MediaInfo values for display", () => {
    expect(
      getVideoMetadataRows({
        BitDepth: 8,
        BitRate: 182_200,
        Duration: 5.045,
        Encoded_Library_Settings: "cabac=1",
        FrameRate: 23.976,
        Height: 720,
        Width: 1280,
        colour_primaries: "BT.709",
      }),
    ).toStrictEqual([
      { key: "Resolution", label: "Resolution", value: "1,280 × 720 px" },
      { key: "FrameRate", label: "Frame rate", value: "23.976 fps" },
      { key: "Duration", label: "Duration", value: "5.045 s" },
      { key: "BitRate", label: "Bit rate", value: "182.2 kbps" },
      { key: "BitDepth", label: "Bit depth", value: "8 bit" },
      { key: "colour_primaries", label: "Color primaries", value: "BT.709" },
      {
        key: "Encoded_Library_Settings",
        label: "Encoding settings",
        settings: "cabac=1",
        value: "View settings",
      },
    ]);
  });

  it("uses a placeholder when only one resolution dimension is available", () => {
    expect(getVideoMetadataRows({ Width: 1920 })).toStrictEqual([
      { key: "Resolution", label: "Resolution", value: "1,920 × ? px" },
    ]);
  });
});
