"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Switch } from "@/shared/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { useSettingsStore, type AutoSave } from "@/shared/stores/settings";

const AUTO_SAVE_LABELS: Record<AutoSave, string> = {
  off: "Off",
  onFocusChange: "On Focus Change",
  afterDelay: "After Delay",
};

export function EditorSettings() {
  const { editor, setEditorSettings } = useSettingsStore();

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Behavior</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <Label className="cursor-pointer" htmlFor="editor-vim">
              Vim Mode
            </Label>
            <Switch
              id="editor-vim"
              checked={editor.vimMode}
              onCheckedChange={(v) => setEditorSettings({ vimMode: v })}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label className="cursor-pointer" htmlFor="editor-word-wrap">
              Word Wrap
            </Label>
            <Switch
              id="editor-word-wrap"
              checked={editor.wordWrap}
              onCheckedChange={(v) => setEditorSettings({ wordWrap: v })}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label className="cursor-pointer" htmlFor="editor-line-numbers">
              Line Numbers
            </Label>
            <Switch
              id="editor-line-numbers"
              checked={editor.lineNumbers}
              onCheckedChange={(v) => setEditorSettings({ lineNumbers: v })}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label className="cursor-pointer" htmlFor="editor-insert-spaces">
              Insert Spaces
            </Label>
            <Switch
              id="editor-insert-spaces"
              checked={editor.insertSpaces}
              onCheckedChange={(v) => setEditorSettings({ insertSpaces: v })}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label className="cursor-pointer" htmlFor="editor-format-on-save">
              Format on Save
            </Label>
            <Switch
              id="editor-format-on-save"
              checked={editor.formatOnSave}
              onCheckedChange={(v) => setEditorSettings({ formatOnSave: v })}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label className="cursor-pointer" htmlFor="editor-sticky-lines">
              Sticky Lines
            </Label>
            <Switch
              id="editor-sticky-lines"
              checked={editor.stickyLines}
              onCheckedChange={(v) => setEditorSettings({ stickyLines: v })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Font Size</Label>
            <Input
              type="number"
              min={8}
              max={32}
              value={editor.fontSize}
              onChange={(e) => setEditorSettings({ fontSize: Number(e.target.value) })}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Font Family</Label>
            <Input
              value={editor.fontFamily}
              onChange={(e) => setEditorSettings({ fontFamily: e.target.value })}
              placeholder="JetBrains Mono"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Tab Size</Label>
            <Input
              type="number"
              min={1}
              max={8}
              value={editor.tabSize}
              onChange={(e) => setEditorSettings({ tabSize: Number(e.target.value) })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Auto Save</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Mode</Label>
            <Select
              value={editor.autoSave}
              onValueChange={(v) => setEditorSettings({ autoSave: v as AutoSave })}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(AUTO_SAVE_LABELS) as AutoSave[]).map((mode) => (
                  <SelectItem key={mode} value={mode}>
                    {AUTO_SAVE_LABELS[mode]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {editor.autoSave === "afterDelay" && (
            <div className="flex flex-col gap-1.5">
              <Label>Delay (ms)</Label>
              <Input
                type="number"
                min={100}
                step={100}
                value={editor.autoSaveDelay}
                onChange={(e) => setEditorSettings({ autoSaveDelay: Number(e.target.value) })}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
