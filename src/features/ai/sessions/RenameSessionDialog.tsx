import { create } from "zustand";

import { InputDialog } from "@/shared/components/ui/input-dialog";
import { useAIStore } from "@/shared/stores/ai";

interface RenameSessionState {
  sessionId: string | null;
  open: (sessionId: string) => void;
  close: () => void;
}

/// The session a menu asked to rename, from anywhere in the window.
export const useRenameSessionStore = create<RenameSessionState>()((set) => ({
  sessionId: null,
  open: (sessionId) => set({ sessionId }),
  close: () => set({ sessionId: null }),
}));

export function RenameSessionDialog() {
  const sessionId = useRenameSessionStore((state) => state.sessionId);
  const close = useRenameSessionStore((state) => state.close);
  const title = useAIStore(
    (state) => state.chatSessions.find((session) => session.id === sessionId)?.title ?? "",
  );
  const renameChatSession = useAIStore((state) => state.renameChatSession);

  return (
    <InputDialog
      open={sessionId !== null}
      onOpenChange={(open) => !open && close()}
      title="Rename session"
      label="Name"
      defaultValue={title}
      confirmLabel="Rename"
      onConfirm={(name) => {
        if (sessionId) void renameChatSession(sessionId, name);
      }}
    />
  );
}
