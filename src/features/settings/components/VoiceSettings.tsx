"use client";

import * as React from "react";
import { invoke } from "@tauri-apps/api/core";
import { CheckCircle, DownloadSimple } from "@phosphor-icons/react";

import { Button } from "@/shared/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Switch } from "@/shared/components/ui/switch";
import { useSettingsStore } from "@/shared/stores/settings";

import { SettingRow } from "./ui/SettingRow";
import { SettingSection } from "./ui/SettingSection";

interface SttStatus {
  supported: boolean;
  installed: boolean;
}

export function VoiceSettings() {
  const settingsStore = useSettingsStore();
  const [whisperStatus, setWhisperStatus] = React.useState<SttStatus | null>(null);
  const [whisperDownloading, setWhisperDownloading] = React.useState(false);
  const [whisperError, setWhisperError] = React.useState<string | null>(null);

  const refreshWhisperStatus = React.useCallback(async () => {
    try {
      const status = await invoke<SttStatus>("stt_status");
      setWhisperStatus(status);
    } catch {
      setWhisperStatus(null);
    }
  }, []);

  const handleWhisperDownload = async () => {
    setWhisperDownloading(true);
    setWhisperError(null);
    try {
      await invoke("stt_download");
    } catch (err) {
      setWhisperError(String(err));
    } finally {
      setWhisperDownloading(false);
      await refreshWhisperStatus();
    }
  };

  React.useEffect(() => {
    void refreshWhisperStatus();
  }, [refreshWhisperStatus]);

  const setEngine = (value: string | null) => {
    if (value === "web-speech" || value === "whisper") {
      settingsStore.setAISettings({ voiceEngine: value });
    }
  };

  return (
    <SettingSection title="Voice input">
      <SettingRow
        label="Enable"
        description="Show a dictation microphone in the chat composer"
        control={
          <Switch
            checked={settingsStore.ai.voiceInput}
            onCheckedChange={(v) => settingsStore.setAISettings({ voiceInput: v })}
            aria-label="Enable voice input"
          />
        }
      />
      <SettingRow
        label="Engine"
        description="Transcription backend used by the composer microphone"
        control={
          <Select value={settingsStore.ai.voiceEngine} onValueChange={setEngine}>
            <SelectTrigger className="max-w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="web-speech">Web Speech</SelectItem>
              <SelectItem value="whisper">Whisper (local)</SelectItem>
            </SelectContent>
          </Select>
        }
      />
      {settingsStore.ai.voiceEngine === "web-speech" ? (
        <p className="py-2.5 text-ui-xs text-fg-muted">
          Uses the free speech recognition built into the operating system. No audio leaves your
          device.
        </p>
      ) : (
        <p className="py-2.5 text-ui-xs text-fg-muted">
          Runs a local speech model (~75 MB) on your machine. It is a speech model, not the coding
          LLM, and no audio leaves your device.
        </p>
      )}
      {settingsStore.ai.voiceEngine === "whisper" && (
        <div className="flex flex-col gap-2 py-2.5">
          {whisperStatus && !whisperStatus.supported && (
            <span className="text-ui-xs text-status-error">
              Whisper is not available on this platform. Web Speech keeps working.
            </span>
          )}
          {whisperStatus?.supported && !whisperStatus.installed && (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => void handleWhisperDownload()}
                disabled={whisperDownloading}
              >
                <DownloadSimple size={14} className="mr-1" />
                {whisperDownloading ? "Downloading..." : "Download Whisper"}
              </Button>
              <span className="text-ui-xs text-fg-muted">
                Downloads the whisper.cpp engine and speech model on demand.
              </span>
            </div>
          )}
          {whisperStatus?.supported && whisperStatus.installed && (
            <span className="flex items-center gap-1 text-ui-xs text-status-success">
              <CheckCircle size={14} /> Whisper installed
            </span>
          )}
          {whisperError && <span className="text-ui-xs text-status-error">{whisperError}</span>}
        </div>
      )}
    </SettingSection>
  );
}
