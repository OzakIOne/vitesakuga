import { assign, fromCallback, setup } from "xstate";

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

const noCodecReset = {
  error: null,
  downloadUrl: null,
  convertedName: "",
  progress: 0,
} as const;

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
      | {
          type: "file.probed";
          videoCodec: string | null;
          audioCodec: string | null;
        }
      | { type: "output.selected"; output: OutputFormat }
      | { type: "convert" }
      | { type: "progress"; percent: number }
      | { type: "conversion.done"; downloadUrl: string; convertedName: string }
      | { type: "conversion.error"; message: string }
      | { type: "reset" },
  },
  actors: {
    runConversion: fromCallback(
      ({
        sendBack,
        input,
      }: {
        sendBack: (
          event:
            | { type: "progress"; percent: number }
            | {
                type: "conversion.done";
                downloadUrl: string;
                convertedName: string;
              }
            | { type: "conversion.error"; message: string },
        ) => void;
        input: { file: File; output: OutputFormat };
      }) => {
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

            const conversion = await Conversion.init({
              audio: audioOptions,
              input: mediabunnyInput,
              output: mediabunnyOutput,
              video: videoOptions,
            });

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
          } catch (error: any) {
            sendBack({
              type: "conversion.error",
              message: error.message ?? "An error occurred during conversion.",
            });
          }
        })();

        return () => {};
      },
    ),
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
          actions: assign(({ event }) => ({
            file: event.file,
            output: null,
            inputVideoCodec: null,
            inputAudioCodec: null,
            ...noCodecReset,
          })),
        },
      },
    },
    ready: {
      on: {
        "file.selected": {
          actions: assign(({ event }) => ({
            file: event.file,
            output: null,
            inputVideoCodec: null,
            inputAudioCodec: null,
            ...noCodecReset,
          })),
        },
        "file.probed": {
          actions: assign(({ event }) => ({
            inputVideoCodec: event.videoCodec,
            inputAudioCodec: event.audioCodec,
          })),
        },
        "output.selected": {
          actions: assign({ output: ({ event }) => event.output }),
        },
        convert: {
          target: "converting",
          guard: ({ context }) =>
            context.file !== null && context.output !== null,
        },
      },
    },
    converting: {
      invoke: {
        src: "runConversion",
        input: ({ context }) => ({
          file: context.file as File,
          output: context.output as OutputFormat,
        }),
      },
      on: {
        progress: {
          actions: assign({ progress: ({ event }) => event.percent }),
        },
        "conversion.done": {
          target: "success",
          actions: assign(({ event }) => ({
            downloadUrl: event.downloadUrl,
            convertedName: event.convertedName,
            progress: 100,
          })),
        },
        "conversion.error": {
          target: "error",
          actions: assign({ error: ({ event }) => event.message }),
        },
      },
    },
    success: {
      on: {
        "file.selected": {
          target: "ready",
          actions: assign(({ event }) => ({
            file: event.file,
            output: null,
            inputVideoCodec: null,
            inputAudioCodec: null,
            ...noCodecReset,
          })),
        },
        "output.selected": {
          actions: assign({ output: ({ event }) => event.output }),
        },
        reset: {
          target: "idle",
          actions: assign({
            file: null,
            output: null,
            progress: 0,
            error: null,
            downloadUrl: null,
            convertedName: "",
            inputVideoCodec: null,
            inputAudioCodec: null,
          }),
        },
      },
    },
    error: {
      on: {
        "file.selected": {
          target: "ready",
          actions: assign(({ event }) => ({
            file: event.file,
            output: null,
            inputVideoCodec: null,
            inputAudioCodec: null,
            ...noCodecReset,
          })),
        },
        "output.selected": {
          actions: assign({ output: ({ event }) => event.output }),
        },
        convert: {
          target: "converting",
          guard: ({ context }) =>
            context.file !== null && context.output !== null,
        },
        reset: {
          target: "idle",
          actions: assign({
            file: null,
            output: null,
            progress: 0,
            error: null,
            downloadUrl: null,
            convertedName: "",
            inputVideoCodec: null,
            inputAudioCodec: null,
          }),
        },
      },
    },
  },
});
