import { Layer } from "effect";
import { NodeSdk } from "@effect/opentelemetry";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { BatchLogRecordProcessor } from "@opentelemetry/sdk-logs";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";

/**
 * OpenTelemetry tracing is only enabled when an OTLP endpoint is configured
 * (`OTEL_EXPORTER_OTLP_ENDPOINT`). Without one, the exporters fall back to
 * `http://localhost:4318`, which is unreachable from a Cloudflare Worker and
 * fails every traced effect with an `OTLPExporterError` (HTTP 403
 * "Forbidden"), breaking `getUserSession` and SSR rendering.
 */
const otlpEndpoint = process.env["OTEL_EXPORTER_OTLP_ENDPOINT"];

export const TracingLive = otlpEndpoint
  ? NodeSdk.layer(() => ({
      resource: { serviceName: "vitesakuga" },
      spanProcessor: new BatchSpanProcessor(new OTLPTraceExporter()),
      logRecordProcessor: new BatchLogRecordProcessor({
        exporter: new OTLPLogExporter(),
      }),
    }))
  : Layer.empty;
