import { PencilSimple, Trash } from "@phosphor-icons/react";
import { useState } from "react";

import { Button } from "@/shared/components/ui/button";
import { Textarea } from "@/shared/components/ui/textarea";

import type { ReviewComment } from "./comments";

export function ReviewCommentEditor({
  initialBody = "",
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initialBody?: string;
  submitLabel: string;
  onSubmit: (body: string) => void;
  onCancel: () => void;
}) {
  const [body, setBody] = useState(initialBody);
  const submit = () => {
    if (body.trim()) onSubmit(body.trim());
  };

  return (
    <div className="flex flex-col gap-1.5 font-sans">
      <Textarea
        autoFocus
        value={body}
        placeholder="Leave a comment"
        aria-label="Review comment"
        className="min-h-14 px-2 py-1.5 text-ui-xs"
        onChange={(event) => setBody(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            submit();
          } else if (event.key === "Escape") {
            event.preventDefault();
            onCancel();
          }
        }}
      />
      <div className="flex justify-end gap-1">
        <Button variant="ghost" size="xs" className="text-ui-xs" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="xs" className="text-ui-xs" disabled={!body.trim()} onClick={submit}>
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}

export function ReviewCommentCard({
  comment,
  label,
  onUpdate,
  onRemove,
}: {
  comment: ReviewComment;
  label?: string;
  onUpdate: (body: string) => void;
  onRemove: () => void;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <ReviewCommentEditor
        initialBody={comment.body}
        submitLabel="Save"
        onSubmit={(body) => {
          onUpdate(body);
          setEditing(false);
        }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <div className="group flex items-start gap-1 rounded-md border border-border-subtle bg-bg-root px-2 py-1.5 font-sans">
      <div className="min-w-0 flex-1">
        {label && <div className="truncate text-ui-2xs text-fg-subtle">{label}</div>}
        <p className="text-ui-xs whitespace-pre-wrap text-fg-default">{comment.body}</p>
      </div>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label="Edit comment"
        title="Edit comment"
        onClick={() => setEditing(true)}
      >
        <PencilSimple size={12} />
      </Button>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label="Remove comment"
        title="Remove comment"
        className="hover:text-status-error"
        onClick={onRemove}
      >
        <Trash size={12} />
      </Button>
    </div>
  );
}
