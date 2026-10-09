"use client";

import * as React from "react";
import { Plus, X } from "@phosphor-icons/react";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";
import { useWorkspaceSettingsStore } from "@/shared/stores/workspaceSettings/store";
import {
  resolveTrust,
  securityKey,
  useWorkspaceTrustStore,
} from "@/shared/stores/workspaceSettings/trust";
import type { WorkspaceSettings } from "@/shared/stores/workspaceSettings/types";

import { SettingRow } from "../ui/SettingRow";
import { SettingSection } from "../ui/SettingSection";
import { FolderTrustSection } from "./FolderTrustSection";
import { LspOverrides } from "./LspOverrides";
import { InheritSelect, parseNumberList, parsePositiveInt } from "./fields";

type EditorDraft = NonNullable<WorkspaceSettings["editor"]>;

/// Edits `.pragma/settings.json`, the settings this folder shares with everyone who opens it.
export function ProjectSettings() {
  const rootPath = useFileExplorerStore((state) => state.rootPath);
  const loadedRoot = useWorkspaceSettingsStore((state) => state.rootPath);
  const saved = useWorkspaceSettingsStore((state) => state.settings);
  const error = useWorkspaceSettingsStore((state) => state.error);
  const save = useWorkspaceSettingsStore((state) => state.save);
  const decisions = useWorkspaceTrustStore((state) => state.decisions);
  const decide = useWorkspaceTrustStore((state) => state.decide);

  const [draft, setDraft] = React.useState<WorkspaceSettings>({});
  const [newCommand, setNewCommand] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (rootPath !== loadedRoot) void useWorkspaceSettingsStore.getState().load(rootPath);
  }, [rootPath, loadedRoot]);

  React.useEffect(() => setDraft(saved ?? {}), [saved]);

  if (!rootPath) {
    return <p className="text-ui-sm text-fg-subtle">Open a folder to edit its project settings.</p>;
  }

  const editor: EditorDraft = draft.editor ?? {};
  const commands = draft.agent?.allowedCommands ?? [];
  const setEditor = (patch: Partial<EditorDraft>) =>
    setDraft((current) => ({ ...current, editor: { ...current.editor, ...patch } }));
  const setAgent = (patch: Partial<NonNullable<WorkspaceSettings["agent"]>>) =>
    setDraft((current) => ({ ...current, agent: { ...current.agent, ...patch } }));

  const addCommand = () => {
    const pattern = newCommand.trim();
    if (pattern && !commands.includes(pattern))
      setAgent({ allowedCommands: [...commands, pattern] });
    setNewCommand("");
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await save(draft);
      toast.success("Saved .pragma/settings.json");
    } catch (err) {
      toast.error(String(err));
    } finally {
      setSaving(false);
    }
  };

  const trust = resolveTrust(loadedRoot, saved, decisions);
  const savedKey = securityKey(saved);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved ?? {});

  return (
    <div className="flex flex-col gap-8">
      <p className="text-ui-xs text-fg-subtle">
        Stored in .pragma/settings.json and shared with everyone who opens this folder. Empty or
        Inherit uses your own setting.
      </p>
      {error && (
        <Alert variant="destructive">
          <AlertDescription className="text-ui-xs">{error}</AlertDescription>
        </Alert>
      )}

      <FolderTrustSection rootPath={rootPath} />

      <SettingSection title="Editor">
        <SettingRow
          label="Tab size"
          control={
            <Input
              type="number"
              min={1}
              max={16}
              value={editor.tabSize ?? ""}
              placeholder="Inherit"
              aria-label="Tab size"
              className="h-7 w-28 text-ui-sm"
              onChange={(event) => setEditor({ tabSize: parsePositiveInt(event.target.value, 16) })}
            />
          }
        />
        {(
          [
            ["insertSpaces", "Insert spaces"],
            ["formatOnSave", "Format on save"],
            ["trimTrailingWhitespace", "Trim trailing whitespace"],
            ["insertFinalNewline", "Insert final newline"],
          ] as const
        ).map(([key, label]) => (
          <SettingRow
            key={key}
            label={label}
            control={
              <InheritSelect
                label={label}
                value={editor[key]}
                onChange={(value) => setEditor({ [key]: value })}
              />
            }
          />
        ))}
        <SettingRow
          label="Rulers"
          description="Columns separated by commas."
          control={
            <Input
              defaultValue={editor.rulers?.join(", ") ?? ""}
              key={editor.rulers?.join(",") ?? "none"}
              placeholder="Inherit"
              aria-label="Rulers"
              className="h-7 w-40 text-ui-sm"
              onBlur={(event) => setEditor({ rulers: parseNumberList(event.target.value, 500) })}
            />
          }
        />
      </SettingSection>

      <SettingSection
        title="Agent"
        badge={
          trust === "trusted"
            ? { label: "Allowed on this computer", variant: "success" }
            : trust === "rejected"
              ? { label: "Not allowed on this computer", variant: "warning" }
              : undefined
        }
        action={
          loadedRoot && savedKey && trust !== "pending" ? (
            <Button
              size="xs"
              variant="ghost"
              onClick={() => decide(loadedRoot, savedKey, trust !== "trusted")}
            >
              {trust === "trusted" ? "Stop allowing" : "Allow"}
            </Button>
          ) : undefined
        }
      >
        <SettingRow
          label="Step limit"
          control={
            <Input
              type="number"
              min={1}
              value={draft.agent?.stepLimit ?? ""}
              placeholder="Inherit"
              aria-label="Project step limit"
              className="h-7 w-28 text-ui-sm"
              onChange={(event) =>
                setAgent({ stepLimit: parsePositiveInt(event.target.value, 10_000) })
              }
            />
          }
        />
        <div className="flex flex-col gap-2 py-3">
          <span className="text-ui-sm font-medium text-fg-default">Allowed commands</span>
          <span className="text-ui-xs text-fg-subtle">
            Added to your own patterns once you allow them on this computer.
          </span>
          <div className="flex items-center gap-2">
            <Input
              value={newCommand}
              onChange={(event) => setNewCommand(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addCommand();
                }
              }}
              placeholder="e.g. pnpm test"
              className="h-7 text-ui-sm"
            />
            <Button size="xs" variant="outline" onClick={addCommand} disabled={!newCommand.trim()}>
              <Plus size={14} />
              Add
            </Button>
          </div>
          {commands.map((pattern) => (
            <div key={pattern} className="flex items-center justify-between gap-2">
              <code className="min-w-0 truncate font-mono text-ui-xs text-fg-muted">{pattern}</code>
              <Button
                variant="ghost"
                size="icon-xs"
                title="Remove pattern"
                onClick={() =>
                  setAgent({ allowedCommands: commands.filter((item) => item !== pattern) })
                }
              >
                <X size={14} />
              </Button>
            </div>
          ))}
        </div>
      </SettingSection>

      <LspOverrides
        value={draft.lsp?.enabled ?? {}}
        onChange={(enabled) => setDraft((current) => ({ ...current, lsp: { enabled } }))}
      />

      <div className="flex justify-end gap-2">
        <Button variant="ghost" disabled={!dirty || saving} onClick={() => setDraft(saved ?? {})}>
          Discard
        </Button>
        <Button disabled={!dirty || saving} onClick={() => void handleSave()}>
          Save to .pragma/settings.json
        </Button>
      </div>
    </div>
  );
}
