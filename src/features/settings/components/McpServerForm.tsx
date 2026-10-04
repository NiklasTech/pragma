"use client";

import type * as React from "react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Switch } from "@/shared/components/ui/switch";
import { Textarea } from "@/shared/components/ui/textarea";
import type { McpServerConfig, McpTransport } from "@/shared/stores/settings";
import { FloppyDisk, X } from "@phosphor-icons/react";
import { McpEnvFields } from "./McpEnvFields";
import { McpRemoteFields } from "./McpRemoteFields";
import type { EditForm } from "./mcp-server-form";

interface McpServerFormProps {
  form: EditForm;
  setForm: React.Dispatch<React.SetStateAction<EditForm>>;
  savedServer: McpServerConfig | undefined;
  missingKeys: string[];
  saveError: string | null;
  onCancel: () => void;
  onSave: () => void;
}

export function McpServerForm({
  form,
  setForm,
  savedServer,
  missingKeys,
  saveError,
  onCancel,
  onSave,
}: McpServerFormProps) {
  return (
    <div className="flex flex-col gap-3 py-3">
      <div className="flex flex-col gap-1.5">
        <Label>Name</Label>
        <Input
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="e.g. filesystem"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Transport</Label>
        <Select
          value={form.transport}
          onValueChange={(value) => setForm((f) => ({ ...f, transport: value as McpTransport }))}
        >
          <SelectTrigger className="max-w-[260px]">
            <SelectValue>
              {form.transport === "http" ? "Remote (Streamable HTTP)" : "Local process (stdio)"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="stdio">Local process (stdio)</SelectItem>
            <SelectItem value="http">Remote (Streamable HTTP)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {form.transport === "http" ? (
        <McpRemoteFields
          value={{
            url: form.url,
            headersText: form.headersText,
            secretHeaders: form.secretHeaders,
          }}
          savedKeys={savedServer?.secretHeaders ?? []}
          missingKeys={missingKeys}
          onChange={(remote) => setForm((f) => ({ ...f, ...remote }))}
        />
      ) : (
        <>
          <div className="flex flex-col gap-1.5">
            <Label>Command</Label>
            <Input
              value={form.command}
              onChange={(e) => setForm((f) => ({ ...f, command: e.target.value }))}
              placeholder="e.g. npm"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Arguments (one per line or whitespace separated)</Label>
            <Textarea
              value={form.argsText}
              onChange={(e) => setForm((f) => ({ ...f, argsText: e.target.value }))}
              placeholder="exec&#10;--yes&#10;@modelcontextprotocol/server-filesystem&#10;/home/user"
              className="min-h-20 font-mono"
            />
          </div>

          <McpEnvFields
            value={{ envText: form.envText, secrets: form.secrets }}
            savedKeys={savedServer?.secretEnv ?? []}
            missingKeys={missingKeys}
            onChange={(env) => setForm((f) => ({ ...f, ...env }))}
          />
        </>
      )}

      <div className="flex items-center justify-between">
        <Label className="cursor-pointer" htmlFor="mcp-autostart">
          Autostart
        </Label>
        <Switch
          id="mcp-autostart"
          checked={form.autostart}
          onCheckedChange={(v) => setForm((f) => ({ ...f, autostart: v }))}
        />
      </div>

      {saveError && <p className="text-ui-xs text-status-error">{saveError}</p>}

      <div className="flex justify-end gap-2">
        <Button variant="outline" size="xs" onClick={onCancel}>
          <X size={14} className="mr-1" />
          Cancel
        </Button>
        <Button size="xs" onClick={onSave}>
          <FloppyDisk size={14} className="mr-1" />
          Save
        </Button>
      </div>
    </div>
  );
}
