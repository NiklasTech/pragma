import { useEffect, useState } from "react";
import { Cpu } from "@phosphor-icons/react";
import { Button } from "@/shared/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/shared/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import {
  ATTACH_ADAPTERS,
  DEFAULT_ATTACH_HOST,
  isAttachAdapter,
  parsePort,
  portAttachConfig,
  processAttachConfig,
  useAttachDialogStore,
  type AttachAdapter,
} from "../attachProcess";
import { dapListProcesses, type DapProcessInfo } from "../client";
import { useDebugStore } from "../store";

export function AttachProcessDialog() {
  const open = useAttachDialogStore((state) => state.open);
  const setOpen = useAttachDialogStore((state) => state.setOpen);
  const [adapter, setAdapter] = useState<AttachAdapter>("node");
  const [host, setHost] = useState(DEFAULT_ATTACH_HOST);
  const [portInput, setPortInput] = useState("");
  const [processes, setProcesses] = useState<DapProcessInfo[]>([]);
  const [processError, setProcessError] = useState<string | null>(null);

  const option = ATTACH_ADAPTERS.find((candidate) => candidate.id === adapter);
  const isProcessAttach = adapter === "lldb";
  const port = portInput.trim() ? parsePort(portInput) : (option?.defaultPort ?? null);

  useEffect(() => {
    if (!open || !isProcessAttach) return;
    let cancelled = false;
    setProcessError(null);
    dapListProcesses()
      .then((list) => {
        if (!cancelled) setProcesses(list);
      })
      .catch((err: unknown) => {
        if (!cancelled) setProcessError(String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [open, isProcessAttach]);

  const attachToPort = () => {
    if (port === null) return;
    setOpen(false);
    void useDebugStore.getState().startSession(portAttachConfig(adapter, host, port));
  };

  const attachToProcess = (process: DapProcessInfo) => {
    setOpen(false);
    void useDebugStore.getState().startSession(processAttachConfig(process.pid, process.name));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Attach to Process</DialogTitle>
          <DialogDescription>
            {isProcessAttach
              ? "Pick a local process to attach the native debugger to."
              : "Connect to a process that is already listening for a debugger."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor="attach-adapter">Debugger</Label>
          <Select
            value={adapter}
            onValueChange={(value) => {
              if (isAttachAdapter(value)) {
                setAdapter(value);
                setPortInput("");
              }
            }}
          >
            <SelectTrigger id="attach-adapter" className="w-full">
              <SelectValue>{option?.label}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {ATTACH_ADAPTERS.map((candidate) => (
                <SelectItem key={candidate.id} value={candidate.id}>
                  {candidate.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isProcessAttach ? (
          <Command className="border border-border-subtle">
            <CommandInput placeholder="Filter by name, command or process id..." />
            <CommandList className="max-h-[300px]">
              <CommandEmpty>{processError ?? "No matching processes."}</CommandEmpty>
              {processes.map((process) => (
                <CommandItem
                  key={process.pid}
                  value={String(process.pid)}
                  keywords={[process.name, process.command]}
                  onSelect={() => attachToProcess(process)}
                >
                  <Cpu size={14} className="shrink-0 text-fg-muted" />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-ui-sm text-fg-default">{process.name}</span>
                    {process.command && (
                      <span className="truncate text-ui-xs text-fg-muted">{process.command}</span>
                    )}
                  </div>
                  <span className="ml-auto text-ui-xs text-fg-subtle">{process.pid}</span>
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        ) : (
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              attachToPort();
            }}
          >
            <div className="flex gap-3">
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="attach-host">Host</Label>
                <Input
                  id="attach-host"
                  value={host}
                  onChange={(event) => setHost(event.target.value)}
                  placeholder={DEFAULT_ATTACH_HOST}
                />
              </div>
              <div className="w-28 space-y-1.5">
                <Label htmlFor="attach-port">Port</Label>
                <Input
                  id="attach-port"
                  autoFocus
                  inputMode="numeric"
                  value={portInput}
                  onChange={(event) => setPortInput(event.target.value)}
                  placeholder={option?.defaultPort ? String(option.defaultPort) : undefined}
                  aria-invalid={port === null}
                />
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={port === null}>
                Attach
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
