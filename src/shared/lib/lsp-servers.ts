export interface LspServerDefinition {
  language: string;
  displayName: string;
  command: string;
  args: string[];
  installCommand: string;
  installProgram?: string;
  installArgs?: string[];
  packageManager?: string;
  homepage?: string;
  requiredRuntime?: string;
}

export const LSP_SERVERS: Record<string, LspServerDefinition> = {
  typescript: {
    language: "typescript",
    displayName: "TypeScript Language Server",
    command: "typescript-language-server",
    args: ["--stdio"],
    installCommand: "npm install -g typescript-language-server",
    installProgram: "npm",
    installArgs: ["install", "-g", "typescript-language-server"],
    packageManager: "npm",
    homepage: "https://github.com/typescript-language-server/typescript-language-server",
    requiredRuntime: "Node.js",
  },
  javascript: {
    language: "javascript",
    displayName: "TypeScript Language Server (for JavaScript)",
    command: "typescript-language-server",
    args: ["--stdio"],
    installCommand: "npm install -g typescript-language-server",
    installProgram: "npm",
    installArgs: ["install", "-g", "typescript-language-server"],
    packageManager: "npm",
    homepage: "https://github.com/typescript-language-server/typescript-language-server",
    requiredRuntime: "Node.js",
  },
  rust: {
    language: "rust",
    displayName: "rust-analyzer",
    command: "rust-analyzer",
    args: [],
    installCommand: "rustup component add rust-analyzer",
    installProgram: "rustup",
    installArgs: ["component", "add", "rust-analyzer"],
    packageManager: "rustup",
    homepage: "https://rust-analyzer.github.io/",
    requiredRuntime: "Rust",
  },
  python: {
    language: "python",
    displayName: "Python LSP Server",
    command: "pylsp",
    args: [],
    installCommand: "pip install python-lsp-server",
    installProgram: "pip",
    installArgs: ["install", "python-lsp-server"],
    packageManager: "pip",
    homepage: "https://github.com/python-lsp/python-lsp-server",
    requiredRuntime: "Python",
  },
  go: {
    language: "go",
    displayName: "gopls",
    command: "gopls",
    args: [],
    installCommand: "go install golang.org/x/tools/gopls@latest",
    installProgram: "go",
    installArgs: ["install", "golang.org/x/tools/gopls@latest"],
    packageManager: "go",
    homepage: "https://github.com/golang/tools/tree/master/gopls",
    requiredRuntime: "Go",
  },
  java: {
    language: "java",
    displayName: "Eclipse JDT Language Server",
    command: "jdtls",
    args: [],
    installCommand: "npm install -g jdtls",
    installProgram: "npm",
    installArgs: ["install", "-g", "jdtls"],
    packageManager: "npm",
    homepage: "https://github.com/eclipse/eclipse.jdt.ls",
    requiredRuntime: "Node.js (wrapper) + JDK",
  },
  c: {
    language: "c",
    displayName: "clangd",
    command: "clangd",
    args: [],
    installCommand:
      "# Install LLVM/clangd via your package manager, e.g.:\n# macOS: brew install llvm\n# Ubuntu/Debian: sudo apt install clangd\n# Arch: sudo pacman -S clang",
    packageManager: "system",
    homepage: "https://clangd.llvm.org/",
  },
  cpp: {
    language: "cpp",
    displayName: "clangd (for C++)",
    command: "clangd",
    args: [],
    installCommand:
      "# Install LLVM/clangd via your package manager, e.g.:\n# macOS: brew install llvm\n# Ubuntu/Debian: sudo apt install clangd\n# Arch: sudo pacman -S clang",
    packageManager: "system",
    homepage: "https://clangd.llvm.org/",
  },
  html: {
    language: "html",
    displayName: "VS Code HTML Language Server",
    command: "vscode-html-language-server",
    args: ["--stdio"],
    installCommand: "npm install -g @vscode/langserver-html",
    installProgram: "npm",
    installArgs: ["install", "-g", "@vscode/langserver-html"],
    packageManager: "npm",
    homepage: "https://github.com/microsoft/vscode-html-languageservice",
    requiredRuntime: "Node.js",
  },
  css: {
    language: "css",
    displayName: "VS Code CSS Language Server",
    command: "vscode-css-language-server",
    args: ["--stdio"],
    installCommand: "npm install -g @vscode/langserver-css",
    installProgram: "npm",
    installArgs: ["install", "-g", "@vscode/langserver-css"],
    packageManager: "npm",
    homepage: "https://github.com/microsoft/vscode-css-languageservice",
    requiredRuntime: "Node.js",
  },
};

export function isLspSupported(language: string | undefined): boolean {
  if (!language) return false;
  return language in LSP_SERVERS;
}

export function getLspServerDefinition(language: string): LspServerDefinition | undefined {
  return LSP_SERVERS[language];
}

export function listLspLanguages(): string[] {
  return Object.keys(LSP_SERVERS);
}

export function isLspAutoInstallable(language: string): boolean {
  const def = LSP_SERVERS[language];
  if (!def) return false;
  return Boolean(def.installProgram && def.installArgs && def.installArgs.length > 0);
}
