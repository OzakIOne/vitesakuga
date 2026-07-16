import { assertEvent, assign, fromCallback, fromPromise, setup } from "xstate";

export type OutputFormat = {
  label: string;
  container: "mp4" | "webm" | "mkv";
  videoCodec?: "avc" | "vp9";
  audioCodec?: "aac" | "opus";
  /** Custom video bitrate in bps. Falls back to QUALITY_VERY_HIGH if unset and transcoding. */
  videoBitrate?: number;
  /** Custom audio bitrate in bps. Falls back to QUALITY_VERY_HIGH if unset and transcoding. */
  audioBitrate?: number;
};

export const SUPPORTED_OUTPUTS: OutputFormat[] = [
  {
    audioCodec: "aac",
    container: "mp4",
    label: "MP4 (H.264/AAC) — Transcode",
    videoCodec: "avc",
  },
  {
    container: "mp4",
    label: "MP4 (Passthrough/Copy) — No quality loss",
  },
  {
    audioCodec: "opus",
    container: "webm",
    label: "WebM (VP9/Opus) — Transcode",
    videoCodec: "vp9",
  },
  {
    container: "webm",
    label: "WebM (Passthrough/Copy) — No quality loss",
  },
  {
    container: "mkv",
    label: "MKV (Passthrough/Copy) — No quality loss",
  },
];

export function getCodecFamily(codec: string): string | null {
  const c = codec.toLowerCase();
  if (c.startsWith("avc")) return "avc";
  if (c.startsWith("hvc") || c.startsWith("hev")) return "hevc";
  if (c.startsWith("vp0") || c.startsWith("vp8") || c.startsWith("vp9"))
    return "vp";
  if (c.startsWith("av01") || c.startsWith("av1")) return "av1";
  return null;
}

export function isPassthroughCompatible(
  output: OutputFormat,
  inputVideoCodec: string | null,
): boolean {
  // Transcode options re-encode → always selectable
  if (output.videoCodec !== undefined) return true;
  // MKV supports every codec
  if (output.container === "mkv") return true;
  // Not probed yet → allow selection (Conversion.init will validate)
  if (inputVideoCodec === null) return true;
  // No video track (audio-only file) → passthrough is fine
  const videoFamily = getCodecFamily(inputVideoCodec);
  if (videoFamily === null) return true;
  // Check container compatibility
  if (output.container === "mp4") {
    return videoFamily === "avc" || videoFamily === "hevc";
  }
  if (output.container === "webm") {
    return videoFamily === "vp" || videoFamily === "av1";
  }
  return false;
}

type ConvertProgressEvent = { type: "progress"; percent: number };
type ConvertDoneEvent = {
  type: "conversion.done";
  downloadUrl: string;
  convertedName: string;
};
type ConvertErrorEvent = { type: "conversion.error"; message: string };

export const convertMachine = setup({
  types: {
    context: {} as {
      file: File | null;
      output: OutputFormat | null;
      progress: number;
      error: string | null;
      downloadUrl: string | null;
      convertedName: string;
      inputVideoCodec: string | null;
      inputAudioCodec: string | null;
    },
    events: {} as
      | { type: "file.selected"; file: File }
      | { type: "output.selected"; output: OutputFormat }
      | { type: "convert" }
      | ConvertProgressEvent
      | ConvertDoneEvent
      | ConvertErrorEvent
      | { type: "reset" },
  },
  guards: {
    canConvert: ({ context }) =>
      context.file !== null && context.output !== null,
  },
  actions: {
    resetOnNewFile: assign({
      file: (_, params: { file: File }) => params.file,
      output: () => null,
      inputVideoCodec: () => null,
      inputAudioCodec: () => null,
      error: () => null,
      downloadUrl: () => null,
      convertedName: () => "",
      progress: () => 0,
    }),
    setOutput: assign({
      output: (_, params: { output: OutputFormat }) => params.output,
    }),
    setCodecs: assign({
      inputVideoCodec: (
        _,
        params: { videoCodec: string | null; audioCodec: string | null },
      ) => params.videoCodec,
      inputAudioCodec: (
        _,
        params: { videoCodec: string | null; audioCodec: string | null },
      ) => params.audioCodec,
    }),
    setProgress: assign({
      progress: (_, params: { percent: number }) => params.percent,
    }),
    completeConversion: assign({
      downloadUrl: (
        _,
        params: { downloadUrl: string; convertedName: string },
      ) => params.downloadUrl,
      convertedName: (
        _,
        params: { downloadUrl: string; convertedName: string },
      ) => params.convertedName,
      progress: () => 100,
    }),
    setConversionError: assign({
      error: (_, params: { message: string }) => params.message,
    }),
    resetAll: assign({
      file: () => null,
      output: () => null,
      progress: () => 0,
      error: () => null,
      downloadUrl: () => null,
      convertedName: () => "",
      inputVideoCodec: () => null,
      inputAudioCodec: () => null,
    }),
  },
  actors: {
    probeFile: fromPromise(async ({ input }: { input: { file: File } }) => {
      const { ALL_FORMATS, BlobSource, Input } = await import("mediabunny");
      const mediainput = new Input({
        formats: ALL_FORMATS,
        source: new BlobSource(input.file),
      });
      try {
        const [videoTrack, audioTrack] = await Promise.all([
          mediainput.getPrimaryVideoTrack(),
          mediainput.getPrimaryAudioTrack(),
        ]);
        const [videoConfig, audioConfig] = await Promise.all([
          videoTrack?.getDecoderConfig(),
          audioTrack?.getDecoderConfig(),
        ]);
        return {
          videoCodec: videoConfig?.codec ?? null,
          audioCodec: audioConfig?.codec ?? null,
        };
      } finally {
        mediainput.dispose();
      }
    }),
    runConversion: fromCallback<
      ConvertProgressEvent | ConvertDoneEvent | ConvertErrorEvent,
      { file: File; output: OutputFormat }
    >(({ sendBack, input }) => {
      void (async () => {
        try {
          const {
            ALL_FORMATS,
            BlobSource,
            BufferTarget,
            Conversion,
            Input,
            MkvOutputFormat,
            Mp4OutputFormat,
            Output,
            QUALITY_VERY_HIGH,
            WebMOutputFormat,
          } = await import("mediabunny");

          const mediabunnyInput = new Input({
            formats: ALL_FORMATS,
            source: new BlobSource(input.file),
          });

          let outputFormat;
          if (input.output.container === "mp4") {
            outputFormat = new Mp4OutputFormat();
          } else if (input.output.container === "webm") {
            outputFormat = new WebMOutputFormat();
          } else {
            outputFormat = new MkvOutputFormat();
          }

          const target = new BufferTarget();

          const mediabunnyOutput = new Output({
            format: outputFormat,
            target,
          });

          const videoOptions = input.output.videoCodec
            ? {
                codec: input.output.videoCodec,
                bitrate: input.output.videoBitrate ?? QUALITY_VERY_HIGH,
              }
            : undefined;

          const audioOptions = input.output.audioCodec
            ? {
                codec: input.output.audioCodec,
                bitrate: input.output.audioBitrate ?? QUALITY_VERY_HIGH,
              }
            : undefined;

          const initArgs: Record<string, unknown> = {
            input: mediabunnyInput,
            output: mediabunnyOutput,
          };
          if (audioOptions !== undefined) initArgs["audio"] = audioOptions;
          if (videoOptions !== undefined) initArgs["video"] = videoOptions;
          const conversion = await Conversion.init(
            initArgs as Parameters<typeof Conversion.init>[0],
          );

          if (!conversion.isValid) {
            sendBack({
              type: "conversion.error",
              message: `Conversion is invalid: ${(conversion.discardedTracks as Array<{ reason: string }>).map((t) => t.reason).join(", ")}`,
            });
            return;
          }

          conversion.onProgress = (p: number) =>
            sendBack({ type: "progress", percent: p * 100 });

          await conversion.execute();

          const { buffer } = target;
          if (!buffer) {
            sendBack({
              type: "conversion.error",
              message: "Conversion failed to produce output",
            });
            return;
          }

          const blob = new Blob([buffer], {
            type: `video/${input.output.container}`,
          });
          const url = URL.createObjectURL(blob);
          const ext = input.output.container;
          const base = input.file.name.replace(/\.[^.]+$/, "");
          const convertedName = `${base}-converted.${ext}`;

          sendBack({
            type: "conversion.done",
            downloadUrl: url,
            convertedName,
          });
        } catch (error) {
          sendBack({
            type: "conversion.error",
            message:
              error instanceof Error
                ? error.message
                : "An error occurred during conversion.",
          });
        }
      })();

      return () => {};
    }),
  },
}).createMachine({
  id: "convert",
  initial: "idle",
  context: {
    file: null,
    output: null,
    progress: 0,
    error: null,
    downloadUrl: null,
    convertedName: "",
    inputVideoCodec: null,
    inputAudioCodec: null,
  },
  states: {
    idle: {
      on: {
        "file.selected": {
          target: "ready",
          actions: [
            {
              type: "resetOnNewFile",
              params: ({ event }) => {
                assertEvent(event, "file.selected");
                return { file: event.file };
              },
            },
          ],
        },
      },
    },
    ready: {
      invoke: {
        src: "probeFile",
        // oxlint-disable-next-line
        input: ({ context }) => ({ file: context.file! }),
        onDone: {
          actions: [
            {
              type: "setCodecs",
              params: ({ event }) => ({
                // oxlint-disable-next-line
                videoCodec: event.output.videoCodec!,
                // oxlint-disable-next-line
                audioCodec: event.output.audioCodec!,
              }),
            },
          ],
        },
        onError: {
          actions: [
            {
              type: "setCodecs",
              params: { videoCodec: null, audioCodec: null },
            },
          ],
        },
      },
      on: {
        "file.selected": {
          target: "ready",
          reenter: true,
          actions: [
            {
              type: "resetOnNewFile",
              params: ({ event }) => {
                assertEvent(event, "file.selected");
                return { file: event.file };
              },
            },
          ],
        },
        "output.selected": {
          actions: [
            {
              type: "setOutput",
              params: ({ event }) => {
                assertEvent(event, "output.selected");
                return { output: event.output };
              },
            },
          ],
        },
        convert: {
          target: "converting",
          guard: { type: "canConvert" },
        },
      },
    },
    converting: {
      tags: ["converting"],
      invoke: {
        src: "runConversion",
        input: ({ context }) => ({
          // oxlint-disable-next-line
          file: context.file!,
          // oxlint-disable-next-line
          output: context.output!,
        }),
      },
      on: {
        progress: {
          actions: [
            {
              type: "setProgress",
              params: ({ event }) => {
                assertEvent(event, "progress");
                return { percent: event.percent };
              },
            },
          ],
        },
        "conversion.done": {
          target: "success",
          actions: [
            {
              type: "completeConversion",
              params: ({ event }) => {
                assertEvent(event, "conversion.done");
                return {
                  downloadUrl: event.downloadUrl,
                  convertedName: event.convertedName,
                };
              },
            },
          ],
        },
        "conversion.error": {
          target: "error",
          actions: [
            {
              type: "setConversionError",
              params: ({ event }) => {
                assertEvent(event, "conversion.error");
                return { message: event.message };
              },
            },
          ],
        },
      },
    },
    success: {
      on: {
        "file.selected": {
          target: "ready",
          actions: [
            {
              type: "resetOnNewFile",
              params: ({ event }) => {
                assertEvent(event, "file.selected");
                return { file: event.file };
              },
            },
          ],
        },
        "output.selected": {
          actions: [
            {
              type: "setOutput",
              params: ({ event }) => {
                assertEvent(event, "output.selected");
                return { output: event.output };
              },
            },
          ],
        },
        reset: {
          target: "idle",
          actions: [{ type: "resetAll" }],
        },
      },
    },
    error: {
      on: {
        "file.selected": {
          target: "ready",
          actions: [
            {
              type: "resetOnNewFile",
              params: ({ event }) => {
                assertEvent(event, "file.selected");
                return { file: event.file };
              },
            },
          ],
        },
        "output.selected": {
          actions: [
            {
              type: "setOutput",
              params: ({ event }) => {
                assertEvent(event, "output.selected");
                return { output: event.output };
              },
            },
          ],
        },
        convert: {
          target: "converting",
          guard: { type: "canConvert" },
        },
        reset: {
          target: "idle",
          actions: [{ type: "resetAll" }],
        },
      },
    },
  },
});
