import { useEffect, useState } from "react";
import { Button } from "@/shared/components/ui/button";
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
import { Textarea } from "@/shared/components/ui/textarea";
import { useGitStore } from "@/shared/stores/git";

/// Creates a tag at `target`, or at HEAD when `target` is null. A message makes it annotated.
export function CreateTagDialog({
  open,
  target,
  onOpenChange,
}: {
  open: boolean;
  target: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const createTag = useGitStore((s) => s.createTag);
  const busy = useGitStore((s) => s.actionBusy === "create-tag");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (open) {
      setName("");
      setMessage("");
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    const created = await createTag(trimmed, target ?? undefined, message.trim() || undefined);
    if (created) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Create tag at {target ? target.slice(0, 7) : "HEAD"}</DialogTitle>
            <DialogDescription>
              Add a message to create an annotated tag. Leave it empty for a lightweight tag.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="git-tag-name">Name</Label>
            <Input
              id="git-tag-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="v1.0.0"
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="git-tag-message">Message (optional)</Label>
            <Textarea
              id="git-tag-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || busy}>
              Create tag
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
