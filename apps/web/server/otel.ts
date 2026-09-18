/**
 * OpenTelemetry bootstrap.
 *
 * Loaded via `node --import ./dist-server/otel.mjs dist-server/index.mjs` (see
 * the Dockerfile CMD) so instrumentation is registered *before* pg / ioredis /
 * http / bullmq are first required — that ordering is what lets the auto
 * instrumentations patch them.
 *
 * Entirely opt-in and zero-cost when off: nothing here loads the (heavy) OTel
 * SDK unless `OTEL_EXPORTER_OTLP_ENDPOINT` is set. Set it to your SigNoz OTLP
 * ingest and traces flow automatically. Standard OTel env vars are honoured:
 *
 *   OTEL_EXPORTER_OTLP_ENDPOINT   e.g. http://signoz:4318  (self-hosted)
 *                                 or   https://ingest.<region>.signoz.cloud:443
 *   OTEL_EXPORTER_OTLP_HEADERS    e.g. signoz-access-token=<ingestion-key>
 *   OTEL_SERVICE_NAME             defaults to "cefiro"
 */
if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
  // Register the ESM import hook so instrumentations can patch modules the
  // bundle pulls in via `import` (CJS deps are covered by the require hook the
  // SDK installs on start()).
  try {
    const { register } = await import("node:module");

    register("import-in-the-middle/hook.mjs", import.meta.url);
  } catch {
    // Older Node without module.register — the require hook still covers the
    // CommonJS deps (pg, ioredis, bullmq), which is where the useful spans are.
  }

  const { NodeSDK } = await import("@opentelemetry/sdk-node");
  const { getNodeAutoInstrumentations } = await import("@opentelemetry/auto-instrumentations-node");
  const { OTLPTraceExporter } = await import("@opentelemetry/exporter-trace-otlp-http");

  const sdk = new NodeSDK({
    serviceName: process.env.OTEL_SERVICE_NAME || "cefiro",
    traceExporter: new OTLPTraceExporter(),
    instrumentations: [
      getNodeAutoInstrumentations({
        // fs spans are extremely noisy (sharp, static files) and rarely useful.
        "@opentelemetry/instrumentation-fs": { enabled: false },
      }),
    ],
  });

  sdk.start();

  const shutdown = () => {
    void sdk.shutdown().finally(() => process.exit(0));
  };

  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
}
