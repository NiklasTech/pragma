"use client";

import { Button } from "@/shared/components/ui/button";

import { SettingRow } from "../ui/SettingRow";
import type { ConnectionTestStatus } from "./types";

interface TestConnectionProps {
  testStatus: ConnectionTestStatus;
  testError: string | null;
  configured: boolean;
  onTest: () => void;
}

export function TestConnection({ testStatus, testError, configured, onTest }: TestConnectionProps) {
  return (
    <SettingRow
      label="Connection"
      description={
        testError ? (
          <span className="text-status-error">{testError}</span>
        ) : (
          "Send a small request to check the provider responds"
        )
      }
      control={
        <Button
          size="sm"
          variant="outline"
          onClick={onTest}
          disabled={testStatus === "loading" || !configured}
        >
          {testStatus === "loading" ? "Testing..." : "Test Connection"}
        </Button>
      }
    />
  );
}
