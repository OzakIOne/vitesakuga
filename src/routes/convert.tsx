import { createFileRoute } from "@tanstack/react-router";
import React, { useState } from "react";
import {
  Box,
  Button,
  Heading,
  Text,
  Select,
  Container,
  Alert,
  Link,
  Portal,
  Icon,
  FileUpload,
} from "@chakra-ui/react";
import { LuUpload } from "react-icons/lu";
import { createListCollection } from "@chakra-ui/react";

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
  const [output, setOutput] = useState();
  const [isConverting, setIsConverting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [convertedName, setConvertedName] = useState<string>("");

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
    <Container maxW="xl" py={8}>
      <Box bg="gray.50" p={6} borderRadius="lg" shadow="md">
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
            onFileChange={handleFileChange}
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
          <Select.Root
            collection={outputFormats}
            size="md"
            width="full"
            disabled={isConverting}
            value={output?.label}
            onChange={(value) => {
              const o = SUPPORTED_OUTPUTS.find((opt) => opt.label === value);
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
                  {outputFormats.items.map((format) => (
                    <Select.Item item={format} key={format.value}>
                      {format.label}
                      <Select.ItemIndicator />
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select.Positioner>
            </Portal>
          </Select.Root>
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
                <Button
                  as={"link"}
                  href={downloadUrl}
                  download={convertedName}
                  size="sm"
                  colorScheme="green"
                  mt={2}
                >
                  Download
                </Button>
                {output.container !== "wav" ? (
                  <Box
                    as="video"
                    src={downloadUrl}
                    controls
                    mt={4}
                    maxH="256px"
                    w="full"
                    borderRadius="lg"
                  />
                ) : (
                  <Box as="audio" src={downloadUrl} controls mt={4} w="full" />
                )}
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
