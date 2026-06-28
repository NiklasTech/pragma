export interface LspServerDefinition {
  command: string;
  args: string[];
}

export const LSP_SERVERS: Record<string, LspServerDefinition> = {
  typescript: {
    command: "typescript-language-server",
    args: ["--stdio"],
  },
};

export function isLspSupported(language: string | undefined): boolean {
  if (!language) return false;
  return language in LSP_SERVERS;
}

export function getLspServerDefinition(language: string): LspServerDefinition | undefined {
  return LSP_SERVERS[language];
}
