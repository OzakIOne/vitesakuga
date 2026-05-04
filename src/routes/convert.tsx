import {
  Alert,
  Box,
  Button,
  Container,
  FileUpload,
  Heading,
  Icon,
  Link,
  Portal,
  Progress,
  Select,
  Text,
  createListCollection,
} from "@chakra-ui/react";
import { createFileRoute } from "@tanstack/react-router";
import { useActorRef, useSelector } from "@xstate/react";
import type React from "react";
import { useCallback, useEffect } from "react";
import { LuUpload } from "react-icons/lu";
import type { AnyActorRef } from "xstate";

import {
  SUPPORTED_OUTPUTS,
  convertMachine,
  isPassthroughCompatible,
} from "./convert.machine";

const outputFormats = createListCollection({
  items: SUPPORTED_OUTPUTS.map((format) => ({
    label: format.label,
    value: format.label,
  })),
});

export const Route = createFileRoute("/convert")({
  component: RouteComponent,
  ssr: false,
});

type ActorLike = Pick<AnyActorRef, "getSnapshot" | "subscribe">;

function ConversionProgress({ actor }: { actor: ActorLike }) {
  const progress = useSelector(actor, (s) => s.context.progress as number);
  const isConverting = useSelector(
    actor,
    (s) => s.matches("converting") as boolean,
  );

  if (!isConverting) return null;

  return (
    <Box mb={4}>
      <Text mb={1}>Progress: {Math.round(progress)}%</Text>
      <Progress.Root striped value={progress}>
        <Progress.Track>
          <Progress.Range />
        </Progress.Track>
      </Progress.Root>
    </Box>
  );
}

function RouteComponent() {
  const actorRef = useActorRef(convertMachine);

  const file = useSelector(actorRef, (s) => s.context.file);
  const output = useSelector(actorRef, (s) => s.context.output);
  const error = useSelector(actorRef, (s) => s.context.error);
  const downloadUrl = useSelector(actorRef, (s) => s.context.downloadUrl);
  const convertedName = useSelector(actorRef, (s) => s.context.convertedName);
  const inputVideoCodec = useSelector(
    actorRef,
    (s) => s.context.inputVideoCodec,
  );
  const isConverting = useSelector(actorRef, (s) => s.matches("converting"));
  const isSuccess = useSelector(actorRef, (s) => s.matches("success"));

  const probeFile = useCallback(
    async (f: File) => {
      try {
        const { ALL_FORMATS, BlobSource, Input } = await import("mediabunny");
        const input = new Input({
          formats: ALL_FORMATS,
          source: new BlobSource(f),
        });
        const [videoTrack, audioTrack] = await Promise.all([
          input.getPrimaryVideoTrack(),
          input.getPrimaryAudioTrack(),
        ]);
        const [videoConfig, audioConfig] = await Promise.all([
          videoTrack?.getDecoderConfig(),
          audioTrack?.getDecoderConfig(),
        ]);
        actorRef.send({
          type: "file.probed",
          videoCodec: videoConfig?.codec ?? null,
          audioCodec: audioConfig?.codec ?? null,
        });
        input.dispose();
      } catch {
        actorRef.send({
          type: "file.probed",
          videoCodec: null,
          audioCodec: null,
        });
      }
    },
    [actorRef],
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { files } = e.target;
    if (files && files.length > 0) {
      const selected = files[0];
      actorRef.send({ type: "file.selected", file: selected });
      void probeFile(selected);
    }
  };

  // Clean up object URLs
  useEffect(
    () => () => {
      if (downloadUrl) {
        URL.revokeObjectURL(downloadUrl);
      }
    },
    [downloadUrl],
  );

  return (
    <Container maxW="xl" py={8}>
      <Box borderRadius="lg" p={6} shadow="md">
        <Heading mb={4} size="lg">
          Video/Audio Converter
        </Heading>
        <Text mb={4}>
          Convert your video or audio file to another format directly in your
          browser using WebCodecs. Powered by{" "}
          <Link color="blue.500" href="https://mediabunny.dev">
            Mediabunny
          </Link>
          .
        </Text>

        <Box mb={4}>
          <FileUpload.Root
            accept={["video/*", "audio/*", ".mkv"]}
            alignItems="stretch"
            maxW="xl"
            onChange={handleFileChange}
          >
            <FileUpload.HiddenInput />
            <FileUpload.Dropzone>
              <Icon as={LuUpload} boxSize={6} color="gray.500" mb={2} />
              <FileUpload.DropzoneContent>
                <Text>Drag and drop files here</Text>
                <Text color="gray.500" fontSize="sm">
                  .mp4, .mov, .mkv, .webm, .avi, .ts, .wav, .mp3, .flac
                </Text>
              </FileUpload.DropzoneContent>
            </FileUpload.Dropzone>
            <FileUpload.List clearable showSize />
          </FileUpload.Root>
        </Box>

        <Box mb={4}>
          <Box>
            <Text mb={2}>Output Format</Text>
            <Select.Root
              collection={outputFormats}
              disabled={isConverting}
              onSelect={(details) => {
                const o = SUPPORTED_OUTPUTS.find(
                  (opt) => opt.label === details.value,
                );
                if (o) {
                  actorRef.send({ type: "output.selected", output: o });
                }
              }}
              size="md"
              value={output ? [output.label] : []}
              width="full"
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
                    {SUPPORTED_OUTPUTS.map((format) => {
                      const compatible = isPassthroughCompatible(
                        format,
                        inputVideoCodec,
                      );
                      return (
                        <Select.Item
                          item={{
                            label: format.label,
                            value: format.label,
                            disabled: !compatible,
                          }}
                          key={format.label}
                        >
                          {format.label}
                          {!compatible && format.videoCodec === undefined && (
                            <Text as="span" color="fg.subtle">
                              {" "}
                              — codec incompatible
                            </Text>
                          )}
                        </Select.Item>
                      );
                    })}
                  </Select.Content>
                </Select.Positioner>
              </Portal>
            </Select.Root>
          </Box>
        </Box>

        <Button
          colorScheme="blue"
          disabled={!file || !output || isConverting}
          loading={isConverting}
          loadingText="Converting"
          mb={2}
          onClick={() => actorRef.send({ type: "convert" })}
        >
          Convert
        </Button>

        <ConversionProgress actor={actorRef} />

        {error && (
          <Alert.Root mb={4} status="error">
            <Alert.Content>
              <Alert.Indicator />
              <Alert.Title>Error</Alert.Title>
              <Alert.Description>
                {error}
                <Button
                  colorScheme="gray"
                  mt={2}
                  onClick={() => actorRef.send({ type: "reset" })}
                  size="sm"
                  variant="outline"
                >
                  Clear
                </Button>
              </Alert.Description>
            </Alert.Content>
          </Alert.Root>
        )}

        {downloadUrl && isSuccess && (
          <Alert.Root mb={4} status="success">
            <Alert.Content>
              <Alert.Indicator />
              <Alert.Title>Success</Alert.Title>
              <Alert.Description>
                <Text>Conversion complete!</Text>
                <Button asChild colorScheme="green" mt={2} size="sm">
                  <a download={convertedName} href={downloadUrl}>
                    Download
                  </a>
                </Button>
                <Button
                  colorScheme="gray"
                  ml={2}
                  mt={2}
                  onClick={() => actorRef.send({ type: "reset" })}
                  size="sm"
                  variant="outline"
                >
                  Convert Another
                </Button>
                {output?.container === "mp4" ? (
                  <video
                    controls
                    src={downloadUrl}
                    style={{
                      borderRadius: "0.5rem",
                      marginTop: "1rem",
                      maxHeight: "256px",
                      width: "100%",
                    }}
                  />
                ) : (
                  <audio
                    controls
                    src={downloadUrl}
                    style={{
                      marginTop: "1rem",
                      width: "100%",
                    }}
                  />
                )}
              </Alert.Description>
            </Alert.Content>
          </Alert.Root>
        )}

        <Text fontSize="sm">
          Supported input: mp4, mov, m4a, mkv, webm, avi, ts, wav, mp3, flac,
          aac, m3u8
        </Text>
        <Text fontSize="sm">
          Transcode: MP4 (H.264/AAC), WebM (VP9/Opus). Passthrough (no quality
          loss): MP4, WebM, MKV — copies codecs if compatible with target
          container.
        </Text>
      </Box>
    </Container>
  );
}
