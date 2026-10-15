"use client";

import { Tabs, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";

import type { ThreadScope } from "./useScopedThreads";

interface ThreadScopeSwitchProps {
  value: ThreadScope;
  onChange: (scope: ThreadScope) => void;
}

export function ThreadScopeSwitch({ value, onChange }: ThreadScopeSwitchProps) {
  return (
    <Tabs value={value} onValueChange={(next: ThreadScope) => onChange(next)}>
      <TabsList className="w-full" aria-label="Thread scope">
        <TabsTrigger value="repository">This repository</TabsTrigger>
        <TabsTrigger value="all">All repositories</TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
