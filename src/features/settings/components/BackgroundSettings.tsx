import { ArrowCounterClockwise, ImageSquare, Trash } from "@phosphor-icons/react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Switch } from "@/shared/components/ui/switch";
import { useSettingsStore } from "@/shared/stores/settings";
import {
  BACKGROUND_DEFAULTS,
  BACKGROUND_FITS,
  BACKGROUND_POSITIONS,
  clampBlur,
  clampDim,
  clampTransparency,
  imageVisibility,
  isBackgroundFit,
  isBackgroundPosition,
  MAX_DIM,
  MAX_TRANSPARENCY,
  surfaceAlpha,
  type BackgroundFit,
  type BackgroundPosition,
} from "@/theme/background";
import { useWindowTranslucencyStore, type WindowMaterial } from "@/theme/windowTranslucency";
import { SettingRow } from "./ui/SettingRow";
import { SettingSection } from "./ui/SettingSection";
import { useMemo } from "react";
import { generateCssVariables, useTheme } from "@/theme";
import { parseColor } from "@/theme/color";
import { useBackgroundImageStore } from "@/theme/backgroundImage";

const FIT_LABELS: Record<BackgroundFit, string> = {
  cover: "Cover",
  contain: "Contain",
  tile: "Tile",
  center: "Center",
};

const POSITION_LABELS: Record<BackgroundPosition, string> = {
  center: "Center",
  top: "Top",
  bottom: "Bottom",
  left: "Left",
  right: "Right",
};

const MATERIAL_LABELS: Record<WindowMaterial, string> = {
  sidebar: "Sidebar",
  underWindow: "Under Window",
  hud: "HUD",
  mica: "Mica",
  acrylic: "Acrylic",
};

// A new image would stay hidden behind opaque surfaces, so picking one starts with some transparency.
const TRANSPARENCY_WITH_IMAGE = 60;

function percentSteps(max: number): number[] {
  return Array.from({ length: max / 10 + 1 }, (_, i) => i * 10);
}

function PercentSelect({
  value,
  max,
  onChange,
}: {
  value: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <Select value={String(value)} onValueChange={(v) => onChange(Number(v))}>
      <SelectTrigger className="max-w-[200px]">
        <SelectValue>{`${value}%`}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {percentSteps(max).map((step) => (
          <SelectItem key={step} value={String(step)}>
            {`${step}%`}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function WindowTranslucencyRows() {
  const status = useWindowTranslucencyStore((s) => s.status);
  const setTranslucency = useWindowTranslucencyStore((s) => s.set);
  if (!status?.supported) return null;

  const update = (enabled: boolean, material: WindowMaterial) => {
    setTranslucency(enabled, material).catch((err: unknown) => {
      toast.error("Could not change window translucency", { description: String(err) });
    });
  };
  const needsRestart = status.enabled !== status.active;

  return (
    <>
      <SettingRow
        label="Window Translucency"
        description={
          needsRestart
            ? "Restart Pragma to apply this change."
            : "Lets the desktop show through the window. Raise Transparency to see it."
        }
        control={
          <Switch
            checked={status.enabled}
            onCheckedChange={(enabled) => update(enabled, status.material)}
          />
        }
      />
      {status.materials.length > 1 && (
        <SettingRow
          label="Material"
          disabled={!status.enabled}
          control={
            <Select
              value={status.material}
              disabled={!status.enabled}
              onValueChange={(value) => {
                const material = status.materials.find((m) => m === value);
                if (material) update(status.enabled, material);
              }}
            >
              <SelectTrigger className="max-w-[200px]">
                <SelectValue>{MATERIAL_LABELS[status.material]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {status.materials.map((material) => (
                  <SelectItem key={material} value={material}>
                    {MATERIAL_LABELS[material]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          }
        />
      )}
    </>
  );
}

/** How strongly the image shows through the root surface, and whether readability limits it. */
function useImageVisibility(): { percent: number; limited: boolean } | null {
  const { theme } = useTheme();
  const background = useSettingsStore((s) => s.background);
  const tones = useBackgroundImageStore((s) => s.tones);
  return useMemo(() => {
    if (!background.image) return null;
    const vars = new Map(generateCssVariables(theme).map(({ name, value }) => [name, value]));
    const root = parseColor(vars.get("--bg-root") ?? "");
    const text = parseColor(vars.get("--fg-default") ?? "");
    const muted = parseColor(vars.get("--fg-muted") ?? "");
    if (!root || !text || !muted) return null;
    const transparency = clampTransparency(background.transparency);
    const alpha = surfaceAlpha(
      root,
      text,
      muted,
      transparency,
      { image: true, window: false, tones },
      background.dim,
      root,
    );
    return {
      percent: imageVisibility(alpha, background.dim),
      limited: alpha > 1 - transparency / 100 + 0.005,
    };
  }, [theme, background, tones]);
}

export function BackgroundSettings() {
  const background = useSettingsStore((s) => s.background);
  const setBackground = useSettingsStore((s) => s.setBackgroundSettings);
  const hasImage = Boolean(background.image);
  const visibility = useImageVisibility();

  const chooseImage = async () => {
    const selected = await open({
      multiple: false,
      filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "gif"] }],
    });
    if (!selected || Array.isArray(selected)) return;
    try {
      const image = await invoke<string>("background_image_set", { sourcePath: selected });
      setBackground({
        image,
        transparency:
          background.transparency > 0 ? background.transparency : TRANSPARENCY_WITH_IMAGE,
      });
    } catch (err) {
      toast.error("Could not use this image", { description: String(err) });
    }
  };

  const removeImage = async () => {
    setBackground({ image: "" });
    await invoke("background_image_clear").catch(() => {});
  };

  return (
    <SettingSection
      title="Background"
      action={
        <Button
          variant="outline"
          size="xs"
          className="gap-1"
          onClick={() => {
            setBackground(BACKGROUND_DEFAULTS);
            void invoke("background_image_clear").catch(() => {});
          }}
        >
          <ArrowCounterClockwise size={12} />
          Reset to Default
        </Button>
      }
    >
      <SettingRow
        label="Background Image"
        description="Shown behind the interface. Pragma keeps its own copy of the image."
        control={
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="gap-1"
              onClick={() => void chooseImage()}
            >
              <ImageSquare size={14} />
              {hasImage ? "Change Image" : "Choose Image"}
            </Button>
            {hasImage && (
              <Button
                variant="ghost"
                size="icon-sm"
                title="Remove image"
                onClick={() => void removeImage()}
              >
                <Trash size={14} />
              </Button>
            )}
          </div>
        }
      />
      <SettingRow
        label="Fit"
        disabled={!hasImage}
        control={
          <Select
            value={background.fit}
            disabled={!hasImage}
            onValueChange={(v) => {
              if (isBackgroundFit(v)) setBackground({ fit: v });
            }}
          >
            <SelectTrigger className="max-w-[200px]">
              <SelectValue>{FIT_LABELS[background.fit]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {BACKGROUND_FITS.map((fit) => (
                <SelectItem key={fit} value={fit}>
                  {FIT_LABELS[fit]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />
      <SettingRow
        label="Position"
        disabled={!hasImage}
        control={
          <Select
            value={background.position}
            disabled={!hasImage}
            onValueChange={(v) => {
              if (isBackgroundPosition(v)) setBackground({ position: v });
            }}
          >
            <SelectTrigger className="max-w-[200px]">
              <SelectValue>{POSITION_LABELS[background.position]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {BACKGROUND_POSITIONS.map((position) => (
                <SelectItem key={position} value={position}>
                  {POSITION_LABELS[position]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />
      <SettingRow
        label="Blur"
        description="Blur of the image in pixels, from 0 to 40"
        disabled={!hasImage}
        control={
          <Input
            type="number"
            min={0}
            max={40}
            step={1}
            disabled={!hasImage}
            value={background.blur}
            onChange={(e) => setBackground({ blur: clampBlur(Number(e.target.value)) })}
            className="max-w-[180px]"
          />
        }
      />
      <SettingRow
        label="Dim"
        description="How much of the theme's background color covers the image"
        disabled={!hasImage}
        control={
          <PercentSelect
            value={clampDim(background.dim)}
            max={MAX_DIM}
            onChange={(dim) => setBackground({ dim: clampDim(dim) })}
          />
        }
      />
      <SettingRow
        label="Transparency"
        description={
          visibility
            ? `The image shows through at about ${visibility.percent}%.${
                visibility.limited
                  ? " Pragma limits it so text stays readable. An image closer in brightness to the theme, or less Dim, shows more."
                  : ""
              }`
            : "How much the image or the window shows through sidebar, panels and bars. Pragma limits it where text would become hard to read."
        }
        control={
          <PercentSelect
            value={clampTransparency(background.transparency)}
            max={MAX_TRANSPARENCY}
            onChange={(transparency) =>
              setBackground({ transparency: clampTransparency(transparency) })
            }
          />
        }
      />
      <SettingRow
        label="Transparent Editor"
        control={
          <Switch
            checked={background.transparentEditor}
            onCheckedChange={(transparentEditor) => setBackground({ transparentEditor })}
          />
        }
      />
      <SettingRow
        label="Transparent Terminal"
        description="Applies to terminals opened after the change"
        control={
          <Switch
            checked={background.transparentTerminal}
            onCheckedChange={(transparentTerminal) => setBackground({ transparentTerminal })}
          />
        }
      />
      <WindowTranslucencyRows />
    </SettingSection>
  );
}
