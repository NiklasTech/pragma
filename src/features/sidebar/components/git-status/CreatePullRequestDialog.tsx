import { useEffect, useMemo, useState } from "react";
import { GitPullRequest, Spinner } from "@phosphor-icons/react";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import { Checkbox } from "@/shared/components/ui/checkbox";
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
import { Textarea } from "@/shared/components/ui/textarea";
import { useGitStore } from "@/shared/stores/git";
import {
  createPullRequest,
  loadPrCreateOptions,
  type GhPrCreateOptions,
} from "@/shared/stores/github";

export function CreatePullRequestDialog({
  open,
  onOpenChange,
  repoPath,
  currentBranch,
  defaultTitle,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  repoPath: string;
  currentBranch: string;
  defaultTitle: string;
  onCreated: () => void;
}) {
  const branches = useGitStore((state) => state.branches);
  const [options, setOptions] = useState<GhPrCreateOptions | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [base, setBase] = useState("");
  const [labels, setLabels] = useState<string[]>([]);
  const [draft, setDraft] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    let current = true;
    setOptions(null);
    setTitle(defaultTitle);
    setBody("");
    setBase("");
    setLabels([]);
    setDraft(false);
    loadPrCreateOptions(repoPath)
      .then((loaded) => {
        if (!current) return;
        setOptions(loaded);
        setBody(loaded.template ?? "");
        setBase(loaded.default_branch ?? "");
      })
      .catch((err: unknown) => {
        if (!current) return;
        toast.error(String(err));
        setOptions({ template: null, labels: [], default_branch: null });
      });
    return () => {
      current = false;
    };
  }, [open, repoPath, defaultTitle]);

  const baseOptions = useMemo(() => {
    const names = [options?.default_branch, ...branches.map((branch) => branch.name)];
    return [...new Set(names)].filter(
      (name): name is string => Boolean(name) && name !== currentBranch,
    );
  }, [options, branches, currentBranch]);

  const toggleLabel = (name: string, checked: boolean) => {
    setLabels((prev) => (checked ? [...prev, name] : prev.filter((label) => label !== name)));
  };

  const canSubmit = Boolean(options) && title.trim().length > 0 && base.length > 0 && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const { snapshot, push } = useGitStore.getState();
      if (!snapshot?.repo.upstream || snapshot.ahead > 0) {
        await push();
        const after = useGitStore.getState().snapshot;
        if (!after?.repo.upstream || after.ahead > 0) return;
      }
      const url = await createPullRequest(repoPath, { title, body, base, labels, draft });
      toast.success("Pull request created", {
        action: url
          ? { label: "Open", onClick: () => void invoke("open_external_url", { url }) }
          : undefined,
      });
      onOpenChange(false);
      onCreated();
    } catch (err) {
      toast.error(String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-ui-md">
            <GitPullRequest size={18} className="text-primary" />
            Create Pull Request
          </DialogTitle>
          <DialogDescription className="text-ui-sm">
            Open a pull request for <span className="font-mono font-medium">{currentBranch}</span>.
            Unpushed commits are pushed first.
          </DialogDescription>
        </DialogHeader>

        {!options ? (
          <div className="flex items-center gap-2 py-6 text-ui-sm text-fg-muted">
            <Spinner size={14} className="animate-spin" />
            Loading repository details…
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pr-title">Title</Label>
              <Input
                id="pr-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={256}
                className="text-ui-sm"
                autoFocus
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pr-body">Description</Label>
              <Textarea
                id="pr-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="max-h-64 min-h-32 font-mono text-ui-sm"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Base branch</Label>
              <Select value={base} onValueChange={(value) => setBase(value ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue>{base || "Select a base branch"}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {baseOptions.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {options.labels.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <Label>Labels</Label>
                <div className="grid max-h-32 grid-cols-2 gap-1.5 overflow-y-auto rounded-md border border-border p-2">
                  {options.labels.map((name) => (
                    <label key={name} className="flex min-w-0 items-center gap-2 text-ui-sm">
                      <Checkbox
                        checked={labels.includes(name)}
                        onCheckedChange={(checked) => toggleLabel(name, checked === true)}
                        className="size-3.5"
                      />
                      <span className="truncate">{name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <label className="flex items-center gap-2 text-ui-sm">
              <Checkbox
                checked={draft}
                onCheckedChange={(checked) => setDraft(checked === true)}
                className="size-3.5"
              />
              Create as draft
            </label>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="default" size="sm" disabled={!canSubmit} onClick={() => void submit()}>
            {submitting ? (
              <>
                <Spinner size={12} className="mr-1 animate-spin" />
                Creating…
              </>
            ) : (
              "Create pull request"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
