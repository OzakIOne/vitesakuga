import {
  Portal,
  createListCollection,
  type ComboboxValueChangeDetails,
} from "@ark-ui/react";
import { createLazyFileRoute } from "@tanstack/react-router";
import { useActorRef, useSelector } from "@xstate/react";
import { useEffect, useMemo, useState } from "react";
import { LuUpload } from "react-icons/lu";
import { Button } from "src/components/ui/button";
import { Alert, Progress } from "src/components/ui/feedback";
import { Box, Container, Flex } from "src/components/ui/layout";
import { Combobox, FileUpload, Slider } from "src/components/ui/overlay";
import { Heading, Link, Text } from "src/components/ui/typography";
import type { AnyActorRef } from "xstate";

import {
  SUPPORTED_OUTPUTS,
  convertMachine,
  getVideoQualityRange,
  isPassthroughCompatible,
} from "./-convert.machine";
import type { ConvertMachineLogic } from "./-convert.machine";

export const Route = createLazyFileRoute("/convert")({
  component: RouteComponent,
  pendingComponent: () => (
    <Container maxW="xl" py={8}>
      <Text>Loading converter...</Text>
    </Container>
  ),
});

type ActorLike = Pick<AnyActorRef, "getSnapshot" | "subscribe">;

function ConversionProgress({ actor }: { actor: ActorLike }) {
  const progress = useSelector(actor, (s) => s.context.progress);
  const isConverting = useSelector(actor, (s) => s.hasTag("converting"));

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
  // xstate@6.0.0-alpha.36 types `StateMachine.validator` with an explicit
  // `| undefined`, which fails the `AnyActorLogic` constraint of `useActorRef`
  // under `exactOptionalPropertyTypes`. `ConvertMachineLogic` fixes only that.
  const actorRef = useActorRef(
    convertMachine as unknown as ConvertMachineLogic,
  );

  const file = useSelector(actorRef, (s) => s.context.file);
  const output = useSelector(actorRef, (s) => s.context.output);
  const error = useSelector(actorRef, (s) => s.context.error);
  const downloadUrl = useSelector(actorRef, (s) => s.context.downloadUrl);
  const convertedName = useSelector(actorRef, (s) => s.context.convertedName);
  const inputVideoCodec = useSelector(
    actorRef,
    (s) => s.context.inputVideoCodec,
  );
  const videoQuality = useSelector(actorRef, (s) => s.context.videoQuality);
  const isConverting = useSelector(actorRef, (s) => s.matches("converting"));
  const isSuccess = useSelector(actorRef, (s) => s.matches("success"));

  const handleFileChange = (file: File | null) => {
    if (file) {
      actorRef.send({ type: "file.selected", file });
    }
  };

  const [formatInputValue, setFormatInputValue] = useState("");

  const outputCollection = useMemo(() => {
    const items: { disabled: boolean; label: string; value: string }[] = [];
    for (const format of SUPPORTED_OUTPUTS) {
      if (
        !format.label.toLowerCase().includes(formatInputValue.toLowerCase())
      ) {
        continue;
      }
      items.push({
        disabled: !isPassthroughCompatible(format, inputVideoCodec),
        label: format.label,
        value: format.label,
      });
    }
    return createListCollection({
      isItemDisabled: (item) => item.disabled,
      itemToValue: (item) => item.value,
      itemToString: (item) => item.label,
      items,
    });
  }, [formatInputValue, inputVideoCodec]);

  const handleOutputValueChange = (details: ComboboxValueChangeDetails) => {
    const item = details.items[0] as
      | { label: string; value: string }
      | undefined;
    if (!item) {
      return;
    }
    const format = SUPPORTED_OUTPUTS.find((opt) => opt.label === item.label);
    if (format) {
      actorRef.send({ type: "output.selected", output: format });
    }
    setFormatInputValue(item.label);
  };

  useEffect(
    () => () => {
      if (downloadUrl) {
        URL.revokeObjectURL(downloadUrl);
      }
    },
    [downloadUrl],
  );

  return (
    <Flex
      align="center"
      direction="column"
      justify="center"
      minH="calc(100vh - 4rem)"
      p={4}
    >
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
              onFileChange={(details) => {
                handleFileChange(details.acceptedFiles[0] ?? null);
              }}
            >
              <FileUpload.HiddenInput />
              <FileUpload.Dropzone>
                <LuUpload className="mb-2 h-6 w-6 text-gray-500" />
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
              <Combobox.Root
                collection={outputCollection}
                disabled={isConverting}
                inputValue={formatInputValue}
                onInputValueChange={(details) => {
                  if (details.reason === "input-change") {
                    setFormatInputValue(details.inputValue);
                  }
                }}
                onOpenChange={(details) => {
                  if (details.open) {
                    setFormatInputValue("");
                  }
                }}
                onValueChange={handleOutputValueChange}
                openOnChange={false}
                openOnClick
                selectionBehavior="replace"
                value={output ? [output.label] : []}
              >
                <Combobox.Label>Output Format</Combobox.Label>
                <Combobox.Control>
                  <Combobox.Input
                    placeholder="Select format"
                    value={formatInputValue}
                  />
                  <Combobox.IndicatorGroup>
                    <Combobox.Trigger />
                  </Combobox.IndicatorGroup>
                </Combobox.Control>
                <Portal>
                  <Combobox.Positioner>
                    <Combobox.Content>
                      {outputCollection.items.map((item) => {
                        const format = SUPPORTED_OUTPUTS.find(
                          (opt) => opt.label === item.label,
                        );
                        const compatible =
                          format !== undefined &&
                          isPassthroughCompatible(format, inputVideoCodec);
                        return (
                          <Combobox.Item item={item} key={item.label}>
                            <Combobox.ItemText>
                              {item.label}
                              {!compatible &&
                                format?.videoCodec === undefined && (
                                  <Text as="span" color="fg.subtle">
                                    {" "}
                                    — codec incompatible
                                  </Text>
                                )}
                            </Combobox.ItemText>
                            <Combobox.ItemIndicator />
                          </Combobox.Item>
                        );
                      })}
                    </Combobox.Content>
                  </Combobox.Positioner>
                </Portal>
              </Combobox.Root>
            </Box>
          </Box>

          {output?.videoCodec && (
            <Box mb={4}>
              <Text mb={2}>Encoding Quality</Text>
              <Slider.Root
                disabled={isConverting}
                max={getVideoQualityRange(output.videoCodec).max}
                min={getVideoQualityRange(output.videoCodec).min}
                onValueChange={(details) => {
                  const quality = details.value[0];
                  if (quality !== undefined) {
                    actorRef.send({ type: "quality.selected", quality });
                  }
                }}
                step={1}
                value={[videoQuality]}
                width="full"
              >
                <Slider.Label>Quality (CRF)</Slider.Label>
                <Slider.ValueText>{videoQuality}</Slider.ValueText>
                <Slider.Control>
                  <Slider.Track>
                    <Slider.Range />
                  </Slider.Track>
                  <Slider.Thumb index={0}>
                    <Slider.HiddenInput />
                  </Slider.Thumb>
                </Slider.Control>
              </Slider.Root>
              <Text color="fg.subtle" fontSize="sm">
                Lower CRF = higher quality, larger file. Range:{" "}
                {getVideoQualityRange(output.videoCodec).min}–
                {getVideoQualityRange(output.videoCodec).max}.
              </Text>
            </Box>
          )}

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
    </Flex>
  );
}
