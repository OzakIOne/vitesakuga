# Video Metadata: mediabunny vs mediainfo.js

Recap · 2026-08-17

Research question: which fields currently produced by **mediainfo.js** (MediaInfo WASM) in the upload path could be produced by **mediabunny** instead, so `mediainfo.js` could eventually be dropped?

## Context

The client-side upload path runs two libraries on the same file:

- `src/lib/upload/useVideoProcessing.ts` — owns the mediainfo.js WASM lifecycle (`MediaInfoModule.wasm` copied by `vite.config.ts`); calls `analyzeVideo()` for Video Metadata.
- `src/lib/upload/upload.processor.ts` — `analyzeVideo` (mediainfo.js JSON), plus `generateThumbnails` / `generateAutoThumbnails`, which already create a mediabunny `Input` (`getPrimaryVideoTrack()`, `computeDuration()`).

Video Metadata is parsed by `VideoMetadataSchema` (`src/lib/posts/posts.schema.ts`) and stored as a JSON string on `posts.videoMetadata`, so field changes are backward compatible with existing rows.

## Field mapping (MediaInfo → mediabunny `InputVideoTrack`)

| MediaInfo field             | Mediabunny replacement                                                                                                                                                                                                 | Status                       |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| Width / Height              | `getCodedWidth()` / `getCodedHeight()` or `getDisplayWidth()` / `getDisplayHeight()` (post-rotation/PAR)                                                                                                               | ✅ direct                    |
| Duration                    | `computeDuration()` (precise, from packet timestamps) or `getDurationFromMetadata()` (cheap, header-based)                                                                                                             | ✅ direct                    |
| FrameRate                   | `computeFrameRateMetrics()` → `bestGuessFrameRate` — deduced from actual frame timestamps, not unreliable file metadata; handles VFR (`underlyingFrameRate`, `min`/`max`/`median`, `frameRateIsConstant`)              | ✅ direct, better            |
| BitRate                     | `computePacketStats()` → `averageBitrate` (measured over packets) or `getBitrate()`/`getAverageBitrate()` (metadata)                                                                                                   | ✅ direct                    |
| CodecID                     | `getInternalCodecId()` (container-native, e.g. `avc1`) or `getCodec()` (normalized `avc`)                                                                                                                              | ✅ direct                    |
| DisplayAspectRatio          | compute `getDisplayWidth() / getDisplayHeight()` (or `getPixelAspectRatio()` × coded dims)                                                                                                                             | ✅ derivable                 |
| colour_primaries            | `getColorSpace().primaries` (e.g. `bt709`)                                                                                                                                                                             | ✅ direct                    |
| ColorSpace                  | `getColorSpace().matrix` — same underlying data, different vocabulary (`YUV` vs WebCodecs `bt709`/`bt470bg`/`smpte170m`/`rgb`)                                                                                         | ⚠️ partial (rename/reformat) |
| FrameCount                  | no exact API — approximate with `bestGuessFrameRate × computeDuration()` or `computePacketStats().packetCount` (≈1 packet/frame, not guaranteed)                                                                       | ⚠️ approximate               |
| Format_Profile              | no profile API — manual parse of `getCodecParameterString()` (e.g. `avc1.PPCCLL`, high-profile byte) per codec/container                                                                                               | ⚠️ manual parsing            |
| BitDepth                    | **not exposed** — `getColorSpace()` returns WebCodecs `VideoColorSpaceInit` (primaries/transfer/matrix/fullRange only); only emergent via decoded `VideoSample.format` (`I420P10` = 10-bit etc.), which needs decoding | ❌                           |
| ChromaSubsampling           | **not exposed** — same: only inferable from decoded `VideoSample.format` (`I420`/`NV12` = 4:2:0, `I422`, `I444`)                                                                                                       | ❌                           |
| Encoded_Library_Name (x264) | **not exposed** — encoder identification is a deep bitstream-parsing feature mediabunny lacks                                                                                                                          | ❌                           |
| Encoded_Library_Settings    | **not exposed** — same                                                                                                                                                                                                 | ❌                           |

Verified against the installed `node_modules/mediabunny/dist/mediabunny.d.ts`: the API surface is the metadata-extraction example (`examples/metadata-extraction/metadata-extraction.ts`) — Format, MIME, codec + codec string, timestamps/duration, coded/display dims, rotation, PAR, transparency, packet stats, color space (primaries/transfer/matrix/fullRange), HDR, language, metadata tags. No bit depth, chroma subsampling, profile, or encoder info.

## Bottom line

- **~10 of 15 fields** have direct mediabunny equivalents; nearly all are already resolved during the existing thumbnail `Input` demux.
- The **4 drop-only fields** (BitDepth, ChromaSubsampling, Encoded_Library_Name/Settings) are exact "deep bitstream" details. Keep mediainfo.js only for these, or drop them from the schema. Decoding samples to recover bit depth / chroma subsampling contradicts dropping the WASM dependency and is decoder-dependent.
- Dropping mediainfo.js would also remove the `MediaInfoModule.wasm` copy in `vite.config.ts` and the init/close lifecycle in `useVideoProcessing`.
- UI touch-points: `PostsPageLayout.tsx` renders Video Metadata generically but has a dedicated Popover for `Encoded_Library_Settings`.

## Schema status

`VideoMetadataSchema` fields present today: `BitDepth`, `BitRate`, `ChromaSubsampling`, `CodecID`, `ColorSpace`, `DisplayAspectRatio`, `Duration`, `Encoded_Library_Name`, `Encoded_Library_Settings`, `Format_Profile`, `FrameCount`, `FrameRate`, `Height`, `Width`, `colour_primaries` — all optional; stored as JSON (backward compatible).
