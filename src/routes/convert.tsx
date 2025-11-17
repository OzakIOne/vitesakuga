import {
  Alert,
  Box,
  Button,
  Container,
  createListCollection,
  FileUpload,
  Heading,
  Icon,
  Link,
  Portal,
  Select,
  Text,
} from "@chakra-ui/react";
import { createFileRoute } from "@tanstack/react-router";
import React, { useState } from "react";
import { LuUpload } from "react-icons/lu";

type OutputFormat = {
  label: string;
  container: "mp4" | "webm";
  videoCodec: "h264" | "vp9";
  audioCodec: "aac" | "opus";
};

const SUPPORTED_OUTPUTS: OutputFormat[] = [
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

const outputFormats = createListCollection({
  items: SUPPORTED_OUTPUTS.map((format) => ({
    label: format.label,
    value: format.label,
  })),
});

export const Route = createFileRoute("/convert")({
  component: RouteComponent,
});

function RouteComponent() {
  const [file, setFile] = useState<File | null>(null);
  const [output, setOutput] = useState<
    (typeof SUPPORTED_OUTPUTS)[0] | undefined
  >();
  const [isConverting, setIsConverting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [convertedName, setConvertedName] = useState<string>("");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setDownloadUrl(null);
    const files = e.target.files;
    if (files && files.length > 0) {
      setFile(files[0]);
    }
  };

  const handleConvert = async () => {
    if (!file || !output) {
      setError("Please select a file and output format.");
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
      const ext = output.container;
      const base = file.name.replace(/\.[^.]+$/, "");
      setConvertedName(`${base}-converted.${ext}`);
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
    <Container maxW="xl" py={8}>
      <Box p={6} borderRadius="lg" shadow="md">
        <Heading size="lg" mb={4}>
          Video/Audio Converter
        </Heading>
        <Text mb={4}>
          Convert your video or audio file to another format directly in your
          browser using WebCodecs. Powered by{" "}
          <Link
            href="https://www.remotion.dev/docs/webcodecs/convert-a-video"
            color="blue.500"
          >
            Remotion WebCodecs
          </Link>
          .
        </Text>

        <Box mb={4}>
          <FileUpload.Root
            maxW="xl"
            alignItems="stretch"
            accept={["video/*", "audio/*", ".mkv"]}
            onChange={handleFileChange}
          >
            <FileUpload.HiddenInput />
            <FileUpload.Dropzone>
              <Icon as={LuUpload} boxSize={6} color="gray.500" mb={2} />
              <FileUpload.DropzoneContent>
                <Text>Drag and drop files here</Text>
                <Text fontSize="sm" color="gray.500">
                  .mp4, .mov, .mkv, .webm, .avi, .ts, .wav, .mp3, .flac
                </Text>
              </FileUpload.DropzoneContent>
            </FileUpload.Dropzone>
            <FileUpload.List showSize clearable />
          </FileUpload.Root>
        </Box>

        <Box mb={4}>
          <Box>
            <Text mb={2}>Output Format</Text>
            <Select.Root
              collection={outputFormats}
              size="md"
              width="full"
              disabled={isConverting}
              value={output ? [output.label] : []}
              onSelect={(details) => {
                const o = SUPPORTED_OUTPUTS.find(
                  (opt) => opt.label === details.value
                );
                if (o) setOutput(o);
              }}
            >
              <Select.Label>Output Format</Select.Label>
              <Select.Control>
                <Select.Trigger>
                  <Select.ValueText placeholder="Select format" />
                </Select.Trigger>
                <Select.IndicatorGroup>
                  <Select.Indicator />
                </Select.IndicatorGroup>
              </Select.Control>
              <Portal>
                <Select.Positioner>
                  <Select.Content>
                    {SUPPORTED_OUTPUTS.map((format) => (
                      <Select.Item
                        item={{ label: format.label, value: format.label }}
                        key={format.label}
                      >
                        {format.label}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select.Positioner>
              </Portal>
            </Select.Root>
          </Box>
        </Box>

        <Button
          colorScheme="blue"
          onClick={handleConvert}
          disabled={!file || isConverting}
          loading={isConverting}
          loadingText="Converting"
          mb={4}
        >
          Convert
        </Button>

        {error && (
          <Alert.Root status="error" mb={4}>
            <Alert.Content>
              <Alert.Indicator />
              <Alert.Title>Error</Alert.Title>
              <Alert.Description>{error}</Alert.Description>
            </Alert.Content>
          </Alert.Root>
        )}

        {downloadUrl && (
          <Alert.Root status="success" mb={4}>
            <Alert.Content>
              <Alert.Indicator />
              <Alert.Title>Success</Alert.Title>
              <Alert.Description>
                <Text>Conversion complete!</Text>
                <Button asChild size="sm" colorScheme="green" mt={2}>
                  <a href={downloadUrl} download={convertedName}>
                    Download
                  </a>
                </Button>
                {downloadUrl &&
                  (output?.container === "mp4" ? (
                    <video
                      src={downloadUrl}
                      controls
                      style={{
                        marginTop: "1rem",
                        maxHeight: "256px",
                        width: "100%",
                        borderRadius: "0.5rem",
                      }}
                    />
                  ) : (
                    <audio
                      src={downloadUrl}
                      controls
                      style={{
                        marginTop: "1rem",
                        width: "100%",
                      }}
                    />
                  ))}
              </Alert.Description>
            </Alert.Content>
          </Alert.Root>
        )}

        <Text fontSize="sm" color="gray.600">
          Supported input: mp4, mov, m4a, mkv, webm, avi, ts, wav, mp3, flac,
          aac, m3u8
        </Text>
        <Text fontSize="sm" color="gray.600">
          Supported output: MP4 (H.264/AAC), WebM (VP9/Opus)
        </Text>
      </Box>
    </Container>
  );
}
