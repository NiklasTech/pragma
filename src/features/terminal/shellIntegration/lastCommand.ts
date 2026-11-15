import { create } from "zustand";

import type { FinishedCommand } from "./commandTracker";

interface LastCommandState {
  /** The latest command any terminal finished, for the editor's bottom line. */
  last: { command: string; exitCode: number | null } | null;
  record: (command: FinishedCommand) => void;
}

export const useLastCommandStore = create<LastCommandState>()((set) => ({
  last: null,
  record: ({ command, exitCode }) => {
    const text = command.trim();
    if (text) set({ last: { command: text, exitCode } });
  },
}));
