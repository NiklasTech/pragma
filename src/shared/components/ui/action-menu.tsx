import { useState, type KeyboardEvent, type ReactElement, type ReactNode } from "react";
import { ContextMenu as ContextMenuPrimitive } from "@base-ui/react/context-menu";

import { getIsMac } from "@/shared/lib/shortcuts";
import { cn } from "@/shared/lib/utils";

import { ContextMenu } from "./context-menu";

/** One action: a letter that runs it while the menu is open, and the app shortcut if it has one. */
export interface ActionItem {
  key: string;
  label: string;
  shortcut?: string;
  danger?: boolean;
  disabled?: boolean;
  onSelect: () => void;
}

export interface ActionGroup {
  label?: string;
  items: ActionItem[];
}

export type ActionTone = "info" | "done" | "needs-you" | "idle" | "error";

/** What a menu is about, a block above the actions such as an agent's question, and the actions. */
export interface ActionMenuSpec {
  head: string;
  tone?: ActionTone;
  prelude?: ReactNode;
  groups: ActionGroup[];
}

const TONE_CELL: Record<ActionTone, string> = {
  info: "bg-status-info",
  done: "bg-state-done",
  "needs-you": "bg-state-needs-you",
  idle: "bg-fg-subtle",
  error: "bg-status-error",
};

const MODIFIERS = { mod: ["⌘", "Ctrl+"], shift: ["⇧", "Shift+"], alt: ["⌥", "Alt+"] } as const;

/** A shortcut as the menu shows it: ⌘⇧F on macOS, Ctrl+Shift+F elsewhere. */
export function menuShortcut(modifiers: (keyof typeof MODIFIERS)[], key: string): string {
  const index = getIsMac() ? 0 : 1;
  return modifiers.map((modifier) => MODIFIERS[modifier][index]).join("") + key;
}

/** The enabled action a typed letter runs, if any. */
export function actionForKey(spec: ActionMenuSpec, key: string): ActionItem | null {
  const wanted = key.toLowerCase();
  for (const group of spec.groups) {
    const found = group.items.find((item) => !item.disabled && item.key === wanted);
    if (found) return found;
  }
  return null;
}

/** Groups that still hold actions; empty groups drop out. */
function visibleGroups(spec: ActionMenuSpec): ActionGroup[] {
  return spec.groups.filter((group) => group.items.length > 0);
}

interface ActionMenuPopupProps {
  spec: ActionMenuSpec;
  onClose: () => void;
}

/// The menu itself: its subject on top, a letter per action, the shortcut on the right, danger in red.
export function ActionMenuPopup({ spec, onClose }: ActionMenuPopupProps) {
  const groups = visibleGroups(spec);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.metaKey || event.ctrlKey || event.altKey || event.key.length !== 1) return;
    const item = actionForKey(spec, event.key);
    if (!item) return;
    event.preventDefault();
    event.stopPropagation();
    onClose();
    item.onSelect();
  };

  return (
    <ContextMenuPrimitive.Portal>
      <ContextMenuPrimitive.Positioner
        className="isolate z-[80] outline-none"
        align="start"
        alignOffset={4}
        side="right"
      >
        <ContextMenuPrimitive.Popup
          data-slot="action-menu"
          onKeyDown={handleKeyDown}
          className="flex max-h-(--available-height) w-72 origin-(--transform-origin) flex-col overflow-y-auto rounded-[7px] bg-bg-sheet p-1 font-mono text-ui-xs text-fg-default shadow-[var(--shadow-md)] ring-1 ring-border outline-none duration-100 data-closed:animate-out data-closed:fade-out-0 data-open:animate-in data-open:fade-in-0"
        >
          <div className="mb-0.75 flex min-w-0 items-center gap-2 border-b border-border-subtle px-2 pt-1.75 pb-2 text-ui-2xs text-fg-muted">
            <span
              aria-hidden="true"
              className={cn("size-2 shrink-0", TONE_CELL[spec.tone ?? "idle"])}
            />
            <span className="min-w-0 truncate">{spec.head}</span>
          </div>
          {spec.prelude}
          {groups.map((group, index) => (
            <ContextMenuPrimitive.Group
              key={`${group.label ?? ""}-${index}`}
              className={cn("flex flex-col py-0.5", index > 0 && "border-t border-border-subtle")}
            >
              {group.label && (
                <ContextMenuPrimitive.GroupLabel className="px-2 pt-1.25 pb-0.75 text-[10px] tracking-[0.08em] text-fg-subtle uppercase">
                  {group.label}
                </ContextMenuPrimitive.GroupLabel>
              )}
              {group.items.map((item) => (
                <ContextMenuPrimitive.Item
                  key={item.key + item.label}
                  disabled={item.disabled}
                  onClick={item.onSelect}
                  data-variant={item.danger ? "destructive" : "default"}
                  className={cn(
                    "group/action grid h-6.75 cursor-default grid-cols-[18px_minmax(0,1fr)_auto] items-center gap-2.25 rounded-[4px] pr-2 pl-1.5 outline-hidden select-none",
                    "data-highlighted:bg-bg-hover data-disabled:text-fg-subtle data-disabled:opacity-60",
                    item.danger && "text-status-error data-highlighted:bg-status-error/10",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "inline-flex size-4.5 items-center justify-center rounded-[3px] text-[10.5px] text-fg-subtle ring-1 ring-border ring-inset",
                      "group-data-highlighted/action:bg-bg-hover group-data-highlighted/action:text-fg-default group-data-highlighted/action:ring-fg-muted",
                      item.danger &&
                        "text-status-error ring-status-error group-data-highlighted/action:text-status-error group-data-highlighted/action:ring-status-error",
                    )}
                  >
                    {item.key}
                  </span>
                  <span className="truncate">{item.label}</span>
                  {item.shortcut ? (
                    <span className="text-ui-2xs text-fg-subtle">{item.shortcut}</span>
                  ) : (
                    <span />
                  )}
                </ContextMenuPrimitive.Item>
              ))}
            </ContextMenuPrimitive.Group>
          ))}
          <div className="mt-0.75 flex justify-between border-t border-border-subtle px-2 pt-1.5 pb-1 text-[10.5px] text-fg-subtle">
            <span>a letter runs its action</span>
            <span>esc</span>
          </div>
        </ContextMenuPrimitive.Popup>
      </ContextMenuPrimitive.Positioner>
    </ContextMenuPrimitive.Portal>
  );
}

interface ActionContextMenuProps {
  /** Built when the menu opens, so it reads the state of that moment; null opens nothing. */
  menu: () => ActionMenuSpec | null;
  children: ReactElement;
}

/// Right-click on the child opens its action menu.
export function ActionContextMenu({ menu, children }: ActionContextMenuProps) {
  const [open, setOpen] = useState(false);
  const [spec, setSpec] = useState<ActionMenuSpec | null>(null);

  return (
    <ContextMenu
      open={open}
      onOpenChange={(next) => {
        if (next) {
          const built = menu();
          if (!built) return;
          setSpec(built);
        }
        setOpen(next);
      }}
    >
      <ContextMenuPrimitive.Trigger render={children} />
      {spec && <ActionMenuPopup spec={spec} onClose={() => setOpen(false)} />}
    </ContextMenu>
  );
}
