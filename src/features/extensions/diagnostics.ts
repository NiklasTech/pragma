import {
  EXTENSION_SOURCE_PREFIX,
  useProblemsStore,
  type Problem,
  type ProblemSeverity,
} from "@/shared/stores/problems";

import { callExtension } from "./calls";
import { asRecord } from "./params";
import { providersFor, useExtensionsStore } from "./store";

const DIAGNOSTICS_TIMEOUT_MS = 5000;
const MAX_DIAGNOSTICS = 500;
const MAX_MESSAGE_LENGTH = 2000;

export interface ExtensionDocument {
  path: string;
  language: string | null;
  text: string;
}

export function extensionSource(extensionId: string): string {
  return `${EXTENSION_SOURCE_PREFIX}${extensionId}`;
}

function positiveInt(value: unknown, fallback?: number): number | undefined {
  if (value === undefined) return fallback;
  return typeof value === "number" && Number.isInteger(value) && value >= 1 ? value : undefined;
}

/// Turns a provider's answer into problems; malformed entries are dropped.
export function validateDiagnostics(value: unknown, path: string, extensionId: string): Problem[] {
  if (!Array.isArray(value)) return [];
  const problems: Problem[] = [];
  for (const entry of value.slice(0, MAX_DIAGNOSTICS)) {
    const record = asRecord(entry);
    if (!record || typeof record.message !== "string" || !record.message) continue;
    const line = positiveInt(record.line);
    const column = positiveInt(record.column, 1);
    if (line === undefined || column === undefined) continue;
    const severity: ProblemSeverity =
      record.severity === "error" || record.severity === "info" ? record.severity : "warning";
    const problem: Problem = {
      id: `${extensionSource(extensionId)}:${path}:${problems.length}`,
      severity,
      message: record.message.slice(0, MAX_MESSAGE_LENGTH),
      filePath: path,
      line,
      column,
      source: extensionSource(extensionId),
    };
    const endLine = positiveInt(record.endLine);
    const endColumn = positiveInt(record.endColumn);
    if (endLine !== undefined) problem.endLine = endLine;
    if (endColumn !== undefined) problem.endColumn = endColumn;
    problems.push(problem);
  }
  return problems;
}

/// Asks every diagnostics provider for the document's language and stores the answers per extension.
export async function runExtensionDiagnostics(document: ExtensionDocument): Promise<void> {
  const providers = providersFor(
    useExtensionsStore.getState().diagnosticsProviders,
    document.language,
  );
  const byExtension = new Map<string, Problem[]>();
  await Promise.all(
    providers.map(async (provider) => {
      try {
        const result = await callExtension(
          provider.extensionId,
          "diagnostics.provide",
          { providerId: provider.id, document },
          DIAGNOSTICS_TIMEOUT_MS,
        );
        const problems = validateDiagnostics(result, document.path, provider.extensionId);
        byExtension.set(provider.extensionId, [
          ...(byExtension.get(provider.extensionId) ?? []),
          ...problems,
        ]);
      } catch {
        // A failing provider keeps its previous diagnostics.
      }
    }),
  );
  const problems = useProblemsStore.getState();
  for (const [extensionId, items] of byExtension) {
    problems.setSourceDiagnostics(document.path, extensionSource(extensionId), items);
  }
}
