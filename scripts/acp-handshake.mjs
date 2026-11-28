// ACP handshake check for the coding CLIs in src-tauri/src/ai/cli/manifest.rs. It needs no login:
// it sends `initialize` and `session/new` and reports what each agent answers.
// Usage: node scripts/acp-handshake.mjs [--json] [--timeout <s>] [--require <id,...>] [provider-id ...]
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createInterface } from "node:readline";

const MANIFEST = new URL("../src-tauri/src/ai/cli/manifest.rs", import.meta.url);
const PROTOCOL_VERSION = 1;

/** Reads `id` and `chat_cmd` of every built-in manifest, so this check follows the Rust table. */
function manifestCommands(source) {
  const entries = [];
  const pattern = /id: "([^"]+)"\.to_string\(\),[\s\S]*?chat_cmd: "([^"]+)"\.to_string\(\)/g;
  for (const match of source.matchAll(pattern)) entries.push({ id: match[1], command: match[2] });
  return entries;
}

function parseArgs(argv) {
  const options = { json: false, timeoutMs: 60_000, require: [], ids: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--json") options.json = true;
    else if (arg === "--timeout") options.timeoutMs = Number(argv[++i]) * 1000;
    else if (arg === "--require") options.require = argv[++i].split(",").filter(Boolean);
    else options.ids.push(arg);
  }
  return options;
}

function splitCommand(command) {
  return command.split(/\s+/).filter(Boolean);
}

class AgentProcess {
  constructor(command, cwd, timeoutMs) {
    const [bin, ...args] = splitCommand(command);
    const windows = process.platform === "win32";
    this.child = spawn(bin, args, { cwd, stdio: ["pipe", "pipe", "pipe"], shell: windows });
    this.timeoutMs = timeoutMs;
    this.nextId = 1;
    this.pending = new Map();
    this.notifications = [];
    this.stderr = "";
    this.exit = new Promise((resolve) => {
      this.child.on("error", (error) => resolve({ error: error.message }));
      this.child.on("exit", (code, signal) => resolve({ code, signal }));
    });
    this.child.stderr.on("data", (chunk) => {
      this.stderr = (this.stderr + chunk.toString()).slice(-4000);
    });
    createInterface({ input: this.child.stdout }).on("line", (line) => this.onLine(line));
  }

  onLine(line) {
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      return;
    }
    if (message.id !== undefined && this.pending.has(message.id) && !message.method) {
      const { resolve } = this.pending.get(message.id);
      this.pending.delete(message.id);
      resolve(message);
    } else if (message.method && message.id !== undefined) {
      // The agent asks the client something; this check offers nothing.
      this.send({
        jsonrpc: "2.0",
        id: message.id,
        error: { code: -32601, message: "not supported" },
      });
    } else if (message.method) {
      this.notifications.push(message);
    }
  }

  send(message) {
    this.child.stdin.write(`${JSON.stringify(message)}\n`);
  }

  request(method, params) {
    const id = this.nextId++;
    const reply = new Promise((resolve) => this.pending.set(id, { resolve }));
    const timeout = new Promise((resolve) =>
      setTimeout(() => resolve({ timeout: true }), this.timeoutMs).unref(),
    );
    const exited = this.exit.then((exit) => ({ exited: exit }));
    this.send({ jsonrpc: "2.0", id, method, params });
    return Promise.race([reply, timeout, exited]);
  }

  stop() {
    if (this.child.exitCode === null) this.child.kill();
  }
}

function describeFailure(reply, stderr) {
  if (reply.timeout) return "no answer before the timeout";
  if (reply.exited) {
    const { error, code, signal } = reply.exited;
    const tail = stderr.trim().split("\n").slice(-2).join(" | ");
    return error ?? `exited (${signal ?? code})${tail ? `: ${tail}` : ""}`;
  }
  const { code, message } = reply.error;
  return `error ${code}: ${message}`;
}

function summarizeInit(result) {
  const caps = result.agentCapabilities ?? {};
  return {
    protocolVersion: result.protocolVersion,
    agent: result.agentInfo ? `${result.agentInfo.name} ${result.agentInfo.version}` : null,
    loadSession: caps.loadSession === true,
    prompt: caps.promptCapabilities ?? {},
    mcp: caps.mcpCapabilities ?? {},
    session: Object.keys(caps.sessionCapabilities ?? {}),
    authMethods: (result.authMethods ?? []).map((method) => method.id),
  };
}

function summarizeSession(result, notifications) {
  const commands = notifications
    .filter((n) => n.params?.update?.sessionUpdate === "available_commands_update")
    .flatMap((n) => n.params.update.availableCommands ?? []);
  return {
    modes: (result.modes?.availableModes ?? []).map((mode) => mode.id),
    configOptions: (result.configOptions ?? []).map((option) => option.id),
    commands: commands.length,
  };
}

async function check({ id, command }, timeoutMs) {
  const cwd = mkdtempSync(path.join(tmpdir(), "acp-handshake-"));
  const agent = new AgentProcess(command, cwd, timeoutMs);
  const report = { id, command, ok: false };
  try {
    const init = await agent.request("initialize", {
      protocolVersion: PROTOCOL_VERSION,
      clientCapabilities: { fs: { readTextFile: true, writeTextFile: true } },
    });
    if (!init.result) {
      report.initialize = describeFailure(init, agent.stderr);
      return report;
    }
    report.ok = true;
    report.initialize = summarizeInit(init.result);
    const session = await agent.request("session/new", { cwd, mcpServers: [] });
    if (session.result) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      report.sessionNew = { ok: true, ...summarizeSession(session.result, agent.notifications) };
    } else {
      report.sessionNew = { ok: false, reason: describeFailure(session, agent.stderr) };
    }
    return report;
  } finally {
    agent.stop();
    await Promise.race([agent.exit, new Promise((resolve) => setTimeout(resolve, 2000))]);
    rmSync(cwd, { recursive: true, force: true });
  }
}

function printReport(report) {
  console.log(`\n${report.id}  (${report.command})`);
  if (!report.ok) {
    console.log(`  initialize: FAILED, ${report.initialize}`);
    return;
  }
  const init = report.initialize;
  console.log(`  agent:        ${init.agent ?? "-"}  protocol ${init.protocolVersion}`);
  console.log(`  loadSession:  ${init.loadSession}   session: ${init.session.join(", ") || "-"}`);
  console.log(`  prompt:       ${JSON.stringify(init.prompt)}`);
  console.log(`  mcp:          ${JSON.stringify(init.mcp)}`);
  console.log(`  authMethods:  ${init.authMethods.join(", ") || "-"}`);
  const session = report.sessionNew;
  if (session.ok) {
    console.log(`  session/new:  ok, modes [${session.modes.join(", ")}]`);
    console.log(
      `                config [${session.configOptions.join(", ")}], ${session.commands} commands`,
    );
  } else {
    console.log(`  session/new:  ${session.reason}`);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const all = manifestCommands(readFileSync(MANIFEST, "utf8"));
  const unknown = options.ids.filter((id) => !all.some((entry) => entry.id === id));
  if (unknown.length > 0) throw new Error(`unknown provider id: ${unknown.join(", ")}`);
  const selected = options.ids.length > 0 ? all.filter((e) => options.ids.includes(e.id)) : all;
  const reports = [];
  for (const entry of selected) {
    const report = await check(entry, options.timeoutMs);
    reports.push(report);
    if (!options.json) printReport(report);
  }
  if (options.json) console.log(JSON.stringify(reports, null, 2));
  const failed = options.require.filter((id) => !reports.find((r) => r.id === id)?.ok);
  if (failed.length > 0) {
    console.error(`\nACP handshake failed for: ${failed.join(", ")}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
