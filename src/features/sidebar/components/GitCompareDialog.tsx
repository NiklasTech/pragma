import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ArrowsLeftRight, Spinner } from "@phosphor-icons/react";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { ScrollArea } from "@/shared/components/ui/scroll-area";
import { useEditorPanelId } from "@/shared/hooks/useEditorPanelId";
import {
  useGitStore,
  type GitCommitFileChange,
  type GitDiffContentResult,
} from "@/shared/stores/git";
import { openGitDiffInSplit } from "../lib/gitDiffSplit";
import { useGitCompareDialog } from "../lib/gitDialogs";
import { FileChangeRow } from "./GitCommitDetailsDialog";

const REFS_LIST_ID = "git-compare-refs";

function shortRef(ref: string): string {
  return /^[0-9a-f]{40,64}$/i.test(ref) ? ref.slice(0, 7) : ref;
}

export function GitCompareDialog() {
  const { open, base: initialBase, head: initialHead, close } = useGitCompareDialog();
  const repoPath = useGitStore((s) => s.repoPath);
  const branches = useGitStore((s) => s.branches);
  const tags = useGitStore((s) => s.tags);
  const loadTags = useGitStore((s) => s.loadTags);
  const editorPanelId = useEditorPanelId();

  const [base, setBase] = useState("");
  const [head, setHead] = useState("");
  const [compared, setCompared] = useState<{ base: string; head: string } | null>(null);
  const [files, setFiles] = useState<GitCommitFileChange[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingDiffPath, setLoadingDiffPath] = useState<string | null>(null);

  const runCompare = useCallback(
    async (baseRef: string, headRef: string) => {
      if (!repoPath || !baseRef.trim() || !headRef.trim()) return;
      setLoading(true);
      setError(null);
      try {
        const result = await invoke<GitCommitFileChange[]>("git_compare_files", {
          repoPath,
          base: baseRef.trim(),
          head: headRef.trim(),
        });
        setFiles(result);
        setCompared({ base: baseRef.trim(), head: headRef.trim() });
      } catch (err) {
        setFiles([]);
        setCompared(null);
        setError(String(err));
      } finally {
        setLoading(false);
      }
    },
    [repoPath],
  );

  useEffect(() => {
    if (!open) return;
    setBase(initialBase);
    setHead(initialHead);
    setFiles([]);
    setCompared(null);
    setError(null);
    void loadTags();
    if (initialBase && initialHead) void runCompare(initialBase, initialHead);
  }, [open, initialBase, initialHead, loadTags, runCompare]);

  const handleViewDiff = async (file: GitCommitFileChange) => {
    if (!repoPath || !compared || loadingDiffPath) return;
    setLoadingDiffPath(file.path);
    try {
      const result = await invoke<GitDiffContentResult>("git_compare_file_diff", {
        repoPath,
        base: compared.base,
        head: compared.head,
        path: file.path,
        originalPath: file.original_path,
      });
      if (result.is_binary) {
        toast.info("Binary file, no diff available");
        return;
      }
      const fileName = file.path.split("/").pop() ?? file.path;
      openGitDiffInSplit(editorPanelId, {
        id: `compare:${compared.base}..${compared.head}:${file.path}`,
        name: `${fileName} (${shortRef(compared.base)}..${shortRef(compared.head)})`,
        path: file.path,
        original: result.original_content,
        modified: result.modified_content,
        patchText: result.fallback_patch,
        staged: false,
      });
      close();
    } catch (err) {
      toast.error(`Failed to load diff: ${String(err)}`);
    } finally {
      setLoadingDiffPath(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-3 overflow-hidden sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Compare</DialogTitle>
          <DialogDescription>
            Files that differ between two branches, tags or commits.
          </DialogDescription>
        </DialogHeader>

        <form
          className="flex items-center gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            void runCompare(base, head);
          }}
        >
          <Input
            value={base}
            onChange={(e) => setBase(e.target.value)}
            placeholder="Base"
            list={REFS_LIST_ID}
            aria-label="Base revision"
            className="h-8 min-w-0 flex-1 font-mono text-ui-sm"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 shrink-0"
            title="Swap"
            aria-label="Swap revisions"
            onClick={() => {
              setBase(head);
              setHead(base);
            }}
          >
            <ArrowsLeftRight size={14} />
          </Button>
          <Input
            value={head}
            onChange={(e) => setHead(e.target.value)}
            placeholder="Compare"
            list={REFS_LIST_ID}
            aria-label="Compared revision"
            className="h-8 min-w-0 flex-1 font-mono text-ui-sm"
          />
          <Button
            type="submit"
            size="sm"
            className="shrink-0"
            disabled={loading || !base.trim() || !head.trim()}
          >
            Compare
          </Button>
          <datalist id={REFS_LIST_ID}>
            <option value="HEAD" />
            {branches.map((branch) => (
              <option key={`branch:${branch.name}`} value={branch.name} />
            ))}
            {tags.map((tag) => (
              <option key={`tag:${tag.name}`} value={tag.name} />
            ))}
          </datalist>
        </form>

        <ScrollArea className="h-full min-h-[200px] rounded border border-border bg-bg-root">
          <div className="p-1">
            {loading && (
              <div className="flex items-center gap-2 px-2 py-3 text-ui-xs text-fg-muted">
                <Spinner size={12} className="animate-spin" />
                Comparing…
              </div>
            )}
            {!loading && error && (
              <div className="px-2 py-3 text-ui-xs text-status-error">{error}</div>
            )}
            {!loading && !error && compared && files.length === 0 && (
              <div className="px-2 py-3 text-ui-xs text-fg-muted">No differences.</div>
            )}
            {!loading &&
              files.map((file) => (
                <FileChangeRow
                  key={file.path}
                  file={file}
                  loading={loadingDiffPath === file.path}
                  onClick={() => void handleViewDiff(file)}
                />
              ))}
          </div>
        </ScrollArea>
        {compared && files.length > 0 && (
          <span className="text-ui-xs text-fg-subtle">
            {files.length} file{files.length === 1 ? "" : "s"} changed from{" "}
            <span className="font-mono">{shortRef(compared.base)}</span> to{" "}
            <span className="font-mono">{shortRef(compared.head)}</span>
          </span>
        )}
      </DialogContent>
    </Dialog>
  );
}
