"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Label } from "@/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { useAIStore } from "@/shared/stores/ai";
import {
  accountLabel,
  choosableAccounts,
  useCliAccountsStore,
} from "@/shared/stores/ai/cliAccounts";
import { refreshCLIStatuses } from "@/shared/stores/ai/cliRefresh";
import { useSettingsStore } from "@/shared/stores/settings";
import { useRepositoryWorkspaceSettings } from "@/shared/stores/workspaceSettings/repositories";

import { GroupEnvironmentSelect } from "../sessions/GroupEnvironmentSelect";
import { DEFAULT_GROUP_ENVIRONMENT, sharesFiles, type GroupEnvironment } from "../sessions/group";
import { activateRepository } from "../sessions/openInRepository";
import { RepositorySelect } from "../sessions/RepositoryPicker";
import { useRepositoryChoice } from "../sessions/useRepositoryChoice";
import { buildSessionMenuCliRows } from "../threads/session-menu";
import { launchTerminals } from "./launch";
import { MAX_PANES } from "./operations";

interface CliChoice {
  key: string;
  manifestId: string;
  label: string;
  /** The account folder, for a CLI with several accounts. */
  accountDir?: string;
}

const COUNTS = Array.from({ length: MAX_PANES }, (_, index) => index + 1);
const MODES: readonly GroupEnvironment[] = ["isolated", "shared", "checkout"];

interface LaunchCliDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LaunchCliDialog({ open, onOpenChange }: LaunchCliDialogProps) {
  const manifests = useAIStore((state) => state.cliManifests);
  const statuses = useAIStore((state) => state.cliStatuses);
  const loadCLIManifests = useAIStore((state) => state.loadCLIManifests);
  const accounts = useCliAccountsStore((state) => state.accounts);
  const accountNames = useSettingsStore((state) => state.ai.cliAccounts.names);
  const [choiceKey, setChoiceKey] = useState<string | null>(null);
  const [count, setCount] = useState(4);
  const [picked, setPicked] = useState<GroupEnvironment | null>(null);
  const [launching, setLaunching] = useState(false);
  const repository = useRepositoryChoice();
  const { reset: resetRepository, rootPath } = repository;
  const setting = useRepositoryWorkspaceSettings(rootPath)?.agent?.launchCliEnvironment;
  const mode = picked ?? setting ?? DEFAULT_GROUP_ENVIRONMENT;

  useEffect(() => {
    if (!open) return;
    setPicked(null);
    resetRepository();
  }, [open, resetRepository]);

  useEffect(() => {
    if (!open) return;
    if (manifests.length === 0) void loadCLIManifests();
    void refreshCLIStatuses();
  }, [loadCLIManifests, manifests.length, open]);

  // A CLI with several accounts is offered once per account.
  const available = buildSessionMenuCliRows(manifests, statuses)
    .filter((row) => !row.disabled && row.items.some((item) => item.action === "terminal"))
    .flatMap((row): CliChoice[] => {
      const rowAccounts = choosableAccounts(accounts, row.manifestId);
      if (rowAccounts.length === 0) {
        return [{ key: row.manifestId, manifestId: row.manifestId, label: row.name }];
      }
      return rowAccounts.map((account) => ({
        key: `${row.manifestId}:${account.configDir ?? ""}`,
        manifestId: row.manifestId,
        accountDir: account.configDir ?? undefined,
        label: `${row.name} · ${accountLabel(account, accountNames)}`,
      }));
    });
  const choice = available.find((item) => item.key === choiceKey) ?? available[0];
  const selected = manifests.find((manifest) => manifest.id === choice?.manifestId);

  const handleLaunch = async () => {
    if (!selected || !rootPath || launching) return;
    setLaunching(true);
    try {
      await launchTerminals(rootPath, selected, count, mode, choice?.accountDir);
      onOpenChange(false);
      await activateRepository(rootPath);
    } catch {
      toast.error(`Could not start ${selected.name}`);
    } finally {
      setLaunching(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Launch coding CLIs</DialogTitle>
          <DialogDescription>
            Start several instances side by side. They replace the panes on screen; open threads
            stay in the list.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {rootPath && repository.paths.length > 1 && (
            <div className="flex flex-col gap-1.5">
              <Label>Repository</Label>
              <RepositorySelect
                paths={repository.paths}
                value={rootPath}
                onChange={repository.pick}
                className="w-full"
              />
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label>CLI</Label>
            {available.length === 0 ? (
              <p className="text-ui-xs text-fg-subtle">No coding CLI with a terminal installed.</p>
            ) : (
              <Select value={choice?.key ?? null} onValueChange={(value) => setChoiceKey(value)}>
                <SelectTrigger className="w-full">
                  <SelectValue>{choice?.label ?? "Choose a CLI"}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {available.map((item) => (
                    <SelectItem key={item.key} value={item.key}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Instances</Label>
            <div className="flex gap-1">
              {COUNTS.map((value) => (
                <Button
                  key={value}
                  type="button"
                  size="icon"
                  variant={value === count ? "default" : "outline"}
                  aria-pressed={value === count}
                  onClick={() => setCount(value)}
                  className="tabular-nums"
                >
                  {value}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Work in</Label>
            <GroupEnvironmentSelect
              value={mode}
              modes={MODES}
              label="Work in"
              className="w-full"
              onChange={setPicked}
            />
          </div>

          {sharesFiles(mode, count) && (
            <Alert variant="warning">
              <AlertDescription className="text-ui-xs">
                All {count} instances edit the same files.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={!selected || !rootPath || launching}
            onClick={() => void handleLaunch()}
          >
            {launching ? "Starting" : `Launch ${count}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
