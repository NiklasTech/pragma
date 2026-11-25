import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";

import { isLspSupported, LSP_SERVERS } from "@/shared/lib/lsp-servers";

import type { LanguagesState } from "./setupSections";
import { errorText } from "@/shared/lib/errorText";

export type ServerStatus = "checking" | "installed" | "missing" | "error";

export interface ProjectLanguage {
  language: string;
  percentage: number;
}

export interface ProjectLanguages {
  state: LanguagesState;
  languages: ProjectLanguage[];
  statuses: Record<string, ServerStatus>;
  installing: Record<string, boolean>;
  recheck: (language: string) => Promise<void>;
  install: (language: string) => Promise<void>;
}

async function checkServer(language: string): Promise<ServerStatus> {
  try {
    return (await invoke<boolean>("lsp_check_server", { language })) ? "installed" : "missing";
  } catch {
    return "error";
  }
}

/// The languages of the open folder that have a language server, and whether each is installed.
export function useProjectLanguages(rootPath: string | null, enabled: boolean): ProjectLanguages {
  const [languages, setLanguages] = useState<ProjectLanguage[]>([]);
  const [statuses, setStatuses] = useState<Record<string, ServerStatus>>({});
  const [installing, setInstalling] = useState<Record<string, boolean>>({});
  const [scanned, setScanned] = useState<string | null>(null);

  useEffect(() => {
    if (!rootPath || !enabled) return;
    let cancelled = false;
    void (async () => {
      try {
        const detected = await invoke<ProjectLanguage[]>("lsp_detect_project_languages", {
          projectRoot: rootPath,
        });
        const supported = detected.filter(
          (item) => item.percentage >= 5 && isLspSupported(item.language),
        );
        if (cancelled) return;
        setLanguages(supported);
        setStatuses(Object.fromEntries(supported.map((item) => [item.language, "checking"])));
        const checked = await Promise.all(
          supported.map(async (item) => [item.language, await checkServer(item.language)] as const),
        );
        if (cancelled) return;
        setStatuses(Object.fromEntries(checked));
        setScanned(rootPath);
      } catch (err) {
        if (!cancelled) toast.error(errorText(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [rootPath, enabled]);

  const recheck = useCallback(async (language: string) => {
    setStatuses((prev) => ({ ...prev, [language]: "checking" }));
    const status = await checkServer(language);
    setStatuses((prev) => ({ ...prev, [language]: status }));
  }, []);

  const install = useCallback(
    async (language: string) => {
      setInstalling((prev) => ({ ...prev, [language]: true }));
      try {
        const output = await invoke<string>("lsp_install_server", { language });
        toast.success(`Installed ${LSP_SERVERS[language].displayName}`, {
          description: output || undefined,
        });
      } catch (err) {
        toast.error(errorText(err));
      } finally {
        setInstalling((prev) => ({ ...prev, [language]: false }));
        await recheck(language);
      }
    },
    [recheck],
  );

  const current = scanned === rootPath ? languages : [];
  const values = current.map((item) => statuses[item.language] ?? "checking");
  const state: LanguagesState = !enabled
    ? { kind: "off" }
    : !rootPath
      ? { kind: "no-folder" }
      : scanned !== rootPath || values.includes("checking")
        ? { kind: "checking" }
        : {
            kind: "done",
            found: current.length,
            missing: values.filter((status) => status !== "installed").length,
          };

  return { state, languages: current, statuses, installing, recheck, install };
}
