/** Mirrors `WorkspaceSettings` in `src-tauri/src/modules/workspace_settings.rs`. */
export interface WorkspaceSettings {
  editor?: {
    tabSize?: number;
    insertSpaces?: boolean;
    formatOnSave?: boolean;
    trimTrailingWhitespace?: boolean;
    insertFinalNewline?: boolean;
    rulers?: number[];
  };
  agent?: {
    allowedCommands?: string[];
    stepLimit?: number;
  };
  lsp?: {
    enabled?: Record<string, boolean>;
  };
}

export type WorkspaceEditorKey = keyof NonNullable<WorkspaceSettings["editor"]>;
