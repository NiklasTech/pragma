import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const {
  DISCORD_WEBHOOK_URL,
  DISCORD_ROLE_ID,
  RELEASE_TAG,
  GITHUB_REPOSITORY = "NiklasTech/pragma",
  GITHUB_TOKEN,
  CHROME_PATH = "google-chrome",
} = process.env;

const ORANGE = 0xff7a3d;
const MAX_DESCRIPTION = 3900;
const HIDDEN_SECTIONS = ["Maintenance", "Dependencies"];

if (!DISCORD_WEBHOOK_URL || !RELEASE_TAG) {
  console.error("DISCORD_WEBHOOK_URL and RELEASE_TAG are required");
  process.exit(1);
}

async function fetchRelease() {
  const headers = { Accept: "application/vnd.github+json" };
  if (GITHUB_TOKEN) headers.Authorization = `Bearer ${GITHUB_TOKEN}`;
  const url = `https://api.github.com/repos/${GITHUB_REPOSITORY}/releases/tags/${RELEASE_TAG}`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${await res.text()}`);
  return res.json();
}

function formatNotes(body, repoUrl) {
  const intro = [];
  const sections = [];
  const other = [];
  let current = null;

  for (const raw of body.replace(/\r/g, "").split("\n")) {
    const line = raw.trimEnd();
    if (line.startsWith("**Full Changelog**")) continue;
    const heading = line.match(/^##+\s+(.*)$/);
    if (heading) {
      const title = heading[1].trim();
      current = title === "What's Changed" ? null : { title, items: [] };
      if (current) sections.push(current);
      continue;
    }
    const item = line.match(/^[-*]\s+(.*)$/);
    const text = item
      ? item[1]
          .replace(/^\w+(\([^)]*\))?!?:\s*/, "")
          .replace(/\s+by @\S+ in #(\d+)$/, ` ([#$1](${repoUrl}/pull/$1))`)
          .replace(/^./, (c) => c.toUpperCase())
      : line;
    if (current) {
      if (item) current.items.push(`- ${text}`);
    } else if (item) {
      other.push(`- ${text}`);
    } else if (line) {
      intro.push(line);
    }
  }

  const visible = sections.filter(
    (s) => s.items.length && !HIDDEN_SECTIONS.some((h) => s.title.includes(h)),
  );
  if (other.length) visible.push({ title: "Other changes", items: other });

  const parts = [intro.join("\n"), ...visible.map((s) => `### ${s.title}\n${s.items.join("\n")}`)];
  let description = parts.filter(Boolean).join("\n\n");
  if (description.length > MAX_DESCRIPTION) {
    description = `${description.slice(0, MAX_DESCRIPTION).replace(/\n[^\n]*$/, "")}\n- ...`;
  }
  return description;
}

function renderBanner(title, dir) {
  const lockup = readFileSync(
    join(root, "branding/svg/pragma-lockup-horizontal-glut.svg"),
    "utf-8",
  );
  const mark = readFileSync(join(root, "branding/svg/pragma-mark-glut.svg"), "utf-8");
  const html = `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;800&family=JetBrains+Mono:wght@500&display=block" rel="stylesheet">
<style>
*{margin:0;box-sizing:border-box}
html,body{width:1600px;height:520px;overflow:hidden;background:#0F1714}
body{position:relative;font-family:Inter,'Segoe UI',sans-serif;color:#F3EEE4}
.grid{position:absolute;inset:0;background-image:radial-gradient(circle at 1px 1px,rgba(243,238,228,.07) 1.4px,transparent 0);background-size:38px 38px;mask-image:linear-gradient(90deg,transparent 0%,#000 55%)}
.glow{position:absolute;right:-180px;top:-160px;width:760px;height:760px;border-radius:50%;background:radial-gradient(circle,rgba(255,122,61,.2) 0%,rgba(255,122,61,0) 62%)}
.mark{position:absolute;right:70px;top:50%;transform:translateY(-50%);width:420px}
.mark svg,.lockup svg{display:block}.mark svg{width:100%;height:auto}
.content{position:absolute;left:96px;top:0;bottom:0;width:900px;display:flex;flex-direction:column;justify-content:center}
.lockup svg{height:64px;width:auto;margin-bottom:44px}
.eyebrow{font-family:'JetBrains Mono',monospace;font-size:22px;letter-spacing:.18em;text-transform:uppercase;color:#FF7A3D;margin-bottom:18px}
h1{font-size:84px;font-weight:800;letter-spacing:-.035em;line-height:1.02}
p{margin-top:22px;font-size:28px;line-height:1.4;color:rgba(243,238,228,.68)}
.bar{position:absolute;left:0;right:0;bottom:0;height:6px;background:linear-gradient(90deg,#E8531F,#FF7A3D 40%,rgba(255,122,61,0))}
</style></head><body>
<div class="grid"></div><div class="glow"></div><div class="mark">${mark}</div>
<div class="content"><div class="lockup">${lockup}</div><div class="eyebrow">Release</div>
<h1>${title}</h1><p>Download it now or let Pragma update itself.</p></div><div class="bar"></div>
</body></html>`;
  const htmlPath = join(dir, "banner.html");
  const pngPath = join(dir, "banner.png");
  writeFileSync(htmlPath, html);
  execFileSync(
    CHROME_PATH,
    [
      "--headless=new",
      "--no-sandbox",
      "--disable-gpu",
      "--hide-scrollbars",
      "--force-device-scale-factor=1",
      "--window-size=1600,520",
      "--virtual-time-budget=5000",
      `--screenshot=${pngPath}`,
      `file://${htmlPath.startsWith("/") ? "" : "/"}${htmlPath.replace(/\\/g, "/")}`,
    ],
    { stdio: "ignore" },
  );
  return pngPath;
}

async function execute(payload, file) {
  const form = new FormData();
  form.append("payload_json", JSON.stringify(payload));
  if (file)
    form.append("files[0]", new Blob([readFileSync(file)], { type: "image/png" }), "release.png");
  const res = await fetch(`${DISCORD_WEBHOOK_URL}?wait=true`, { method: "POST", body: form });
  if (!res.ok) throw new Error(`Discord ${res.status}: ${await res.text()}`);
  return res.json();
}

const release = await fetchRelease();
const repoUrl = `https://github.com/${GITHUB_REPOSITORY}`;
const iconUrl = `https://raw.githubusercontent.com/${GITHUB_REPOSITORY}/main/src-tauri/icons/128x128@2x.png`;
const banner = renderBanner(
  `Pragma ${release.tag_name}`,
  mkdtempSync(join(tmpdir(), "pragma-release-")),
);
const date = (release.published_at ?? release.created_at).slice(0, 10);

const ping = DISCORD_ROLE_ID
  ? { content: `<@&${DISCORD_ROLE_ID}>`, allowed_mentions: { roles: [DISCORD_ROLE_ID] } }
  : { allowed_mentions: { parse: [] } };
const bannerMessage = await execute(ping, banner);

await execute({
  allowed_mentions: { parse: [] },
  embeds: [
    {
      color: ORANGE,
      title: release.name || `Pragma ${release.tag_name}`,
      url: release.html_url,
      description: `${formatNotes(release.body ?? "", repoUrl)}\n\n[Download ${release.tag_name}](${release.html_url}) · Installed versions update themselves.`,
      footer: { text: `Released ${date}`, icon_url: iconUrl },
    },
  ],
});

console.log(`Posted ${release.tag_name} (role pinged: ${bannerMessage.mention_roles?.length > 0})`);
