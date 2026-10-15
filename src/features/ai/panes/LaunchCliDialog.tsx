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
import { useRepositoryWorkspaceSettings } from "@/shared/stores/workspaceSettings/repositories";

import { GroupEnvironmentSelect } from "../sessions/GroupEnvironmentSelect";
import { DEFAULT_GROUP_ENVIRONMENT, sharesFiles, type GroupEnvironment } from "../sessions/group";
import { activateRepository } from "../sessions/openInRepository";
import { RepositorySelect } from "../sessions/RepositoryPicker";
import { useRepositoryChoice } from "../sessions/useRepositoryChoice";
import { buildSessionMenuCliRows } from "../threads/session-menu";
import { launchTerminals } from "./launch";
import { MAX_PANES } from "./operations";

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
  const loadCLIStatuses = useAIStore((state) => state.loadCLIStatuses);
  const [manifestId, setManifestId] = useState<string | null>(null);
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
    if (Object.keys(statuses).length === 0) void loadCLIStatuses();
  }, [loadCLIManifests, loadCLIStatuses, manifests.length, open, statuses]);

  const available = buildSessionMenuCliRows(manifests, statuses).filter(
    (row) => !row.disabled && row.items.some((item) => item.action === "terminal"),
  );
  const selectedId = manifestId ?? available[0]?.manifestId ?? null;
  const selected = manifests.find((manifest) => manifest.id === selectedId);

  const handleLaunch = async () => {
    if (!selected || !rootPath || launching) return;
    setLaunching(true);
    try {
      await launchTerminals(rootPath, selected, count, mode);
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
              <Select value={selectedId} onValueChange={(value) => setManifestId(value)}>
                <SelectTrigger className="w-full">
                  <SelectValue>{selected?.name ?? "Choose a CLI"}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {available.map((row) => (
                    <SelectItem key={row.manifestId} value={row.manifestId}>
                      {row.name}
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
