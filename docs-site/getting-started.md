# Getting started

Pragma is a desktop IDE for working with coding agents. It runs Claude Code, Codex and the other coding CLIs side by side, each on its own task and in its own Git worktree, and keeps a full editor one tab away. Pragma is a native app built with Tauri and Rust, it is open source, and it needs no account.

## Install a release

Pre-built installers for Windows, macOS and Linux are on the [Releases](https://github.com/NiklasTech/pragma/releases) page. Installed versions check for updates and can update themselves.

::: warning The installers are not code-signed yet
Windows may show a SmartScreen warning, and macOS may ask you to confirm the first launch. See [Release builds are unsigned](./troubleshooting.md#release-builds-are-unsigned).
:::

### Windows

1. Download `Pragma_<version>_x64-setup.exe` or `Pragma_<version>_x64_en-US.msi`.
2. Run the installer.
3. Start Pragma from the Start menu.

### macOS

1. Download `Pragma_<version>_universal.dmg`. It runs on Apple Silicon and Intel.
2. Open the DMG and drag Pragma into the Applications folder.
3. If Gatekeeper blocks the first launch, right-click the app and choose **Open**.

### Linux

1. Download the package for your distribution:
   - Debian and Ubuntu: `Pragma_<version>_amd64.deb`
   - Fedora and openSUSE: `Pragma-<version>-1.x86_64.rpm`
   - Any distribution: `Pragma_<version>_amd64.AppImage`
2. Install the package, or make the AppImage executable with `chmod +x Pragma_*.AppImage`.
3. Start Pragma from your application menu or by running the AppImage.

## The first start

Pragma opens with a short welcome. **Set up Pragma** leads to the setup page, **I know my way around** skips it. The setup is one page with four sections, and you can change everything later in the settings:

| Section   | What you do                                                                                           |
| --------- | ----------------------------------------------------------------------------------------------------- |
| Look      | Pick light, dark or system mode and a theme. You see it right away                                    |
| Agents    | Install and sign in to the coding CLIs you use, or save an API key for Pragma's own agent             |
| Project   | Open a folder to work in, or create a new project. This is optional                                   |
| Languages | Pragma checks the languages of the folder and copies the install command of a missing language server |

Signing in to a coding CLI happens in the CLI itself, so Pragma never sees your credentials. The CLI then runs with your own plan. See [Coding CLIs and API keys](./ai-providers.md).

## Your first tasks

1. Open the agents tab of your project. It shows the [start card](./agents/index.md#the-start-card).
2. Write what should happen, one task per line, and pick the agents that share the tasks. See [Hand out tasks](./agents/start.md).
3. Press **Start** or `Cmd/Ctrl + Enter`. Each agent gets its own pane and, when several start together, its own worktree.
4. Watch them in the [status pill and the overview](./agents/watching.md). When one is done, [review its changes](./agents/review.md) and commit them or open a pull request.
5. Switch to the code tab with `Cmd/Ctrl + Shift + E` to work on the code yourself.

The [walkthrough](https://www.youtube.com/watch?v=KRmWK-zc-c8) takes a small app from an idea to a commit. It was recorded with Pragma 0.7, before the current design.

## Build from source

### Prerequisites

- [Node.js](https://nodejs.org/) 24 or later
- [pnpm](https://pnpm.io/) 11.5.0 or later
- [Rust](https://www.rust-lang.org/tools/install), stable toolchain
- The Tauri system dependencies of your operating system

#### macOS

```bash
xcode-select --install
```

#### Windows

Install the [Microsoft C++ Build Tools](https://docs.microsoft.com/en-us/windows/dev-environment/rust/setup) and enable the Windows SDK.

#### Linux (Debian/Ubuntu)

```bash
sudo apt update
sudo apt install libwebkit2gtk-4.1-dev libgtk-3-dev libappindicator3-dev librsvg2-dev patchelf
```

#### Linux (Arch / CachyOS)

```bash
sudo pacman -S webkit2gtk-4.1 gtk3 libappindicator librsvg patchelf
```

For other distributions, see the [Tauri prerequisites guide](https://v2.tauri.app/start/prerequisites/).

### Clone and run

```bash
git clone https://github.com/NiklasTech/pragma.git
cd pragma
pnpm install
pnpm run dev:desktop
```

Pragma uses [Vite+](https://viteplus.dev/) as its build toolchain. The `vp` command is available through `pnpm exec vp ...` after `pnpm install`, or globally after `pnpm add -g vite-plus`.

### Build a release binary

```bash
pnpm run build:desktop
```

The bundles are written to `src-tauri/target/release/bundle/`. To build only some package formats, for example `.deb` and `.rpm` on Linux:

```bash
pnpm exec vp run tauri build --bundles deb,rpm
```

### Run checks

```bash
pnpm run check
pnpm run test
cd src-tauri && cargo test
```

## Next steps

- [The Pragma window](./window.md) explains the strip, the tabs and the command line.
- [Spaces](./spaces.md) covers projects, tabs and saved layouts.
- [Configuration](./configuration.md) describes the settings and where Pragma stores data.
- [Keyboard shortcuts](./keyboard-shortcuts.md) lists the default keys.
- [Troubleshooting](./troubleshooting.md) covers common problems.
