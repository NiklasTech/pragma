import { invoke } from "@tauri-apps/api/core";
import { create } from "zustand";

import {
  sessionStartRequest,
  useAcpSessionOptionsStore,
  type AcpConfigOption,
} from "./sessionOptions";

/// A way to sign in that the coding CLI runs itself, e.g. a browser login.
export interface AcpSignInMethod {
  id: string;
  name: string;
  description: string | null;
}

interface SignInState {
  methods: Record<string, AcpSignInMethod[]>;
  pending: Record<string, boolean>;
  errors: Record<string, string | null>;
  /** Whether the chat's agent asked for a sign-in; keeps the methods it offers. */
  check: (chatSessionId: string) => Promise<boolean>;
  signIn: (
    providerId: string,
    chatSessionId: string,
    cwd: string,
    allowChildSessions: boolean,
    methodId: string,
  ) => Promise<void>;
}

export const useAcpSignInStore = create<SignInState>()((set) => ({
  methods: {},
  pending: {},
  errors: {},

  check: async (chatSessionId) => {
    const methods = await invoke<AcpSignInMethod[]>("cli_acp_sign_in_methods", {
      req: { chat_session_id: chatSessionId },
    }).catch(() => []);
    set((state) => ({ methods: { ...state.methods, [chatSessionId]: methods } }));
    return methods.length > 0;
  },

  signIn: async (providerId, chatSessionId, cwd, allowChildSessions, methodId) => {
    set((state) => ({
      pending: { ...state.pending, [chatSessionId]: true },
      errors: { ...state.errors, [chatSessionId]: null },
    }));
    try {
      const options = await invoke<AcpConfigOption[]>("cli_acp_sign_in", {
        req: {
          ...sessionStartRequest(providerId, chatSessionId, cwd, allowChildSessions),
          method_id: methodId,
        },
      });
      useAcpSessionOptionsStore.getState().receive(chatSessionId, options);
      useAcpSessionOptionsStore.setState((state) => ({
        errors: { ...state.errors, [chatSessionId]: null },
      }));
      set((state) => ({ methods: { ...state.methods, [chatSessionId]: [] } }));
    } catch (err) {
      set((state) => ({ errors: { ...state.errors, [chatSessionId]: String(err) } }));
    } finally {
      set((state) => ({ pending: { ...state.pending, [chatSessionId]: false } }));
    }
  },
}));
