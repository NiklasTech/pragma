"use client";

import { createContext, useContext, type ReactNode } from "react";

import { normalizeCode, type ResolvedApplyTarget } from "../context/applyTargets";

const EMPTY_TARGETS: ReadonlyMap<string, ResolvedApplyTarget> = new Map();

const ChatApplyContext = createContext<ReadonlyMap<string, ResolvedApplyTarget>>(EMPTY_TARGETS);

export function ChatApplyProvider({
  targets,
  children,
}: {
  targets: ReadonlyMap<string, ResolvedApplyTarget>;
  children: ReactNode;
}) {
  return <ChatApplyContext.Provider value={targets}>{children}</ChatApplyContext.Provider>;
}

export function useChatApplyTarget(code: string): ResolvedApplyTarget | undefined {
  return useContext(ChatApplyContext).get(normalizeCode(code));
}
