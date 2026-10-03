// Type declarations for Pragma extension authors (pragma-extension-v1).
// Copy this file next to your extension's main.js for editor IntelliSense.

declare namespace pragma {
  interface CommandDefinition {
    id: string;
    title: string;
    category?: string;
  }

  interface PanelDefinition {
    id: string;
    title: string;
    icon?:
      | "puzzle-piece"
      | "chart-line"
      | "note"
      | "list-bullets"
      | "globe"
      | "star"
      | "heart"
      | "lightning"
      | "terminal"
      | "git-branch"
      | "calendar-blank";
    html?: string;
  }

  type NotificationType = "info" | "success" | "warning" | "error";

  interface ActiveFile {
    path: string;
    name: string;
    language: string | null;
    cursor: { line: number; column: number } | null;
  }

  interface CommandEvent {
    commandId: string;
  }

  interface WorkspaceFile {
    path: string;
    name: string;
    content: string;
  }

  interface WorkspaceEntry {
    path: string;
    name: string;
    isDirectory: boolean;
  }

  interface EditorSelection {
    line: number;
    column: number;
  }

  interface StatusBarItem {
    id: string;
    text: string;
    tooltip?: string;
    // Command id of this extension, run when the item is clicked.
    command?: string;
    alignment?: "left" | "right";
  }

  interface Keybinding {
    // Command id of this extension.
    command: string;
    // e.g. "ctrl+shift+k"; "mod" is Cmd on macOS and Ctrl elsewhere.
    key: string;
    // Overrides `key` on macOS.
    mac?: string;
  }

  interface TextDocument {
    path: string;
    // Pragma language id, e.g. "typescript", "python", "markdown".
    language: string | null;
    text: string;
  }

  interface Diagnostic {
    // 1-based positions.
    line: number;
    column?: number;
    endLine?: number;
    endColumn?: number;
    message: string;
    severity?: "error" | "warning" | "info";
  }

  interface CompletionRequest {
    document: TextDocument;
    // 1-based cursor position.
    line: number;
    column: number;
    // The word before the cursor.
    prefix: string;
    triggerCharacter: string | null;
  }

  interface CompletionItem {
    label: string;
    insertText?: string;
    detail?: string;
    kind?:
      | "text"
      | "keyword"
      | "variable"
      | "function"
      | "method"
      | "class"
      | "interface"
      | "property"
      | "constant"
      | "type"
      | "enum"
      | "namespace";
  }

  interface AgentTool {
    // 1-40 letters, numbers, "_" or "-"; agents see it as ext__<extension id>__<name>.
    name: string;
    description: string;
    // JSON schema of the input, with type "object".
    inputSchema: Record<string, unknown>;
    // Read-only tools run without approval; all others follow the agent approval settings.
    readOnly?: boolean;
  }

  interface Terminal {
    id: string;
  }

  interface FileSavedEvent {
    path: string;
    language: string | null;
  }

  interface WorkspaceOpenedEvent {
    root: string;
  }

  interface SessionFinishedEvent {
    sessionId: string;
    title: string;
    status: "done" | "error" | "cancelled";
  }

  type Unregister = () => Promise<void>;

  const commands: {
    register(command: CommandDefinition): Promise<void>;
    unregister(id: string): Promise<void>;
  };

  const themes: {
    // Must be a valid pragma-theme-v1 object; the id is prefixed automatically.
    register(theme: unknown): Promise<string>;
  };

  const panels: {
    register(panel: PanelDefinition): Promise<void>;
  };

  const settings: {
    get(): Promise<unknown>;
    set(value: unknown): Promise<void>;
  };

  const notifications: {
    show(message: string, type?: NotificationType): Promise<void>;
  };

  const workspace: {
    // Paths are relative to the workspace root; anything outside it is rejected.
    readFile(path: string): Promise<WorkspaceFile>;
    writeFile(path: string, content: string): Promise<void>;
    list(path?: string): Promise<WorkspaceEntry[]>;
  };

  const editor: {
    getActiveFile(): Promise<ActiveFile | null>;
    getText(): Promise<string | null>;
    setText(text: string): Promise<void>;
    getSelection(): Promise<EditorSelection | null>;
  };

  const statusBar: {
    // Adds the item or replaces the one with the same id.
    set(item: StatusBarItem): Promise<void>;
    remove(id: string): Promise<void>;
  };

  const keybindings: {
    register(binding: Keybinding): Promise<void>;
    unregister(command: string): Promise<void>;
  };

  const languages: {
    // "*" registers the provider for every language.
    registerDiagnosticsProvider(
      language: string,
      provider: (document: TextDocument) => Diagnostic[] | Promise<Diagnostic[]>,
    ): Promise<Unregister>;
    registerCompletionProvider(
      language: string,
      provider: (request: CompletionRequest) => CompletionItem[] | Promise<CompletionItem[]>,
      options?: { triggerCharacters?: string[] },
    ): Promise<Unregister>;
  };

  const agent: {
    // The handler's return value (a string or JSON) becomes the tool result.
    registerTool(tool: AgentTool, handler: (input: unknown) => unknown): Promise<void>;
    unregisterTool(name: string): Promise<void>;
  };

  const terminal: {
    // `cwd` is relative to the workspace root.
    create(options?: { name?: string; cwd?: string }): Promise<Terminal>;
    // Appends a newline unless `addNewLine` is false.
    sendText(id: string, text: string, addNewLine?: boolean): Promise<void>;
  };

  function onCommand(handler: (event: CommandEvent) => void): () => void;
  function on(event: "fileSaved", handler: (data: FileSavedEvent) => void): () => void;
  function on(event: "activeFileChanged", handler: (data: ActiveFile | null) => void): () => void;
  function on(event: "workspaceOpened", handler: (data: WorkspaceOpenedEvent) => void): () => void;
  function on(event: "sessionFinished", handler: (data: SessionFinishedEvent) => void): () => void;
  function on(event: string, handler: (data: unknown) => void): () => void;
}
