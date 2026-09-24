"use client";

import { Button } from "@/shared/components/ui/button";

import type { ConnectionTestStatus } from "./types";

interface TestConnectionProps {
  testStatus: ConnectionTestStatus;
  testError: string | null;
  configured: boolean;
  onTest: () => void;
}

export function TestConnection({ testStatus, testError, configured, onTest }: TestConnectionProps) {
  return (
    <div className="flex flex-col items-start gap-2 pt-1">
      <Button
        size="sm"
        variant="outline"
        onClick={onTest}
        disabled={testStatus === "loading" || !configured}
      >
        {testStatus === "loading" ? "Testing..." : "Test Connection"}
      </Button>
      {testError && <p className="text-ui-xs text-status-error">{testError}</p>}
    </div>
  );
}
