import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const CLOUDFLARE_API_BASE = "https://api.cloudflare.com/client/v4";
const CLOUDFLARE_GRAPHQL_URL = `${CLOUDFLARE_API_BASE}/graphql`;
const DEFAULT_STATE_FILE = ".ci/deployment-state.json";
const DEFAULT_HEALTHCHECK_URL = "https://sakuga.ozaki.one/login";
const DEFAULT_MAX_ERROR_RATE = 0.1;
const DEFAULT_MIN_REQUESTS = 20;
const DEFAULT_MONITOR_ATTEMPTS = 5;
const DEFAULT_MONITOR_INTERVAL_SECONDS = 60;
const DEFAULT_SMOKE_ATTEMPTS = 3;
const DEFAULT_SMOKE_INTERVAL_MILLISECONDS = 2_000;

const args = process.argv.slice(2);

const getOption = (name, fallback) => {
  const index = args.indexOf(name);
  if (index === -1) {
    return fallback;
  }

  const value = args[index + 1];
  if (value === undefined || value.startsWith("--")) {
    throw new Error(`Missing value for ${name}`);
  }

  return value;
};

const stateFile = resolve(getOption("--state-file", DEFAULT_STATE_FILE));

const requireEnvironment = (name) => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
};

const getNumberEnvironment = (name, fallback, { integer = false } = {}) => {
  const value = process.env[name];
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || (integer && !Number.isInteger(parsed))) {
    throw new Error(
      `${name} must be a valid ${integer ? "integer" : "number"}`,
    );
  }

  return parsed;
};

const sleep = async (milliseconds) => {
  await new Promise((resolvePromise) => {
    setTimeout(resolvePromise, milliseconds);
  });
};

const getCloudflareHeaders = () => ({
  Accept: "application/json",
  Authorization: `Bearer ${requireEnvironment("CLOUDFLARE_API_TOKEN")}`,
  "Content-Type": "application/json",
});

const readJsonResponse = async (response) => {
  const text = await response.text();
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Cloudflare returned invalid JSON (${response.status})`);
  }
};

const cloudflareRequest = async ({ path, body }) => {
  const response = await fetch(`${CLOUDFLARE_API_BASE}${path}`, {
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: getCloudflareHeaders(),
    method: body === undefined ? "GET" : "POST",
    signal: AbortSignal.timeout(30_000),
  });
  const payload = await readJsonResponse(response);

  if (!response.ok || payload.success !== true) {
    const details = Array.isArray(payload.errors)
      ? payload.errors.map((error) => error.message).join("; ")
      : "unknown error";
    throw new Error(`Cloudflare API ${response.status}: ${details}`);
  }

  return payload.result;
};

const getWorkerName = () =>
  process.env.CLOUDFLARE_WORKER_NAME ||
  "vitesakuga-infra-sakugaworker-production-5osp6ydh4rodg534";

const getActiveVersion = async () => {
  const accountId = requireEnvironment("CLOUDFLARE_ACCOUNT_ID");
  const workerName = getWorkerName();
  const result = await cloudflareRequest({
    path: `/accounts/${accountId}/workers/scripts/${workerName}/deployments`,
  });
  const deployments = Array.isArray(result?.deployments)
    ? result.deployments
    : [];
  const activeDeployment = [...deployments].sort((left, right) => {
    const leftDate = left.created_on ?? left.createdOn ?? "";
    const rightDate = right.created_on ?? right.createdOn ?? "";
    return rightDate.localeCompare(leftDate);
  })[0];
  const versions = Array.isArray(activeDeployment?.versions)
    ? activeDeployment.versions
    : [];
  const activeVersion = [...versions].sort(
    (left, right) => (right.percentage ?? 0) - (left.percentage ?? 0),
  )[0];
  const versionId = activeVersion?.version_id ?? activeVersion?.versionId;

  if (!versionId) {
    throw new Error(`No active version found for Worker ${workerName}`);
  }

  return { versionId, workerName };
};

const writeState = async (state) => {
  await mkdir(dirname(stateFile), { recursive: true });
  await writeFile(stateFile, `${JSON.stringify(state, null, 2)}\n`, "utf8");
};

const readState = async () => {
  let rawState;
  try {
    rawState = await readFile(stateFile, "utf8");
  } catch (error) {
    throw new Error(`Cannot read deployment state at ${stateFile}`, {
      cause: error,
    });
  }

  try {
    return JSON.parse(rawState);
  } catch (error) {
    throw new Error(`Invalid deployment state at ${stateFile}`, {
      cause: error,
    });
  }
};

const capturePreviousVersion = async () => {
  const active = await getActiveVersion();
  await writeState({
    capturedAt: new Date().toISOString(),
    previousVersionId: active.versionId,
    workerName: active.workerName,
  });
  console.log(`Captured previous Worker version ${active.versionId}`);
};

const markDeployedVersion = async () => {
  const state = await readState();
  const previousVersionId = state.previousVersionId;
  if (!previousVersionId) {
    throw new Error("Deployment state has no previous Worker version");
  }

  const attempts = 6;
  let active;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    active = await getActiveVersion();
    if (active.versionId !== previousVersionId) {
      break;
    }

    if (attempt < attempts) {
      await sleep(10_000);
    }
  }

  if (!active || active.versionId === previousVersionId) {
    throw new Error("Cloudflare did not activate a new Worker version");
  }

  await writeState({
    ...state,
    deployedAt: new Date().toISOString(),
    deployedVersionId: active.versionId,
  });
  console.log(`Active Worker version is now ${active.versionId}`);
};

const getHealthcheckHeaders = () => {
  const clientId = process.env.CF_ACCESS_CLIENT_ID;
  const clientSecret = process.env.CF_ACCESS_CLIENT_SECRET;
  if (!clientId && !clientSecret) {
    return {};
  }

  if (!clientId || !clientSecret) {
    throw new Error(
      "CF_ACCESS_CLIENT_ID and CF_ACCESS_CLIENT_SECRET must be provided together",
    );
  }

  return {
    "CF-Access-Client-Id": clientId,
    "CF-Access-Client-Secret": clientSecret,
  };
};

const runSmokeChecks = async () => {
  const healthcheckUrl = process.env.HEALTHCHECK_URL ?? DEFAULT_HEALTHCHECK_URL;
  const headers = getHealthcheckHeaders();

  for (let attempt = 1; attempt <= DEFAULT_SMOKE_ATTEMPTS; attempt += 1) {
    const response = await fetch(healthcheckUrl, {
      headers,
      redirect: "manual",
      signal: AbortSignal.timeout(30_000),
    });
    if (response.status >= 200 && response.status < 400) {
      console.log(
        `Smoke check ${attempt}/${DEFAULT_SMOKE_ATTEMPTS}: ${response.status}`,
      );
    } else {
      throw new Error(
        `Smoke check failed for ${healthcheckUrl}: HTTP ${response.status}`,
      );
    }

    if (attempt < DEFAULT_SMOKE_ATTEMPTS) {
      await sleep(DEFAULT_SMOKE_INTERVAL_MILLISECONDS);
    }
  }
};

const GRAPHQL_QUERY = `
  query GetWorkersAnalytics(
    $accountTag: string!
    $datetimeStart: string!
    $datetimeEnd: string!
    $scriptName: string!
  ) {
    viewer {
      accounts(filter: { accountTag: $accountTag }) {
        workersInvocationsAdaptive(
          limit: 100
          filter: {
            scriptName: $scriptName
            datetime_geq: $datetimeStart
            datetime_leq: $datetimeEnd
          }
        ) {
          sum {
            requests
            errors
          }
        }
      }
    }
  }
`;

const queryWorkerMetrics = async ({ start, end }) => {
  const response = await fetch(CLOUDFLARE_GRAPHQL_URL, {
    body: JSON.stringify({
      query: GRAPHQL_QUERY,
      variables: {
        accountTag: requireEnvironment("CLOUDFLARE_ACCOUNT_ID"),
        datetimeEnd: end.toISOString(),
        datetimeStart: start.toISOString(),
        scriptName: getWorkerName(),
      },
    }),
    headers: getCloudflareHeaders(),
    method: "POST",
    signal: AbortSignal.timeout(30_000),
  });
  const payload = await readJsonResponse(response);
  if (
    !response.ok ||
    (Array.isArray(payload.errors) && payload.errors.length)
  ) {
    const details = Array.isArray(payload.errors)
      ? payload.errors.map((error) => error.message).join("; ")
      : "unknown error";
    throw new Error(`Cloudflare Analytics ${response.status}: ${details}`);
  }

  const rows = payload.data?.viewer?.accounts?.[0]?.workersInvocationsAdaptive;
  if (!Array.isArray(rows)) {
    throw new Error("Cloudflare Analytics returned no Worker metrics");
  }

  return rows.reduce(
    (totals, row) => ({
      errors: totals.errors + Number(row.sum?.errors ?? 0),
      requests: totals.requests + Number(row.sum?.requests ?? 0),
    }),
    { errors: 0, requests: 0 },
  );
};

const monitorDeployment = async () => {
  const state = await readState();
  const deployedAt = new Date(state.deployedAt ?? Date.now());
  const maxErrorRate = getNumberEnvironment(
    "MAX_ERROR_RATE",
    DEFAULT_MAX_ERROR_RATE,
  );
  const minRequests = getNumberEnvironment(
    "MIN_REQUESTS",
    DEFAULT_MIN_REQUESTS,
    {
      integer: true,
    },
  );
  const attempts = getNumberEnvironment(
    "MONITOR_ATTEMPTS",
    DEFAULT_MONITOR_ATTEMPTS,
    { integer: true },
  );
  const intervalMilliseconds =
    getNumberEnvironment(
      "MONITOR_INTERVAL_SECONDS",
      DEFAULT_MONITOR_INTERVAL_SECONDS,
      { integer: true },
    ) * 1_000;

  if (maxErrorRate < 0 || maxErrorRate > 1) {
    throw new Error("MAX_ERROR_RATE must be between 0 and 1");
  }
  if (minRequests < 1 || attempts < 1 || intervalMilliseconds < 1) {
    throw new Error("Monitoring thresholds must be positive");
  }

  await runSmokeChecks();

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    await sleep(intervalMilliseconds);
    const metrics = await queryWorkerMetrics({
      end: new Date(),
      start: deployedAt,
    });
    const errorRate =
      metrics.requests === 0 ? 0 : metrics.errors / metrics.requests;
    console.log(
      `Metrics ${attempt}/${attempts}: ${metrics.errors}/${metrics.requests} errors (${(errorRate * 100).toFixed(2)}%)`,
    );

    if (metrics.requests >= minRequests && errorRate > maxErrorRate) {
      throw new Error(
        `Error rate ${(errorRate * 100).toFixed(2)}% exceeds ${(maxErrorRate * 100).toFixed(2)}%`,
      );
    }
  }

  console.log("Deployment health checks passed");
};

const rollback = async () => {
  const state = await readState();
  if (!state.previousVersionId) {
    throw new Error("Deployment state has no previous Worker version");
  }

  const workerName = state.workerName ?? getWorkerName();
  const child = spawn(
    "nubx",
    [
      "wrangler",
      "rollback",
      state.previousVersionId,
      "--name",
      workerName,
      "--message",
      `Automatic rollback after failed release health checks (${state.deployedVersionId ?? "unknown version"})`,
    ],
    { stdio: "inherit" },
  );

  await new Promise((resolvePromise, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolvePromise();
        return;
      }

      reject(
        new Error(
          `wrangler rollback failed with ${signal ?? `exit code ${code}`}`,
        ),
      );
    });
  });
  console.log(`Rolled back Worker ${workerName} to ${state.previousVersionId}`);
};

const printUsage = () => {
  console.log(`Usage: nub scripts/cloudflare-release.mjs <command> [--state-file path]

Commands:
  capture          Save active version before deployment
  mark-deployed    Wait for and save newly active version
  monitor          Run smoke checks and monitor Worker error rate
  rollback         Roll back to version captured before deployment`);
};

const main = async () => {
  const command = args[0];
  if (!command) {
    printUsage();
    return;
  }

  if (command === "capture") {
    await capturePreviousVersion();
    return;
  }
  if (command === "mark-deployed") {
    await markDeployedVersion();
    return;
  }
  if (command === "monitor") {
    await monitorDeployment();
    return;
  }
  if (command === "rollback") {
    await rollback();
    return;
  }

  printUsage();
  throw new Error(`Unknown command: ${command}`);
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
