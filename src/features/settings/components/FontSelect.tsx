"use client";

import { useState } from "react";
import { DownloadSimple } from "@phosphor-icons/react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { useFontStore } from "@/shared/stores/fonts";
import type { FontSelection } from "@/shared/stores/settings";
import { FontManagerDialog } from "./FontManagerDialog";

interface FontSelectProps {
  value: FontSelection;
  onChange: (selection: FontSelection) => void;
}

export function FontSelect({ value, onChange }: FontSelectProps) {
  const fonts = useFontStore((s) => s.fonts);
  const [managerOpen, setManagerOpen] = useState(false);

  const installedIds = new Set(fonts.map((f) => f.id));
  const selectedId = value.fontId && installedIds.has(value.fontId) ? value.fontId : "";

  const handleValueChange = (id: string | null) => {
    if (!id) return;
    if (id === "__system__") {
      onChange({ fontId: "", fontFamily: value.fontFamily });
      return;
    }
    const font = fonts.find((f) => f.id === id);
    if (font) {
      onChange({ fontId: font.id, fontFamily: font.name });
    }
  };

  const isCustom = selectedId === "";

  return (
    <div className="flex items-center gap-2">
      <Select value={selectedId || "__system__"} onValueChange={handleValueChange}>
        <SelectTrigger className="max-w-[220px]">
          <SelectValue placeholder={value.fontFamily || "System font"} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__system__">System / custom font</SelectItem>
          {fonts.map((font) => (
            <SelectItem key={font.id} value={font.id}>
              {font.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {isCustom && (
        <Input
          value={value.fontFamily}
          onChange={(e) => onChange({ fontId: "", fontFamily: e.target.value })}
          placeholder="JetBrains Mono"
          className="max-w-[160px]"
        />
      )}
      <Button
        variant="outline"
        size="icon-xs"
        onClick={() => setManagerOpen(true)}
        title="Manage fonts"
      >
        <DownloadSimple size={14} />
      </Button>
      <FontManagerDialog open={managerOpen} onOpenChange={setManagerOpen} />
    </div>
  );
}
