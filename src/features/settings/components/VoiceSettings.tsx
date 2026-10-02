"use client";

import * as React from "react";
import { invoke } from "@tauri-apps/api/core";

import {
  PARAKEET_MODELS,
  WHISPER_MODELS,
  recommendedVoiceModel,
  type VoiceModelOption,
} from "@/features/ai/dictation/voiceModels";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Switch } from "@/shared/components/ui/switch";
import { useSettingsStore, type VoiceEngine } from "@/shared/stores/settings";

import { LocalModelSetup, type LocalModelCommands } from "./LocalModelSetup";
import { SettingRow } from "./ui/SettingRow";
import { SettingSection } from "./ui/SettingSection";

const ENGINE_LABELS: Record<VoiceEngine, string> = {
  "web-speech": "Web Speech",
  whisper: "Whisper (local)",
  parakeet: "Parakeet (local)",
};

const PARAKEET_COMMANDS: LocalModelCommands = {
  status: "parakeet_status",
  download: "parakeet_download",
  cancel: "parakeet_cancel_download",
  remove: "parakeet_remove",
  progressEvent: "parakeet-download-progress",
};

const WHISPER_COMMANDS: LocalModelCommands = {
  status: "stt_status",
  download: "stt_download",
  cancel: "stt_cancel_download",
  remove: "stt_remove",
  progressEvent: "stt-download-progress",
};

function gigabytes(megabytes: number): string {
  return (megabytes / 1024).toFixed(1);
}

interface ModelPickerProps<Id extends string> {
  engineName: string;
  models: readonly VoiceModelOption<Id>[];
  value: Id;
  recommended: Id | null;
  commands: LocalModelCommands;
  onChange: (id: Id) => void;
}

function ModelPicker<Id extends string>({
  engineName,
  models,
  value,
  recommended,
  commands,
  onChange,
}: ModelPickerProps<Id>) {
  const selected = models.find((model) => model.id === value) ?? models[0];
  const labelFor = (model: VoiceModelOption<Id>) =>
    model.id === recommended && models.length > 1 ? `${model.label} (recommended)` : model.label;

  return (
    <>
      <SettingRow
        label="Model"
        description={`${selected.summary} Uses about ${gigabytes(selected.memoryMb)} GB of memory while transcribing.`}
        control={
          models.length === 1 ? (
            <span className="text-ui-sm text-fg-default">{selected.label}</span>
          ) : (
            <Select
              value={selected.id}
              onValueChange={(next) => {
                const match = models.find((model) => model.id === next);
                if (match) onChange(match.id);
              }}
            >
              <SelectTrigger className="max-w-[260px]">
                <SelectValue>{labelFor(selected)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {models.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    {labelFor(model)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )
        }
      />
      <LocalModelSetup
        engineName={engineName}
        model={selected.id}
        modelLabel={selected.label}
        commands={commands}
      />
    </>
  );
}

export function VoiceSettings() {
  const settingsStore = useSettingsStore();
  const [memoryBytes, setMemoryBytes] = React.useState<number | null>(null);

  React.useEffect(() => {
    void invoke<number>("voice_system_memory")
      .then(setMemoryBytes)
      .catch(() => setMemoryBytes(null));
  }, []);

  const setEngine = (value: string | null) => {
    if (value === "web-speech" || value === "whisper" || value === "parakeet") {
      settingsStore.setAISettings({ voiceEngine: value });
    }
  };

  const engine = settingsStore.ai.voiceEngine;

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
          <Select value={engine} onValueChange={setEngine}>
            <SelectTrigger className="max-w-[200px]">
              <SelectValue>{ENGINE_LABELS[engine]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="web-speech">Web Speech</SelectItem>
              <SelectItem value="whisper">Whisper (local)</SelectItem>
              <SelectItem value="parakeet">Parakeet (local)</SelectItem>
            </SelectContent>
          </Select>
        }
      />
      {engine === "web-speech" ? (
        <p className="py-2.5 text-ui-xs text-fg-muted">
          Uses the free speech recognition built into the operating system. No audio leaves your
          device.
        </p>
      ) : engine === "parakeet" ? (
        <p className="py-2.5 text-ui-xs text-fg-muted">
          Runs NVIDIA Parakeet V3 on your machine, with punctuation and 25 European languages. It is
          a speech model, not the coding LLM, and no audio leaves your device. Model by NVIDIA,
          licensed under CC-BY-4.0.
        </p>
      ) : (
        <p className="py-2.5 text-ui-xs text-fg-muted">
          Runs OpenAI Whisper through whisper.cpp on your machine, with 99 languages. It is a speech
          model, not the coding LLM, and no audio leaves your device.
        </p>
      )}
      {engine === "parakeet" && (
        <ModelPicker
          engineName="Parakeet"
          models={PARAKEET_MODELS}
          value={settingsStore.ai.parakeetModel}
          recommended={recommendedVoiceModel(PARAKEET_MODELS, memoryBytes)}
          commands={PARAKEET_COMMANDS}
          onChange={(parakeetModel) => settingsStore.setAISettings({ parakeetModel })}
        />
      )}
      {engine === "whisper" && (
        <ModelPicker
          engineName="Whisper"
          models={WHISPER_MODELS}
          value={settingsStore.ai.whisperModel}
          recommended={recommendedVoiceModel(WHISPER_MODELS, memoryBytes)}
          commands={WHISPER_COMMANDS}
          onChange={(whisperModel) => settingsStore.setAISettings({ whisperModel })}
        />
      )}
    </SettingSection>
  );
}
