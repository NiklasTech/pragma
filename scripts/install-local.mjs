import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { delimiter, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const targetDir = resolve(root, "src-tauri", process.env.CARGO_TARGET_DIR ?? "target");
const bundle = join(targetDir, "release/bundle/macos/Pragma.app");
const target = "/Applications/Pragma.app";
const staging = "/Applications/.Pragma.app.staging";
const previous = "/Applications/.Pragma.app.previous";

const shimSource = join(__dirname, "macos/pragma");
const shimMarker = "pragma-cli-shim";
const binDir = join(homedir(), ".local/bin");
const shimTarget = join(binDir, "pragma");

function fail(message) {
  console.error(`\ninstall:local: ${message}`);
  process.exit(1);
}

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: "inherit" });
  if (result.error) fail(`could not run ${command}: ${result.error.message}`);
  if (result.status !== 0) fail(`${command} exited with code ${result.status}`);
}

function build() {
  // Updater artifacts need TAURI_SIGNING_PRIVATE_KEY, which only exists in the release workflow.
  run("vp", [
    "run",
    "tauri",
    "build",
    "--bundles",
    "app",
    "--config",
    JSON.stringify({ bundle: { createUpdaterArtifacts: false } }),
  ]);
  if (!existsSync(bundle)) fail(`build finished, but ${bundle} was not found`);
}

function installApp() {
  rmSync(staging, { recursive: true, force: true });
  rmSync(previous, { recursive: true, force: true });
  run("ditto", [bundle, staging]);

  const hadPrevious = existsSync(target);
  if (hadPrevious) renameSync(target, previous);
  try {
    renameSync(staging, target);
  } catch (error) {
    if (hadPrevious) renameSync(previous, target);
    throw error;
  }
  rmSync(previous, { recursive: true, force: true });
  console.log(`\nInstalled ${target}. Restart Pragma if it is running.`);
}

function installShim() {
  if (existsSync(shimTarget) && !readFileSync(shimTarget, "utf-8").includes(shimMarker)) {
    console.warn(
      `Skipped the pragma command: ${shimTarget} exists and was not created by install:local.`,
    );
    return;
  }
  mkdirSync(binDir, { recursive: true });
  writeFileSync(shimTarget, readFileSync(shimSource, "utf-8"));
  chmodSync(shimTarget, 0o755);
  console.log(`Installed the pragma command at ${shimTarget}.`);

  const pathEntries = (process.env.PATH ?? "").split(delimiter);
  if (!pathEntries.includes(binDir)) {
    console.log(`${binDir} is not on your PATH. Add this line to your shell profile:`);
    console.log('  export PATH="$HOME/.local/bin:$PATH"');
  }
}

if (process.platform !== "darwin") {
  fail(
    "only macOS is supported so far. Use `pnpm run build:desktop` and install the bundle from src-tauri/target/release/bundle/ manually.",
  );
}

build();
try {
  installApp();
} catch (error) {
  fail(
    `could not install into /Applications: ${error instanceof Error ? error.message : String(error)}`,
  );
}
installShim();
