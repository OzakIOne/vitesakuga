import { createActor } from "xstate";
import { describe, expect, it } from "vitest";

import {
  convertMachine,
  getCodecFamily,
  isPassthroughCompatible,
  SUPPORTED_OUTPUTS,
} from "../routes/-convert.machine";

describe(getCodecFamily, () => {
  it("returns avc for AVC codecs", () => {
    expect(getCodecFamily("avc1")).toBe("avc");
    expect(getCodecFamily("AVC1.4D401E")).toBe("avc");
    expect(getCodecFamily("avc3")).toBe("avc");
  });

  it("returns hevc for HEVC codecs", () => {
    expect(getCodecFamily("hvc1")).toBe("hevc");
    expect(getCodecFamily("hev1")).toBe("hevc");
    expect(getCodecFamily("HVC1.1.6.L93.90")).toBe("hevc");
  });

  it("returns vp for VP8/VP9 codecs", () => {
    expect(getCodecFamily("vp09")).toBe("vp");
    expect(getCodecFamily("vp08")).toBe("vp");
    expect(getCodecFamily("vp9")).toBe("vp");
  });

  it("returns av1 for AV1 codecs", () => {
    expect(getCodecFamily("av01")).toBe("av1");
    expect(getCodecFamily("av1.")).toBe("av1");
  });

  it("returns null for unsupported codecs", () => {
    expect(getCodecFamily("theora")).toBeNull();
    expect(getCodecFamily("")).toBeNull();
    expect(getCodecFamily("mp4v")).toBeNull();
  });
});

describe(isPassthroughCompatible, () => {
  const mp4Passthrough = SUPPORTED_OUTPUTS[1];
  const webmPassthrough = SUPPORTED_OUTPUTS[3];
  const mkvPassthrough = SUPPORTED_OUTPUTS[4];
  const mp4Transcode = SUPPORTED_OUTPUTS[0];

  it("transcode options are always compatible", () => {
    expect(isPassthroughCompatible(mp4Transcode, "avc1")).toBe(true);
    expect(isPassthroughCompatible(mp4Transcode, "vp09")).toBe(true);
    expect(isPassthroughCompatible(mp4Transcode, null)).toBe(true);
  });

  it("MKV passthrough supports any codec", () => {
    expect(isPassthroughCompatible(mkvPassthrough, "avc1")).toBe(true);
    expect(isPassthroughCompatible(mkvPassthrough, "vp09")).toBe(true);
    expect(isPassthroughCompatible(mkvPassthrough, "hvc1")).toBe(true);
    expect(isPassthroughCompatible(mkvPassthrough, null)).toBe(true);
  });

  it("allows passthrough when codec is not yet probed", () => {
    expect(isPassthroughCompatible(mp4Passthrough, null)).toBe(true);
  });

  it("allows passthrough when codec family is unknown", () => {
    expect(isPassthroughCompatible(mp4Passthrough, "theora")).toBe(true);
  });

  it("MP4 passthrough supports AVC and HEVC", () => {
    expect(isPassthroughCompatible(mp4Passthrough, "avc1")).toBe(true);
    expect(isPassthroughCompatible(mp4Passthrough, "hvc1")).toBe(true);
  });

  it("MP4 passthrough rejects VP and AV1 codecs", () => {
    expect(isPassthroughCompatible(mp4Passthrough, "vp09")).toBe(false);
    expect(isPassthroughCompatible(mp4Passthrough, "av01")).toBe(false);
  });

  it("WebM passthrough supports VP and AV1", () => {
    expect(isPassthroughCompatible(webmPassthrough, "vp09")).toBe(true);
    expect(isPassthroughCompatible(webmPassthrough, "av01")).toBe(true);
  });

  it("WebM passthrough rejects AVC and HEVC", () => {
    expect(isPassthroughCompatible(webmPassthrough, "avc1")).toBe(false);
    expect(isPassthroughCompatible(webmPassthrough, "hvc1")).toBe(false);
  });
});

describe("convertMachine", () => {
  const dummyFile = new File(["dummy"], "test.mp4", { type: "video/mp4" });

  const mp4Transcode = SUPPORTED_OUTPUTS[0];

  function createConvertActor() {
    return createActor(convertMachine);
  }

  it("starts in idle state", () => {
    const actor = createConvertActor();
    actor.start();
    expect(actor.getSnapshot().value).toBe("idle");
  });

  describe("file.selected event", () => {
    it("transitions idle → ready and sets file", () => {
      const actor = createConvertActor();
      actor.start();
      actor.send({ type: "file.selected", file: dummyFile });
      expect(actor.getSnapshot().value).toBe("ready");
      expect(actor.getSnapshot().context.file).toBe(dummyFile);
    });

    it("clears output, codecs, and errors on new file selection", () => {
      const actor = createConvertActor();
      actor.start();
      actor.send({ type: "file.probed", videoCodec: "avc1", audioCodec: "aac" });
      actor.send({ type: "output.selected", output: mp4Transcode });
      actor.send({ type: "file.selected", file: dummyFile });

      const ctx = actor.getSnapshot().context;
      expect(ctx.output).toBeNull();
      expect(ctx.inputVideoCodec).toBeNull();
      expect(ctx.inputAudioCodec).toBeNull();
      expect(ctx.downloadUrl).toBeNull();
      expect(ctx.error).toBeNull();
    });
  });

  describe("file.probed event", () => {
    it("sets codec info while staying in ready", () => {
      const actor = createConvertActor();
      actor.start();
      actor.send({ type: "file.selected", file: dummyFile });
      actor.send({ type: "file.probed", videoCodec: "avc1", audioCodec: "aac" });

      expect(actor.getSnapshot().value).toBe("ready");
      expect(actor.getSnapshot().context.inputVideoCodec).toBe("avc1");
      expect(actor.getSnapshot().context.inputAudioCodec).toBe("aac");
    });
  });

  describe("output.selected event", () => {
    it("sets output while staying in ready", () => {
      const actor = createConvertActor();
      actor.start();
      actor.send({ type: "file.selected", file: dummyFile });
      actor.send({ type: "output.selected", output: mp4Transcode });

      expect(actor.getSnapshot().value).toBe("ready");
      expect(actor.getSnapshot().context.output).toBe(mp4Transcode);
    });

    it("sets output from error state", () => {
      const actor = createConvertActor();
      actor.start();
      actor.send({ type: "file.selected", file: dummyFile });
      actor.send({ type: "output.selected", output: mp4Transcode });
      actor.send({ type: "convert" });
      actor.send({ type: "conversion.error", message: "fail" });
      expect(actor.getSnapshot().matches("error")).toBe(true);

      actor.send({ type: "output.selected", output: mp4Transcode });
      expect(actor.getSnapshot().context.output).toBe(mp4Transcode);
    });
  });

  describe("convert event", () => {
    it("transitions ready → converting when file and output are set", () => {
      const actor = createConvertActor();
      actor.start();
      actor.send({ type: "file.selected", file: dummyFile });
      actor.send({ type: "output.selected", output: mp4Transcode });
      actor.send({ type: "convert" });

      expect(actor.getSnapshot().value).toBe("converting");
    });

    it("stays in ready when output is missing (guard)", () => {
      const actor = createConvertActor();
      actor.start();
      actor.send({ type: "file.selected", file: dummyFile });
      // no output.selected — guard should block
      actor.send({ type: "convert" });

      expect(actor.getSnapshot().value).toBe("ready");
    });

    it("transitions error → converting when retrying", () => {
      const actor = createConvertActor();
      actor.start();
      actor.send({ type: "file.selected", file: dummyFile });
      actor.send({ type: "output.selected", output: mp4Transcode });
      actor.send({ type: "convert" });
      actor.send({ type: "conversion.error", message: "fail" });
      expect(actor.getSnapshot().matches("error")).toBe(true);

      actor.send({ type: "convert" });
      expect(actor.getSnapshot().value).toBe("converting");
    });
  });

  describe("progress event", () => {
    it("updates progress while converting", () => {
      const actor = createConvertActor();
      actor.start();
      actor.send({ type: "file.selected", file: dummyFile });
      actor.send({ type: "output.selected", output: mp4Transcode });
      actor.send({ type: "convert" });
      actor.send({ type: "progress", percent: 42 });

      expect(actor.getSnapshot().context.progress).toBe(42);
    });
  });

  describe("conversion.done event", () => {
    it("transitions converting → success and sets download data", () => {
      const actor = createConvertActor();
      actor.start();
      actor.send({ type: "file.selected", file: dummyFile });
      actor.send({ type: "output.selected", output: mp4Transcode });
      actor.send({ type: "convert" });
      actor.send({
        type: "conversion.done",
        downloadUrl: "blob://test",
        convertedName: "test-converted.mp4",
      });

      expect(actor.getSnapshot().value).toBe("success");
      expect(actor.getSnapshot().context.downloadUrl).toBe("blob://test");
      expect(actor.getSnapshot().context.convertedName).toBe(
        "test-converted.mp4",
      );
      expect(actor.getSnapshot().context.progress).toBe(100);
    });
  });

  describe("conversion.error event", () => {
    it("transitions converting → error and sets error message", () => {
      const actor = createConvertActor();
      actor.start();
      actor.send({ type: "file.selected", file: dummyFile });
      actor.send({ type: "output.selected", output: mp4Transcode });
      actor.send({ type: "convert" });
      actor.send({
        type: "conversion.error",
        message: "Conversion failed",
      });

      expect(actor.getSnapshot().value).toBe("error");
      expect(actor.getSnapshot().context.error).toBe("Conversion failed");
    });
  });

  describe("reset event", () => {
    it("transitions success → idle and clears context", () => {
      const actor = createConvertActor();
      actor.start();
      actor.send({ type: "file.selected", file: dummyFile });
      actor.send({ type: "output.selected", output: mp4Transcode });
      actor.send({ type: "convert" });
      actor.send({
        type: "conversion.done",
        downloadUrl: "blob://test",
        convertedName: "test-converted.mp4",
      });
      actor.send({ type: "reset" });

      const ctx = actor.getSnapshot().context;
      expect(actor.getSnapshot().value).toBe("idle");
      expect(ctx.file).toBeNull();
      expect(ctx.output).toBeNull();
      expect(ctx.progress).toBe(0);
      expect(ctx.error).toBeNull();
      expect(ctx.downloadUrl).toBeNull();
      expect(ctx.convertedName).toBe("");
      expect(ctx.inputVideoCodec).toBeNull();
      expect(ctx.inputAudioCodec).toBeNull();
    });

    it("transitions error → idle and clears context", () => {
      const actor = createConvertActor();
      actor.start();
      actor.send({ type: "file.selected", file: dummyFile });
      actor.send({ type: "output.selected", output: mp4Transcode });
      actor.send({ type: "convert" });
      actor.send({
        type: "conversion.error",
        message: "Conversion failed",
      });
      actor.send({ type: "reset" });

      expect(actor.getSnapshot().value).toBe("idle");
      expect(actor.getSnapshot().context.error).toBeNull();
    });
  });

  describe("file.selected from success state", () => {
    it("transitions success → ready", () => {
      const actor = createConvertActor();
      actor.start();
      actor.send({ type: "file.selected", file: dummyFile });
      actor.send({ type: "output.selected", output: mp4Transcode });
      actor.send({ type: "convert" });
      actor.send({
        type: "conversion.done",
        downloadUrl: "blob://test",
        convertedName: "test-converted.mp4",
      });
      actor.send({ type: "file.selected", file: new File(["new"], "new.mp4", { type: "video/mp4" }) });

      expect(actor.getSnapshot().value).toBe("ready");
      expect(actor.getSnapshot().context.downloadUrl).toBeNull();
    });
  });

  describe("file.selected from error state", () => {
    it("transitions error → ready", () => {
      const actor = createConvertActor();
      actor.start();
      actor.send({ type: "file.selected", file: dummyFile });
      actor.send({ type: "output.selected", output: mp4Transcode });
      actor.send({ type: "convert" });
      actor.send({
        type: "conversion.error",
        message: "fail",
      });
      actor.send({ type: "file.selected", file: new File(["new"], "new.mp4", { type: "video/mp4" }) });

      expect(actor.getSnapshot().value).toBe("ready");
      expect(actor.getSnapshot().context.error).toBeNull();
    });
  });
});
