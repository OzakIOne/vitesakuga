#!/usr/bin/env bun
import { Database, type SQLQueryBindings } from "bun:sqlite";
import { homedir } from "os";
import { join } from "path";

const DB_PATH = join(homedir(), ".local/share/opencode/opencode.db");
const db = new Database(DB_PATH);

type Session = {
  id: string;
  title: string;
  created: string;
  updated: string;
  agent: string | null;
  model: string | null;
};

const args = process.argv.slice(2);
const flagArgs = collectFlags(args);
const keyword = flagArgs.positional[0] ?? null;
const after = parseDateFlag(flagArgs, "--after");
const before = parseDateFlag(flagArgs, "--before");
const sessionIdFlag = flagArgs.flags["--session"] ?? null;
const showMessages =
  flagArgs.flags["--messages"] === "" || flagArgs.flags["-m"] === "";
const limit = parseInt(flagArgs.flags["--limit"] ?? "20", 10);
const help = flagArgs.flags["--help"] === "" || flagArgs.flags["-h"] === "";

type FlagArgs = {
  flags: Record<string, string>;
  positional: string[];
};

function collectFlags(raw: string[]): FlagArgs {
  const flags: Record<string, string> = {};
  const positional: string[] = [];
  for (let i = 0; i < raw.length; i++) {
    const a = raw[i];
    if (a.startsWith("--") || a.startsWith("-")) {
      const eqIdx = a.indexOf("=");
      if (eqIdx !== -1) {
        flags[a.slice(0, eqIdx)] = a.slice(eqIdx + 1);
      } else if (i + 1 < raw.length && !raw[i + 1].startsWith("-")) {
        i++;
        flags[a] = raw[i];
      } else {
        flags[a] = "";
      }
    } else {
      positional.push(a);
    }
  }
  return { flags, positional };
}

function parseDateFlag(flagArgs: FlagArgs, flag: string): number | null {
  const val = flagArgs.flags[flag];
  if (!val) return null;
  const d = new Date(val);
  return d.getTime();
}

function printHelp() {
  console.log(`
Usage: bun lookup-session.ts [keyword] [options]

Search opencode sessions by date range and keyword matching across messages.

Options:
  --after <date>    Filter sessions after this date (e.g. "2026-05-20", "2026-05-25T15:00:00")
  --before <date>   Filter sessions before this date
  --session <id>    Show full conversation for a specific session ID
  --messages, -m    Show first 2 messages of each matching session inline
  --limit <n>       Max sessions to show (default: 20)
  --help, -h        Show this help

Examples:
  bun lookup-session.ts requireAuth
  bun lookup-session.ts auth --after 2026-05-20 --before 2026-06-01
  bun lookup-session.ts --session ses_abc123 --messages
  bun lookup-session.ts --after 2026-05-20 -m
`);
}

if (help) {
  printHelp();
  process.exit(0);
}

// --- Show full session conversation ---
if (sessionIdFlag) {
  const session = db
    .query(
      `SELECT id, title, datetime(time_created/1000, 'unixepoch') as created,
              datetime(time_updated/1000, 'unixepoch') as updated, agent, model
       FROM session WHERE id = ?`,
    )
    .get(sessionIdFlag) as Session | null;

  if (!session) {
    console.error(`Session "${sessionIdFlag}" not found.`);
    process.exit(1);
  }

  console.log(`\n=== ${session.title} ===`);
  console.log(`ID:      ${session.id}`);
  console.log(`Created: ${session.created}`);
  console.log(`Updated: ${session.updated}`);
  console.log(`Agent:   ${session.agent ?? "—"}`);
  console.log(`Model:   ${session.model ?? "—"}`);
  console.log();

  const messages = db
    .query(
      `SELECT data FROM message WHERE session_id = ? ORDER BY time_created, id`,
    )
    .all(sessionIdFlag) as { data: string }[];

  if (messages.length === 0) {
    const sm = db
      .query(
        `SELECT data FROM session_message WHERE session_id = ? ORDER BY seq`,
      )
      .all(sessionIdFlag) as { data: string }[];
    if (sm.length === 0) {
      console.log("(no messages)");
    } else {
      for (const row of sm) {
        const msg = JSON.parse(row.data);
        printMessage(msg);
      }
    }
  } else {
    for (const row of messages) {
      const msg = JSON.parse(row.data);
      printMessage(msg);
    }
  }

  process.exit(0);
}

// --- Build query ---
const conditions: string[] = [];
const params: unknown[] = [];

if (after !== null) {
  conditions.push("s.time_created >= ?");
  params.push(after);
}
if (before !== null) {
  conditions.push("s.time_created <= ?");
  params.push(before);
}

const whereClause =
  conditions.length > 0 ? "WHERE " + conditions.join(" AND ") : "";

const sessions = db
  .query(
    `SELECT s.id, s.title, datetime(s.time_created/1000, 'unixepoch') as created,
            datetime(s.time_updated/1000, 'unixepoch') as updated, s.agent, s.model
     FROM session s
     ${whereClause}
     ORDER BY s.time_created DESC
     LIMIT ?`,
  )
  .all(...(params as SQLQueryBindings[]), limit) as Session[];

// --- Search messages for keyword ---
let keywordMatched = new Set<string>();

if (keyword) {
  const kw = `%${keyword}%`;
  const msgMatches = db
    .query(`SELECT DISTINCT session_id FROM message WHERE data LIKE ?`)
    .all(kw) as { session_id: string }[];
  const smMatches = db
    .query(`SELECT DISTINCT session_id FROM session_message WHERE data LIKE ?`)
    .all(kw) as { session_id: string }[];

  for (const m of msgMatches) keywordMatched.add(m.session_id);
  for (const m of smMatches) keywordMatched.add(m.session_id);
}

// --- Filter by keyword if provided ---
const filtered = keyword
  ? sessions.filter((s) => keywordMatched.has(s.id))
  : sessions;

// --- Output ---
if (filtered.length === 0) {
  if (keyword) {
    console.log(`No sessions found matching keyword "${keyword}".`);
  } else {
    console.log("No sessions found in the given range.");
  }
  process.exit(0);
}

console.log(
  `\nFound ${filtered.length} session(s)` +
    (keyword ? ` matching "${keyword}"` : "") +
    ":\n",
);

for (const s of filtered) {
  const tag = keywordMatched.has(s.id) ? " ✅" : "";
  console.log(`  ${s.created}  ${s.title}${tag}`);
  console.log(`  └─ ${s.id}`);
  console.log();

  if (showMessages) {
    const msgs = db
      .query(
        `SELECT data FROM message WHERE session_id = ? ORDER BY time_created LIMIT 2`,
      )
      .all(s.id) as { data: string }[];
    for (const row of msgs) {
      const msg = JSON.parse(row.data);
      const text = extractText(msg);
      const role = msg.role ?? "?";
      if (text) {
        console.log(`    [${role}]: ${text.slice(0, 250)}`);
      }
    }
    console.log();
  }
}

// --- Helpful hint ---
if (!showMessages && !sessionIdFlag) {
  console.log(
    "Tip: add --messages or -m to preview messages, or --session <id> to view full conversation.",
  );
}

function extractText(msg: any): string {
  if (typeof msg.content === "string") return msg.content;
  if (typeof msg.content?.text === "string") return msg.content.text;
  if (msg.summary?.user) return msg.summary.user;
  if (msg.summary?.diffs?.length) {
    const files = msg.summary.diffs
      .map((d: any) => d.file?.split("/").pop() ?? d.file)
      .join(", ");
    return `[diffs: ${files}]`;
  }
  if (msg.role === "assistant" && msg.finish === "tool-calls")
    return "(tool calls)";
  if (msg.role === "assistant" && msg.finish === "stop") return "(response)";
  return "";
}

function printMessage(msg: any) {
  const role = msg.role ?? "?";
  const text = extractText(msg);
  const model = msg.modelID ?? msg.model?.modelID ?? "";
  const prefix = `[${role}]${model ? ` (${model})` : ""}`;
  if (text) {
    for (const line of text.split("\n").filter(Boolean)) {
      console.log(`  ${prefix}: ${line.slice(0, 500)}`);
    }
  } else {
    console.log(`  ${prefix}: (metadata only)`);
  }
}
