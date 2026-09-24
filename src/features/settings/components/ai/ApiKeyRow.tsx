"use client";

import { CheckCircle, Eye, EyeSlash, FloppyDisk, Trash, XCircle } from "@phosphor-icons/react";

import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";

import { SettingRow } from "../ui/SettingRow";
import type { ApiKeySaveStatus } from "./types";

interface ApiKeyRowProps {
  label: string;
  description: string;
  apiKeyRef: string | null;
  value: string;
  showKey: boolean;
  saveStatus: ApiKeySaveStatus | null;
  onValueChange: (value: string) => void;
  onToggleShowKey: () => void;
  onSave: () => Promise<void>;
  onDelete: () => Promise<void>;
}

export function ApiKeyRow({
  label,
  description,
  apiKeyRef,
  value,
  showKey,
  saveStatus,
  onValueChange,
  onToggleShowKey,
  onSave,
  onDelete,
}: ApiKeyRowProps) {
  return (
    <SettingRow
      label={label}
      description={description}
      control={
        <div className="flex max-w-[280px] flex-col gap-1">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                type={showKey ? "text" : "password"}
                value={value}
                onChange={(e) => onValueChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && value.trim()) {
                    void onSave();
                  }
                }}
                placeholder={apiKeyRef ? `Key saved (${apiKeyRef})` : "Enter API key"}
                className="w-full pr-8"
              />
              <button
                type="button"
                onClick={onToggleShowKey}
                className="absolute top-1/2 right-2 -translate-y-1/2 text-fg-muted hover:text-fg-default"
              >
                {showKey ? <EyeSlash size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <Button size="sm" onClick={onSave} disabled={!value.trim()}>
              <FloppyDisk size={14} />
            </Button>
            {apiKeyRef && (
              <Button size="sm" variant="destructive" onClick={onDelete}>
                <Trash size={14} />
              </Button>
            )}
          </div>
          {saveStatus && (
            <span
              className={
                saveStatus.type === "ok"
                  ? "text-ui-xs text-status-success"
                  : "text-ui-xs text-status-error"
              }
            >
              {saveStatus.type === "ok" && <CheckCircle size={12} className="mr-1 inline" />}
              {saveStatus.type === "error" && <XCircle size={12} className="mr-1 inline" />}
              {saveStatus.message}
            </span>
          )}
        </div>
      }
    />
  );
}
