import { createFileRoute } from "@tanstack/react-router";
import React, { useRef, useState } from "react";

// // Lazy load to avoid SSR issues
// const RemotionConvert = React.lazy(() =>
//   import("@remotion/webcodecs").then((mod) => ({ default: mod.convertMedia }))
// );

const SUPPORTED_OUTPUTS = [
  {
    label: "MP4 (H.264/AAC)",
    container: "mp4",
    videoCodec: "h264",
    audioCodec: "aac",
  },
  {
    label: "WebM (VP9/Opus)",
    container: "webm",
    videoCodec: "vp9",
    audioCodec: "opus",
  },
];

export const Route = createFileRoute("/convert")({
  component: RouteComponent,
});

function RouteComponent() {
  const [file, setFile] = useState<File | null>(null);
  const [output, setOutput] = useState();
  const [isConverting, setIsConverting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [convertedName, setConvertedName] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setDownloadUrl(null);
    const f = e.target.files?.[0] || null;
    setFile(f);
  };

  const handleConvert = async () => {
    if (!file) {
      setError("Please select a video or audio file.");
      return;
    }
    setIsConverting(true);
    setError(null);
    setDownloadUrl(null);
    setConvertedName("");
    try {
      // Dynamically import to avoid SSR issues
      const { convertMedia } = await import("@remotion/webcodecs");
      const result = await convertMedia({
        src: file,
        container: output.container,
        videoCodec: output.videoCodec,
        audioCodec: output.audioCodec,
      });
      const blob = await result.save();
      const url = URL.createObjectURL(blob);
      setDownloadUrl(url);
      // Suggest a filename
      const ext = output.container;
      const base = file.name.replace(/\.[^.]+$/, "");
      setConvertedName(`${base}-converted.${ext}`);
    } catch (e: any) {
      setError(e?.message || "Conversion failed. See console for details.");
      // eslint-disable-next-line no-console
      console.error(e);
    } finally {
      setIsConverting(false);
    }
  };

  // Clean up object URLs
  React.useEffect(() => {
    return () => {
      if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    };
  }, [downloadUrl]);

  return (
    <div className="max-w-xl mx-auto p-6 bg-base-200 rounded-lg shadow mt-8">
      <h1 className="text-2xl font-bold mb-4">Video/Audio Converter</h1>
      <p className="mb-4 text-base-content/70">
        Convert your video or audio file to another format directly in your
        browser using WebCodecs. Powered by{" "}
        <a
          href="https://www.remotion.dev/docs/webcodecs/convert-a-video"
          className="link"
          target="_blank"
          rel="noopener noreferrer"
        >
          Remotion WebCodecs
        </a>
        .
      </p>
      <div className="mb-4">
        <input
          ref={inputRef}
          type="file"
          accept="video/*,audio/*,.mkv"
          className="file-input"
          onChange={handleFileChange}
          disabled={isConverting}
        />
      </div>
      <div className="mb-4">
        <select
          className="select"
          onChange={(e) => {
            const o = SUPPORTED_OUTPUTS.find(
              (opt) => opt.label === e.target.value
            );
            if (o) setOutput(o);
          }}
          disabled={isConverting}
        >
          <option disabled selected>
            Output format
          </option>

          {SUPPORTED_OUTPUTS.map((opt) => (
            <option key={opt.label} value={opt.label}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
      <button
        className="btn btn-primary mb-4"
        onClick={handleConvert}
        disabled={!file || isConverting}
      >
        {isConverting ? (
          <span className="loading loading-spinner loading-sm mr-2" />
        ) : null}
        Convert
      </button>
      {error && (
        <div className="alert alert-error mb-4">
          <span>{error}</span>
        </div>
      )}
      {downloadUrl && (
        <div className="alert alert-success flex-col items-start mb-4">
          <span>Conversion complete!</span>
          <a
            href={downloadUrl}
            download={convertedName}
            className="btn btn-success btn-sm mt-2"
          >
            Download
          </a>
          <video
            src={downloadUrl}
            controls
            className="mt-4 rounded-lg max-h-64 w-full"
            style={{ display: output.container !== "wav" ? "block" : "none" }}
          />
          <audio
            src={downloadUrl}
            controls
            className="mt-4 w-full"
            style={{ display: output.container === "wav" ? "block" : "none" }}
          />
        </div>
      )}
      <div className="text-xs text-base-content/50 mt-6">
        Supported input: mp4, mov, m4a, mkv, webm, avi, ts, wav, mp3, flac, aac,
        m3u8
        <br />
        Supported output: MP4 (H.264/AAC), WebM (VP9/Opus)
      </div>
    </div>
  );
}
