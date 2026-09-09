import {
  Portal,
  createListCollection,
  type ComboboxValueChangeDetails,
} from "@ark-ui/react";
import { createLazyFileRoute } from "@tanstack/react-router";
import { useActorRef, useSelector } from "@xstate/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { LuScissors, LuUpload } from "react-icons/lu";
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
  hasTrimmedRange,
  isPassthroughCompatible,
} from "./-convert.machine";
import type { ConvertMachineLogic } from "./-convert.machine";
import type { BoundaryPolicy, CopyMode } from "./-convert.machine";

export const Route = createLazyFileRoute("/convert")({
  component: RouteComponent,
  pendingComponent: () => (
    <Container maxW="xl" py={8}>
      <Text>Loading converter...</Text>
    </Container>
  ),
});

type ActorLike = Pick<AnyActorRef, "getSnapshot" | "subscribe">;

const SELECT_CLASS =
  "w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900";

function formatTimestamp(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds - minutes * 60;
  return `${minutes}:${remainder.toFixed(1).padStart(4, "0")}`;
}

function isCopyMode(value: string): value is CopyMode {
  return value === "forced" || value === "preferred";
}

function isBoundaryPolicy(value: string): value is BoundaryPolicy {
  return value === "expand" || value === "shrink";
}

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
  // SAFETY: xstate@6.0.0-alpha.36 types `StateMachine.validator` with an
  // explicit `| undefined`, which fails the `AnyActorLogic` constraint of
  // `useActorRef` under `exactOptionalPropertyTypes`. `ConvertMachineLogic`
  // fixes only that variance and is otherwise identical to the machine type.
  const actorRef = useActorRef(convertMachine as ConvertMachineLogic);

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
  const duration = useSelector(actorRef, (s) => s.context.duration);
  const trimStart = useSelector(actorRef, (s) => s.context.trimStart);
  const trimEnd = useSelector(actorRef, (s) => s.context.trimEnd);
  const copyMode = useSelector(actorRef, (s) => s.context.copyMode);
  const boundaryPolicy = useSelector(actorRef, (s) => s.context.boundaryPolicy);
  const shiftTolerance = useSelector(actorRef, (s) => s.context.shiftTolerance);
  const isConverting = useSelector(actorRef, (s) => s.matches("converting"));
  const isSuccess = useSelector(actorRef, (s) => s.matches("success"));
  const hasDuration = duration !== null && duration > 0;
  const isTrimmed =
    duration !== null && hasTrimmedRange(trimStart, trimEnd, duration);
  const isAudioFile = file?.type.startsWith("audio/") ?? false;
  const isTranscodingOutput =
    output?.videoCodec !== undefined || output?.audioCodec !== undefined;

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  useEffect(
    () => () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    },
    [],
  );

  const replacePreviewUrl = (nextFile: File | null) => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
    }
    const nextUrl = nextFile ? URL.createObjectURL(nextFile) : null;
    previewUrlRef.current = nextUrl;
    setPreviewUrl(nextUrl);
  };

  const handleFileChange = (file: File | null) => {
    replacePreviewUrl(file);
    if (file) {
      actorRef.send({ type: "file.selected", file });
    } else {
      actorRef.send({ type: "reset" });
    }
  };

  const handleReset = () => {
    replacePreviewUrl(null);
    actorRef.send({ type: "reset" });
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
    const item = details.items[0];
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

          {file && hasDuration && duration !== null && (
            <Box borderRadius="md" mb={4} p={4} shadow="sm">
              <Flex align="center" gap={2} mb={3}>
                <LuScissors aria-hidden className="h-5 w-5" />
                <Heading as="h2" size="sm">
                  Trim range
                </Heading>
              </Flex>

              {previewUrl &&
                (isAudioFile ? (
                  <audio
                    controls
                    preload="metadata"
                    src={previewUrl}
                    style={{
                      marginBottom: "1rem",
                      width: "100%",
                    }}
                  />
                ) : (
                  <video
                    controls
                    preload="metadata"
                    src={previewUrl}
                    style={{
                      borderRadius: "0.5rem",
                      marginBottom: "1rem",
                      maxHeight: "256px",
                      width: "100%",
                    }}
                  />
                ))}

              <Slider.Root
                aria-label={["Trim start", "Trim end"]}
                disabled={isConverting}
                max={duration}
                min={0}
                onValueChange={(details) => {
                  const [start, end] = details.value;
                  if (start !== undefined && end !== undefined) {
                    actorRef.send({
                      type: "trim.selected",
                      start,
                      end,
                    });
                  }
                }}
                step={Math.max(duration / 1000, 0.01)}
                value={[trimStart, trimEnd]}
                width="full"
              >
                <Slider.Control>
                  <Slider.Track>
                    <Slider.Range />
                  </Slider.Track>
                  <Slider.Thumb index={0}>
                    <Slider.HiddenInput />
                  </Slider.Thumb>
                  <Slider.Thumb index={1}>
                    <Slider.HiddenInput />
                  </Slider.Thumb>
                </Slider.Control>
              </Slider.Root>
              <Flex align="center" justify="space-between" mt={1}>
                <Text fontSize="sm">
                  {formatTimestamp(trimStart)} → {formatTimestamp(trimEnd)} (of{" "}
                  {formatTimestamp(duration)})
                </Text>
                <Button
                  disabled={!isTrimmed || isConverting}
                  onClick={() =>
                    actorRef.send({
                      type: "trim.selected",
                      end: duration,
                      start: 0,
                    })
                  }
                  size="sm"
                  variant="outline"
                >
                  Reset trim
                </Button>
              </Flex>

              <Box borderTop="1px solid" borderColor="gray.200" mt={4} pt={4}>
                <Text fontWeight="medium" mb={2}>
                  Copy conversion settings
                </Text>
                <Flex direction="column" gap={3}>
                  <label>
                    <Text fontSize="sm" mb={1}>
                      Copy mode
                    </Text>
                    <select
                      aria-label="Copy mode"
                      className={SELECT_CLASS}
                      disabled={isConverting || isTranscodingOutput}
                      onChange={(event) =>
                        isCopyMode(event.target.value) &&
                        actorRef.send({
                          type: "copy.mode.selected",
                          mode: event.target.value,
                        })
                      }
                      value={copyMode}
                    >
                      <option value="preferred">
                        Prefer copy, transcode when needed
                      </option>
                      <option value="forced">
                        Copy only, discard incompatible tracks
                      </option>
                    </select>
                  </label>
                  <label>
                    <Text fontSize="sm" mb={1}>
                      Trim boundary policy
                    </Text>
                    <select
                      aria-label="Trim boundary policy"
                      className={SELECT_CLASS}
                      disabled={isConverting || isTranscodingOutput}
                      onChange={(event) =>
                        isBoundaryPolicy(event.target.value) &&
                        actorRef.send({
                          type: "copy.boundary.selected",
                          boundaryPolicy: event.target.value,
                        })
                      }
                      value={boundaryPolicy}
                    >
                      <option value="expand">
                        Expand to include complete packets
                      </option>
                      <option value="shrink">
                        Shrink to stay inside the range
                      </option>
                    </select>
                  </label>
                  <label>
                    <Text fontSize="sm" mb={1}>
                      Timestamp shift tolerance (seconds)
                    </Text>
                    <input
                      aria-label="Timestamp shift tolerance (seconds)"
                      className={SELECT_CLASS}
                      disabled={isConverting || isTranscodingOutput}
                      min={0}
                      onChange={(event) => {
                        const nextTolerance = Number(event.target.value);
                        if (Number.isFinite(nextTolerance)) {
                          actorRef.send({
                            type: "copy.shiftTolerance.selected",
                            shiftTolerance: Math.max(0, nextTolerance),
                          });
                        }
                      }}
                      step={0.01}
                      type="number"
                      value={shiftTolerance}
                    />
                  </label>
                </Flex>
                <Text color="fg.subtle" fontSize="sm" mt={2}>
                  Copy mode preserves the original encoded media when possible.
                  {isTranscodingOutput &&
                    " Select a passthrough output to use these settings."}
                </Text>
              </Box>
            </Box>
          )}

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
                  <Combobox.Input placeholder="Select format" />
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
                    onClick={handleReset}
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
                    onClick={handleReset}
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
