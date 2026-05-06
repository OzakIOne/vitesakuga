import { execSync } from "node:child_process";
import { spawnSync } from "node:child_process";

function getWslHostIp() {
  try {
    const out = execSync(
      "cat /etc/resolv.conf 2>/dev/null | grep -m1 nameserver | awk '{print $2}'",
      {
        encoding: "utf-8",
      },
    ).trim();
    if (out && out !== "127.0.0.1") return out;
  } catch {
    /* fall through */
  }
  return "127.0.0.1";
}

const WSL_HOST = getWslHostIp();
const CDP_HTTP = process.env.CDP_HTTP || `http://${WSL_HOST}:9222`;
const CONFIG = process.env.E2E_CONFIG || "e2e/playwright.remote.config.ts";

async function main() {
  let wsUrl;
  try {
    const resp = await fetch(`${CDP_HTTP}/json/version`);
    const data = await resp.json();
    wsUrl = data.webSocketDebuggerUrl ?? "";
  } catch {
    console.error(`Failed to reach CDP at ${CDP_HTTP}/json/version`);
    console.error(
      "Is the browser running? For Windows Chrome, use --remote-debugging-address=0.0.0.0",
    );
    process.exit(1);
  }

  if (!wsUrl) {
    console.error("No webSocketDebuggerUrl in CDP response.");
    process.exit(1);
  }

  const fixed = wsUrl.replace(/ws:\/\/[^:/]+:/, `ws://${WSL_HOST}:`);

  console.log(`CDP: ${fixed}`);
  const result = spawnSync(
    "playwright",
    ["test", "--config", CONFIG, ...process.argv.slice(2)],
    {
      stdio: "inherit",
      env: { ...process.env, CDP_WS_ENDPOINT: fixed },
    },
  );
  process.exit(result.status ?? 0);
}

void main();
