"use client";

import { useCallback, useState } from "react";
import {
  ArrowsClockwise,
  Chat,
  Check,
  Copy,
  DownloadSimple,
  Folder,
  GitBranch,
  Plus,
  Robot,
  Terminal,
} from "@phosphor-icons/react";
import { toast } from "sonner";

import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { copyToClipboard } from "@/shared/lib/clipboard";
import { useAIStore, type CLIManifest } from "@/shared/stores/ai";

import { buildSessionMenuCliRows } from "./session-menu";
import type { NewSessionActions } from "./useNewSessionActions";

function ItemText({ title, hint }: { title: string; hint: string }) {
  return (
    <span className="flex min-w-0 flex-1 flex-col">
      <span className="truncate">{title}</span>
      <span className="truncate text-ui-2xs text-fg-subtle">{hint}</span>
    </span>
  );
}

interface NewSessionMenuProps {
  rootPath: string | null;
  isRepo: boolean;
  defaultChoice: "checkout" | "worktree";
  actions: NewSessionActions;
  className?: string;
  variant?: "default" | "outline" | "secondary";
  size?: "default" | "sm";
}

export function NewSessionMenu({
  rootPath,
  isRepo,
  defaultChoice,
  actions,
  className,
  variant = "default",
  size = "default",
}: NewSessionMenuProps) {
  const manifests = useAIStore((state) => state.cliManifests);
  const statuses = useAIStore((state) => state.cliStatuses);
  const loadCLIManifests = useAIStore((state) => state.loadCLIManifests);
  const loadCLIStatuses = useAIStore((state) => state.loadCLIStatuses);
  const [open, setOpen] = useState(false);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      setOpen(next);
      if (!next) return;
      if (manifests.length === 0) void loadCLIManifests();
      if (Object.keys(statuses).length === 0) void loadCLIStatuses();
    },
    [loadCLIManifests, loadCLIStatuses, manifests.length, statuses],
  );

  const rows = buildSessionMenuCliRows(manifests, statuses);
  const installedRows = rows.filter((row) => !row.disabled);
  const missingRows = rows.filter((row) => row.disabled);

  const copyInstallCommand = (name: string, command: string | null) => {
    if (!command) return;
    void copyToClipboard(command).then(
      () => toast.success(`Install command for ${name} copied`),
      () => toast.error("Could not copy the install command"),
    );
  };
  const findManifest = (manifestId: string): CLIManifest | undefined =>
    manifests.find((manifest) => manifest.id === manifestId);

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger
        render={
          <Button variant={variant} size={size} disabled={!rootPath} className={className}>
            <Plus size={13} weight="bold" />
            New session
          </Button>
        }
      />
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Conversation</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => void actions.startAsk()}>
            <Chat size={14} />
            <ItemText title="Ask" hint="Talk about the code without changing files" />
          </DropdownMenuItem>

          {isRepo ? (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Robot size={14} />
                <ItemText title="Agent" hint="Plans, edits files and runs commands" />
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-64">
                <DropdownMenuItem onClick={() => void actions.startAgentCheckout()}>
                  <Folder size={14} />
                  <ItemText title="This checkout" hint="Work directly in your folder" />
                  {defaultChoice === "checkout" && <Check size={13} className="text-primary" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => void actions.startAgentWorktree()}>
                  <GitBranch size={14} />
                  <ItemText title="New worktree" hint="Isolated branch, safe to discard" />
                  {defaultChoice === "worktree" && <Check size={13} className="text-primary" />}
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          ) : (
            <DropdownMenuItem onClick={() => void actions.startAgentCheckout()}>
              <Robot size={14} />
              <ItemText title="Agent" hint="Plans, edits files and runs commands" />
            </DropdownMenuItem>
          )}
        </DropdownMenuGroup>

        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>Coding CLIs</DropdownMenuLabel>

          {installedRows.length === 0 && (
            <DropdownMenuItem disabled>
              <span className="text-fg-subtle">No coding CLI installed</span>
            </DropdownMenuItem>
          )}

          {installedRows.map((row) => {
            if (row.items.length > 1) {
              return (
                <DropdownMenuSub key={row.manifestId}>
                  <DropdownMenuSubTrigger>
                    <Terminal size={13} />
                    <span className="flex-1">{row.name}</span>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    {row.items.map((item) => (
                      <DropdownMenuItem
                        key={item.action}
                        onClick={() => {
                          const manifest = findManifest(row.manifestId);
                          if (!manifest) return;
                          if (item.action === "conversation") {
                            void actions.startConversation(manifest);
                          } else {
                            void actions.startTerminal(manifest);
                          }
                        }}
                      >
                        {item.action === "conversation" ? (
                          <Chat size={13} />
                        ) : (
                          <Terminal size={13} />
                        )}
                        <span className="flex-1">{item.label}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              );
            }

            const only = row.items[0];
            return (
              <DropdownMenuItem
                key={row.manifestId}
                onClick={() => {
                  const manifest = findManifest(row.manifestId);
                  if (!manifest || !only) return;
                  if (only.action === "conversation") void actions.startConversation(manifest);
                  else void actions.startTerminal(manifest);
                }}
              >
                {only?.action === "conversation" ? <Chat size={13} /> : <Terminal size={13} />}
                <span className="flex-1">{row.name}</span>
              </DropdownMenuItem>
            );
          })}

          {missingRows.length > 0 && (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <DownloadSimple size={13} />
                <span className="flex-1 text-fg-muted">Not installed</span>
                <span className="text-ui-2xs text-fg-subtle tabular-nums">
                  {missingRows.length}
                </span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-80">
                <DropdownMenuLabel>Click to copy the install command</DropdownMenuLabel>
                {missingRows.map((row) => (
                  <DropdownMenuItem
                    key={row.manifestId}
                    title={row.hint ?? undefined}
                    onClick={() => copyInstallCommand(row.name, row.hint)}
                  >
                    <Terminal size={13} />
                    <ItemText title={row.name} hint={row.hint ?? ""} />
                    <Copy size={12} className="text-fg-subtle" />
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          )}
        </DropdownMenuGroup>

        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => void loadCLIStatuses()}>
          <ArrowsClockwise size={13} />
          <span className="flex-1">Recheck</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
