# Getting Started

Pragma is a desktop code editor designed for developers who want AI assistance without the bloat of a browser-based IDE. It is built with Tauri 2, Rust, React 19, TypeScript and CodeMirror 6.

## Install a release

Pre-built installers for Windows, macOS and Linux are available on the [Releases](https://github.com/NiklasTech/pragma/releases) page.

The first release is distributed without code signing. Windows may show a SmartScreen warning, and macOS may require you to right-click the app and select **Open** the first time you run it. The macOS build is produced automatically by CI but has not been tested on Apple hardware.

### Windows

1. Download `pragma_<version>_x64-setup.exe` or `pragma_<version>_x64_en-US.msi` from the latest release.
2. Run the installer and follow the setup steps.
3. Launch Pragma from the Start menu or desktop shortcut.

### macOS

1. Download `pragma_<version>_x64.dmg` (Intel) or `pragma_<version>_aarch64.dmg` (Apple Silicon).
2. Open the DMG and drag **Pragma** into your Applications folder.
3. On first launch, right-click the app and choose **Open** if Gatekeeper blocks it.

### Linux

1. Download the package for your distribution:
   - Debian/Ubuntu: `pragma_<version>_amd64.deb`
   - Fedora/openSUSE: `pragma-<version>-1.x86_64.rpm`
   - Distribution-agnostic: `pragma_<version>_amd64.AppImage`
2. Install the package or make the AppImage executable (`chmod +x pragma_*.AppImage`).
3. Launch Pragma from your applications menu or by running the AppImage.

## Build from source

### Prerequisites

- [Node.js](https://nodejs.org/) 24 or later
- [pnpm](https://pnpm.io/) 11.5.0 or later
- [Rust](https://www.rust-lang.org/tools/install) stable toolchain
- Tauri system dependencies for your operating system

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

### Clone and install

```bash
git clone https://github.com/NiklasTech/pragma.git
cd pragma
pnpm install
```

Start the frontend development server or the full desktop app:

```bash
pnpm run dev          # frontend dev server
pnpm run dev:desktop  # full Tauri desktop app
```

Pragma uses [Vite+](https://viteplus.dev/) as its build toolchain. The `vp` command is available through `pnpm exec vp ...` after `pnpm install`, or by installing Vite+ globally with `pnpm add -g vite-plus`.

### Build a release binary

```bash
pnpm run build:desktop
```

The resulting bundles are written to `src-tauri/target/release/bundle/`.

To build only specific package formats, for example `.deb` and `.rpm` on Linux:

```bash
pnpm exec vp run tauri build --bundles deb,rpm
```

### Run checks

```bash
pnpm run check
pnpm run test
cd src-tauri && cargo test
```

## Quick start

1. Start Pragma and complete the onboarding dialog.
2. Select a theme and configure your preferred AI provider.
3. Open a project folder using the file explorer in the sidebar.
4. Open any file in the editor.
5. Open the AI chat panel with `Cmd/Ctrl + Shift + A`.
6. Reference a file by typing `@filename` in the chat input.
7. Toggle the terminal with `Cmd/Ctrl + Shift + T`.

## Next steps

- [Configuration](./configuration.md) describes the settings panels and where Pragma stores data.
- [AI Provider Setup](./ai-providers.md) explains API keys, local models and CLI providers.
- [MCP Server Setup](./mcp-servers.md) covers Model Context Protocol servers.
- [Theming Guide](./theming.md) covers built-in and custom themes.
- [Keyboard Shortcuts](./keyboard-shortcuts.md) lists the default bindings.
- [Troubleshooting](./troubleshooting.md) covers common problems.
