import { useEffect, useState } from "react";
import { Plus, Tag, Trash } from "@phosphor-icons/react";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { useGitStore } from "@/shared/stores/git";

export function TagsDialog({
  open,
  onOpenChange,
  onCreateTag,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateTag: () => void;
}) {
  const tags = useGitStore((s) => s.tags);
  const loadTags = useGitStore((s) => s.loadTags);
  const deleteTag = useGitStore((s) => s.deleteTag);
  const busy = useGitStore((s) => s.actionBusy === "delete-tag");
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setPendingDelete(null);
      void loadTags();
    }
  }, [open, loadTags]);

  const handleDelete = async (name: string) => {
    await deleteTag(name);
    setPendingDelete(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tags</DialogTitle>
          <DialogDescription>
            Deleting a tag removes it from this repository. Remote copies are not affected.
          </DialogDescription>
        </DialogHeader>
        {tags.length === 0 ? (
          <p className="py-6 text-center text-ui-sm text-fg-muted">No tags yet</p>
        ) : (
          <div className="max-h-72 overflow-y-auto">
            <ul className="flex flex-col">
              {tags.map((tag) => (
                <li
                  key={tag.name}
                  className="group flex h-8 items-center gap-2 rounded-md px-2 hover:bg-bg-hover"
                >
                  <Tag size={14} className="shrink-0 text-fg-subtle" />
                  <span className="truncate text-ui-sm font-medium text-fg-default">
                    {tag.name}
                  </span>
                  <span className="shrink-0 font-mono text-ui-xs text-fg-subtle">
                    {tag.target_sha.slice(0, 7)}
                  </span>
                  {tag.message && (
                    <span className="min-w-0 truncate text-ui-xs text-fg-muted">{tag.message}</span>
                  )}
                  <div className="ml-auto flex shrink-0 items-center gap-1">
                    {pendingDelete === tag.name ? (
                      <>
                        <Button size="xs" variant="ghost" onClick={() => setPendingDelete(null)}>
                          Cancel
                        </Button>
                        <Button
                          size="xs"
                          variant="destructive"
                          disabled={busy}
                          onClick={() => void handleDelete(tag.name)}
                        >
                          Delete
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="icon-xs"
                        variant="ghost"
                        aria-label={`Delete tag ${tag.name}`}
                        title={`Delete tag ${tag.name}`}
                        className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                        onClick={() => setPendingDelete(tag.name)}
                      >
                        <Trash />
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={onCreateTag}>
            <Plus />
            New tag at HEAD
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
