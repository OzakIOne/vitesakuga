import type {
  ConversionCopyOptions,
  ConversionOptions,
  Input,
} from "mediabunny";
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

export type CopyMode = NonNullable<ConversionCopyOptions["mode"]>;
export type BoundaryPolicy = NonNullable<
  ConversionCopyOptions["boundaryPolicy"]
>;
export type TrimRange = { start: number; end: number };

export const DEFAULT_COPY_OPTIONS = {
  boundaryPolicy: "expand",
  mode: "preferred",
  shiftTolerance: 0,
} satisfies Required<ConversionCopyOptions>;

export function normalizeTrimRange(
  start: number,
  end: number,
  duration: number,
): TrimRange {
  if (!Number.isFinite(duration) || duration <= 0) {
    return { end: 0, start: 0 };
  }

  const clampedStart = Math.min(duration, Math.max(0, start));
  const clampedEnd = Math.min(duration, Math.max(0, end));
  if (clampedStart >= clampedEnd) {
    return { end: duration, start: 0 };
  }
  return { end: clampedEnd, start: clampedStart };
}

export function hasTrimmedRange(
  start: number,
  end: number,
  duration: number,
): boolean {
  return (
    Number.isFinite(duration) && duration > 0 && (start > 0 || end < duration)
  );
}

/**
 * Lowest CRF/quantizer users may select (lower = higher quality). Keeps near-lossless
 * settings like CRF 0 or 1 out of reach, since they produce impractically large files.
 */
const VIDEO_QUALITY_MIN = 2;

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
  duration: number | null;
  inputStartTimestamp: number | null;
  trimStart: number;
  trimEnd: number;
  copyMode: CopyMode;
  boundaryPolicy: BoundaryPolicy;
  shiftTolerance: number;
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
    duration: null,
    inputStartTimestamp: null,
    trimStart: 0,
    trimEnd: 0,
    copyMode: DEFAULT_COPY_OPTIONS.mode,
    boundaryPolicy: DEFAULT_COPY_OPTIONS.boundaryPolicy,
    shiftTolerance: DEFAULT_COPY_OPTIONS.shiftTolerance,
  };
}

function resetConversionResult(): Partial<ConvertContext> {
  return { downloadUrl: null, convertedName: "", error: null, progress: 0 };
}

function setOutput(
  context: ConvertContext,
  output: OutputFormat,
): Partial<ConvertContext> {
  return {
    output,
    ...resetConversionResult(),
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
    ...resetConversionResult(),
  };
}

function setTrim(
  context: ConvertContext,
  start: number,
  end: number,
): Partial<ConvertContext> {
  if (context.duration === null) return {};
  const range = normalizeTrimRange(start, end, context.duration);
  return {
    ...resetConversionResult(),
    trimEnd: range.end,
    trimStart: range.start,
  };
}

function setCopyOptions(
  options: Partial<
    Pick<ConvertContext, "boundaryPolicy" | "copyMode" | "shiftTolerance">
  >,
): Partial<ConvertContext> {
  return { ...options, ...resetConversionResult() };
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
    duration: null,
    inputStartTimestamp: null,
    trimStart: 0,
    trimEnd: 0,
    copyMode: DEFAULT_COPY_OPTIONS.mode,
    boundaryPolicy: DEFAULT_COPY_OPTIONS.boundaryPolicy,
    shiftTolerance: DEFAULT_COPY_OPTIONS.shiftTolerance,
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
      "trim.selected": types<TrimRange>(),
      "copy.mode.selected": types<{ mode: CopyMode }>(),
      "copy.boundary.selected": types<{ boundaryPolicy: BoundaryPolicy }>(),
      "copy.shiftTolerance.selected": types<{ shiftTolerance: number }>(),
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
          const [inputStartTimestamp, inputEndTimestamp] = await Promise.all([
            mediainput.getFirstTimestamp(),
            mediainput.computeDuration(),
          ]);
          const [videoConfig, audioConfig] = await Promise.all([
            videoTrack?.getDecoderConfig(),
            audioTrack?.getDecoderConfig(),
          ]);
          return {
            duration: Math.max(0, inputEndTimestamp - inputStartTimestamp),
            inputStartTimestamp,
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
      {
        copy: ConversionCopyOptions;
        file: File;
        output: OutputFormat;
        trim: TrimRange | null;
        videoQuality: number;
      }
    >(({ sendBack, input }) => {
      // oxlint-disable-next-line effecttsgo/async-function -- createCallbackLogic callbacks must return void; conversion progress is streamed via sendBack from this fire-and-forget promise chain
      void (async () => {
        let mediabunnyInput: Input | null = null;
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

          mediabunnyInput = new Input({
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
            copy:
              videoOptions === undefined && audioOptions === undefined
                ? input.copy
                : false,
            input: mediabunnyInput,
            output: mediabunnyOutput,
          };
          if (audioOptions !== undefined) initArgs.audio = audioOptions;
          if (videoOptions !== undefined) initArgs.video = videoOptions;
          if (input.trim !== null) initArgs.trim = input.trim;
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
            type: outputFormat.mimeType,
          });
          const url = URL.createObjectURL(blob);
          const ext = outputFormat.fileExtension.slice(1);
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
        } finally {
          mediabunnyInput?.dispose();
        }
      })();

      return () => {};
    }),
  },
  initial: "idle",
  context: {
    file: null,
    output: null,
    duration: null,
    inputStartTimestamp: null,
    trimStart: 0,
    trimEnd: 0,
    copyMode: DEFAULT_COPY_OPTIONS.mode,
    boundaryPolicy: DEFAULT_COPY_OPTIONS.boundaryPolicy,
    shiftTolerance: DEFAULT_COPY_OPTIONS.shiftTolerance,
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
          context: {
            ...setCodecs(event.output.videoCodec, event.output.audioCodec),
            duration: event.output.duration ?? null,
            inputStartTimestamp: event.output.inputStartTimestamp ?? null,
            trimEnd: event.output.duration ?? 0,
            trimStart: 0,
          },
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
        "trim.selected": ({ context, event }) => ({
          context: setTrim(context, event.start, event.end),
        }),
        "copy.mode.selected": ({ event }) => ({
          context: setCopyOptions({ copyMode: event.mode }),
        }),
        "copy.boundary.selected": ({ event }) => ({
          context: setCopyOptions({ boundaryPolicy: event.boundaryPolicy }),
        }),
        "copy.shiftTolerance.selected": ({ event }) => ({
          context: setCopyOptions({ shiftTolerance: event.shiftTolerance }),
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
          trim:
            context.duration !== null &&
            hasTrimmedRange(
              context.trimStart,
              context.trimEnd,
              context.duration,
            )
              ? {
                  end: (context.inputStartTimestamp ?? 0) + context.trimEnd,
                  start: (context.inputStartTimestamp ?? 0) + context.trimStart,
                }
              : null,
          copy: {
            boundaryPolicy: context.boundaryPolicy,
            mode: context.copyMode,
            shiftTolerance: context.shiftTolerance,
          },
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
        "trim.selected": ({ context, event }) => ({
          context: setTrim(context, event.start, event.end),
        }),
        "copy.mode.selected": ({ event }) => ({
          context: setCopyOptions({ copyMode: event.mode }),
        }),
        "copy.boundary.selected": ({ event }) => ({
          context: setCopyOptions({ boundaryPolicy: event.boundaryPolicy }),
        }),
        "copy.shiftTolerance.selected": ({ event }) => ({
          context: setCopyOptions({ shiftTolerance: event.shiftTolerance }),
        }),
        convert: ({ context }) =>
          context.file !== null && context.output !== null
            ? { target: "converting" }
            : undefined,
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
        "trim.selected": ({ context, event }) => ({
          context: setTrim(context, event.start, event.end),
        }),
        "copy.mode.selected": ({ event }) => ({
          context: setCopyOptions({ copyMode: event.mode }),
        }),
        "copy.boundary.selected": ({ event }) => ({
          context: setCopyOptions({ boundaryPolicy: event.boundaryPolicy }),
        }),
        "copy.shiftTolerance.selected": ({ event }) => ({
          context: setCopyOptions({ shiftTolerance: event.shiftTolerance }),
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
