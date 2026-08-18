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

  const editor: {
    getActiveFile(): Promise<ActiveFile | null>;
  };

  function onCommand(handler: (event: CommandEvent) => void): () => void;
  function on(event: string, handler: (data: unknown) => void): () => void;
}
