import { create } from "zustand";

export type AIEditStatus = "composing" | "awaiting" | "proposed";

export interface AIEditContext {
  originalCode: string;
  filePath: string;
  fileTabId: string;
  language?: string;
  status: AIEditStatus;
}

interface AIEditState {
  edit: AIEditContext | null;
  prefillPrompt: string | null;
  proposedCode: string | null;
}

interface AIEditActions {
  startEdit: (payload: Omit<AIEditContext, "status">) => void;
  consumePrefill: () => void;
  submitPrompt: () => void;
  receiveProposal: (code: string) => void;
  acceptEdit: () => void;
  rejectEdit: () => void;
  cancelEdit: () => void;
}

export const useAIEditStore = create<AIEditState & AIEditActions>((set, get) => ({
  edit: null,
  prefillPrompt: null,
  proposedCode: null,

  startEdit: (payload) => {
    const fileName = payload.filePath.split("/").pop() ?? payload.filePath;
    const language = payload.language ?? "";
    const prefill = `Please edit the following code from ${fileName}:\n\n\`\`\`${language}\n${payload.originalCode}\n\`\`\`\n\n`;

    set({
      edit: { ...payload, status: "composing" },
      prefillPrompt: prefill,
      proposedCode: null,
    });
  },

  consumePrefill: () => {
    if (get().prefillPrompt !== null) {
      set({ prefillPrompt: null });
    }
  },

  submitPrompt: () => {
    const { edit } = get();
    if (!edit || edit.status !== "composing") return;
    set({ edit: { ...edit, status: "awaiting" }, prefillPrompt: null });
  },

  receiveProposal: (code) => {
    const { edit } = get();
    if (!edit || edit.status !== "awaiting") return;
    set({ edit: { ...edit, status: "proposed" }, proposedCode: code });
  },

  acceptEdit: () => {
    set({ edit: null, proposedCode: null, prefillPrompt: null });
  },

  rejectEdit: () => {
    set({ edit: null, proposedCode: null, prefillPrompt: null });
  },

  cancelEdit: () => {
    set({ edit: null, proposedCode: null, prefillPrompt: null });
  },
}));
