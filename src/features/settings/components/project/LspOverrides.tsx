"use client";

import { listLspLanguages } from "@/shared/lib/lsp-servers";

import { SettingRow } from "../ui/SettingRow";
import { SettingSection } from "../ui/SettingSection";
import { InheritSelect } from "./fields";

export function LspOverrides({
  value,
  onChange,
}: {
  value: Record<string, boolean>;
  onChange: (value: Record<string, boolean>) => void;
}) {
  const set = (language: string, enabled: boolean | undefined) => {
    const next = { ...value };
    if (enabled === undefined) delete next[language];
    else next[language] = enabled;
    onChange(next);
  };

  return (
    <SettingSection title="Language servers">
      {listLspLanguages().map((language) => (
        <SettingRow
          key={language}
          label={language}
          control={
            <InheritSelect
              label={`${language} language server`}
              value={value[language]}
              onChange={(enabled) => set(language, enabled)}
            />
          }
        />
      ))}
    </SettingSection>
  );
}
