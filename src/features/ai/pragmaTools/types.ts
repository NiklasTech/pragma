export interface PragmaToolContext {
  /** The chat session whose agent called the tool. */
  sessionId: string;
  /** The tool call's id, also used for its approval. */
  requestId: string;
  /** The folder relative paths resolve against: the session's worktree, else the project. */
  cwd: string;
  /** The project the session belongs to, for its agent settings. */
  rootPath: string;
}

/** Answers one call of a built-in Pragma tool with the text the agent gets back. */
export type PragmaToolHandler = (args: unknown, context: PragmaToolContext) => Promise<string>;
