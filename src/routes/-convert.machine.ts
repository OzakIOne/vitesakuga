import type { ConversionOptions } from "mediabunny";
import {
  createAsyncLogic,
  createCallbackLogic,
  createMachine,
  types,
} from "xstate";
import type { AnyActorLogic } from "xstate";

export type OutputFormat = {
  label: string;
  container: "mp4" | "webm" | "mkv";
  videoCodec?: "avc" | "vp9";
  audioCodec?: "aac" | "opus";
};

/**
 * Lowest CRF/quantizer users may select (lower = higher quality). Keeps near-lossless
 * settings like CRF 0 or 1 out of reach, since they produce impractically large files.
 */
export const VIDEO_QUALITY_MIN = 2;

/** Highest CRF/quantizer users may select, per video codec. */
const VIDEO_QUALITY_MAX = {
  avc: 51,
  vp9: 63,
} satisfies Record<NonNullable<OutputFormat["videoCodec"]>, number>;

/** Default CRF/quantizer used when transcoding. */
export const DEFAULT_VIDEO_QUALITY = 18;

export function getVideoQualityRange(
  codec: NonNullable<OutputFormat["videoCodec"]>,
) {
  return { min: VIDEO_QUALITY_MIN, max: VIDEO_QUALITY_MAX[codec] };
}

export function clampVideoQuality(
  quality: number,
  codec: NonNullable<OutputFormat["videoCodec"]>,
): number {
  const { min, max } = getVideoQualityRange(codec);
  return Math.min(max, Math.max(min, Math.round(quality)));
}

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

type ConvertContext = {
  file: File | null;
  output: OutputFormat | null;
  progress: number;
  error: string | null;
  downloadUrl: string | null;
  convertedName: string;
  inputVideoCodec: string | null;
  inputAudioCodec: string | null;
  videoQuality: number;
};

function resetOnNewFile(file: File): Partial<ConvertContext> {
  return {
    file,
    output: null,
    progress: 0,
    error: null,
    downloadUrl: null,
    convertedName: "",
    inputVideoCodec: null,
    inputAudioCodec: null,
    videoQuality: DEFAULT_VIDEO_QUALITY,
  };
}

function setOutput(
  context: ConvertContext,
  output: OutputFormat,
): Partial<ConvertContext> {
  return {
    output,
    videoQuality:
      output.videoCodec === undefined
        ? context.videoQuality
        : clampVideoQuality(context.videoQuality, output.videoCodec),
  };
}

function setQuality(
  context: ConvertContext,
  quality: number,
): Partial<ConvertContext> {
  return {
    videoQuality: clampVideoQuality(
      quality,
      context.output?.videoCodec ?? "avc",
    ),
  };
}

function setCodecs(
  videoCodec: string | null,
  audioCodec: string | null,
): Partial<ConvertContext> {
  return { inputVideoCodec: videoCodec, inputAudioCodec: audioCodec };
}

function setProgress(percent: number): Partial<ConvertContext> {
  return { progress: percent };
}

function completeConversion(
  downloadUrl: string,
  convertedName: string,
): Partial<ConvertContext> {
  return { downloadUrl, convertedName, progress: 100 };
}

function setConversionError(message: string): Partial<ConvertContext> {
  return { error: message };
}

function resetAll(): Partial<ConvertContext> {
  return {
    file: null,
    output: null,
    progress: 0,
    error: null,
    downloadUrl: null,
    convertedName: "",
    inputVideoCodec: null,
    inputAudioCodec: null,
    videoQuality: DEFAULT_VIDEO_QUALITY,
  };
}

export const convertMachine = createMachine({
  id: "convert",
  schemas: {
    context: types<ConvertContext>(),
    events: {
      "file.selected": types<{ file: File }>(),
      "output.selected": types<{ output: OutputFormat }>(),
      "quality.selected": types<{ quality: number }>(),
      convert: types<Record<string, never>>(),
      progress: types<{ percent: number }>(),
      "conversion.done": types<{
        downloadUrl: string;
        convertedName: string;
      }>(),
      "conversion.error": types<{ message: string }>(),
      reset: types<Record<string, never>>(),
    },
  },
  actors: {
    probeFile: createAsyncLogic({
      id: "probeFile",
      // oxlint-disable-next-line effecttsgo/async-function -- XState v5 actor `run` must return a Promise; the mediabunny API is promise-based and loaded via dynamic import
      run: async ({ input }: { input: { file: File } }) => {
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
      },
    }),
    runConversion: createCallbackLogic<
      ConvertProgressEvent | ConvertDoneEvent | ConvertErrorEvent,
      { file: File; output: OutputFormat; videoQuality: number }
    >(({ sendBack, input }) => {
      // oxlint-disable-next-line effecttsgo/async-function -- createCallbackLogic callbacks must return void; conversion progress is streamed via sendBack from this fire-and-forget promise chain
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
            Quality,
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
                quality: new Quality({ quantizer: input.videoQuality }),
              }
            : undefined;

          const audioOptions = input.output.audioCodec
            ? {
                codec: input.output.audioCodec,
                quality: new Quality("very-high"),
              }
            : undefined;

          const initArgs: ConversionOptions = {
            input: mediabunnyInput,
            output: mediabunnyOutput,
          };
          if (audioOptions !== undefined) initArgs.audio = audioOptions;
          if (videoOptions !== undefined) initArgs.video = videoOptions;
          const conversion = await Conversion.init(initArgs);

          if (!conversion.isValid) {
            sendBack({
              type: "conversion.error",
              message: `Conversion is invalid: ${conversion.discardedTracks.map((t) => t.reason).join(", ")}`,
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
    videoQuality: DEFAULT_VIDEO_QUALITY,
  },
  states: {
    idle: {
      on: {
        "file.selected": ({ event }) => ({
          target: "ready",
          context: resetOnNewFile(event.file),
        }),
        "output.selected": ({ context, event }) => ({
          context: setOutput(context, event.output),
        }),
        "quality.selected": ({ context, event }) => ({
          context: setQuality(context, event.quality),
        }),
      },
    },
    ready: {
      invoke: {
        src: "probeFile",
        input: ({ context }) => {
          // `ready` is only entered via `file.selected`, which always sets a
          // file — but the machine context type cannot express that. Fail
          // fast here rather than asserting: the invoke's `onError` clears
          // the codecs and stays in `ready`.
          if (context.file === null) {
            throw new Error("probeFile invoked without a file");
          }
          return { file: context.file };
        },
        onDone: ({ event }) => ({
          context: setCodecs(event.output.videoCodec, event.output.audioCodec),
        }),
        onError: () => ({ context: setCodecs(null, null) }),
      },
      on: {
        "file.selected": ({ event }) => ({
          target: "ready",
          reenter: true,
          context: resetOnNewFile(event.file),
        }),
        "output.selected": ({ context, event }) => ({
          context: setOutput(context, event.output),
        }),
        "quality.selected": ({ context, event }) => ({
          context: setQuality(context, event.quality),
        }),
        convert: ({ context }) =>
          context.file !== null && context.output !== null
            ? { target: "converting" }
            : undefined,
      },
    },
    converting: {
      tags: ["converting"],
      invoke: {
        src: "runConversion",
        input: ({ context }) => ({
          // oxlint-disable-next-line typescript/no-non-null-assertion -- converting is only entered via the convert guard checking file and output non-null; the machine type cannot express this
          file: context.file!,
          // oxlint-disable-next-line typescript/no-non-null-assertion -- see file above
          output: context.output!,
          videoQuality: context.videoQuality,
        }),
      },
      on: {
        progress: ({ event }) => ({ context: setProgress(event.percent) }),
        "conversion.done": ({ event }) => ({
          target: "success",
          context: completeConversion(event.downloadUrl, event.convertedName),
        }),
        "conversion.error": ({ event }) => ({
          target: "error",
          context: setConversionError(event.message),
        }),
      },
    },
    success: {
      on: {
        "file.selected": ({ event }) => ({
          target: "ready",
          context: resetOnNewFile(event.file),
        }),
        "output.selected": ({ context, event }) => ({
          context: setOutput(context, event.output),
        }),
        "quality.selected": ({ context, event }) => ({
          context: setQuality(context, event.quality),
        }),
        reset: () => ({ target: "idle", context: resetAll() }),
      },
    },
    error: {
      on: {
        "file.selected": ({ event }) => ({
          target: "ready",
          context: resetOnNewFile(event.file),
        }),
        "output.selected": ({ context, event }) => ({
          context: setOutput(context, event.output),
        }),
        "quality.selected": ({ context, event }) => ({
          context: setQuality(context, event.quality),
        }),
        convert: ({ context }) =>
          context.file !== null && context.output !== null
            ? { target: "converting" }
            : undefined,
        reset: () => ({ target: "idle", context: resetAll() }),
      },
    },
  },
});

/**
 * `StateMachine` in xstate@6.0.0-alpha.36 declares
 * `validator?: ActorLogicValidator | undefined`, which is not assignable to
 * `AnyActorLogic` under `exactOptionalPropertyTypes`. This alias keeps the full
 * machine type while fixing only that variance, so the machine can be passed to
 * `createActor` / `useActorRef`.
 */
export type ConvertMachineLogic = Omit<typeof convertMachine, "validator"> & {
  validator?: NonNullable<AnyActorLogic["validator"]>;
};
