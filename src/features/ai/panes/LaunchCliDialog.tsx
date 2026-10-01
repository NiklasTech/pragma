"use client";

import { useEffect, useState } from "react";
import { Columns, GridFour, Rows } from "@phosphor-icons/react";
import { toast } from "sonner";

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
import { Tabs, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { useAIStore } from "@/shared/stores/ai";

import { buildSessionMenuCliRows } from "../threads/session-menu";
import { launchTerminals } from "./launch";
import type { PaneArrangement } from "./layout";
import { MAX_PANES } from "./operations";

const COUNTS = Array.from({ length: MAX_PANES }, (_, index) => index + 1);

interface LaunchCliDialogProps {
  rootPath: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LaunchCliDialog({ rootPath, open, onOpenChange }: LaunchCliDialogProps) {
  const manifests = useAIStore((state) => state.cliManifests);
  const statuses = useAIStore((state) => state.cliStatuses);
  const loadCLIManifests = useAIStore((state) => state.loadCLIManifests);
  const loadCLIStatuses = useAIStore((state) => state.loadCLIStatuses);
  const [manifestId, setManifestId] = useState<string | null>(null);
  const [count, setCount] = useState(4);
  const [arrangement, setArrangement] = useState<PaneArrangement>("grid");
  const [launching, setLaunching] = useState(false);

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
    if (!selected || launching) return;
    setLaunching(true);
    try {
      await launchTerminals(rootPath, selected, count, arrangement);
      onOpenChange(false);
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
            <Label>Arrangement</Label>
            <Tabs
              value={arrangement}
              onValueChange={(value: PaneArrangement) => setArrangement(value)}
            >
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="grid">
                  <GridFour size={13} />
                  Grid
                </TabsTrigger>
                <TabsTrigger value="columns">
                  <Columns size={13} />
                  Columns
                </TabsTrigger>
                <TabsTrigger value="rows">
                  <Rows size={13} />
                  Rows
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" disabled={!selected || launching} onClick={() => void handleLaunch()}>
            {launching ? "Starting" : `Launch ${count}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
