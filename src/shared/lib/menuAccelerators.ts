import type { ShortcutBinding, ShortcutMap } from "@/shared/lib/shortcuts";

/** The native menu accelerator of a binding, such as `Cmd+Shift+KeyP`; the key code names the key. */
export function toMenuAccelerator(binding: ShortcutBinding | null | undefined): string | null {
  const key = binding?.code ?? binding?.key;
  if (!binding || !key) return null;
  const parts: string[] = [];
  if (binding.meta) parts.push("Cmd");
  if (binding.ctrl) parts.push("Ctrl");
  if (binding.alt) parts.push("Alt");
  if (binding.shift) parts.push("Shift");
  parts.push(key);
  return parts.join("+");
}

export function menuAccelerators(shortcuts: ShortcutMap): Record<string, string | null> {
  return Object.fromEntries(
    Object.entries(shortcuts).map(([id, binding]) => [id, toMenuAccelerator(binding)]),
  );
}
