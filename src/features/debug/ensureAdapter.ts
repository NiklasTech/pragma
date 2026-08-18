import { toast } from "sonner";
import { dapEnsureAdapter, listenDapInstallProgress } from "./client";

/**
 * Make sure the debug adapter for a language (or adapter id) is installed,
 * installing it automatically when missing. Progress events update a single
 * toast. Returns the adapter id on success, null on failure.
 */
export async function ensureAdapterForLanguage(language: string): Promise<string | null> {
  const toastId = `dap-install-${language}`;
  const unlisten = await listenDapInstallProgress((event) => {
    if (event.stage === "done" || event.stage === "error") return;
    const percent =
      event.stage === "downloading" && typeof event.percent === "number"
        ? ` ${event.percent}%`
        : "";
    toast.loading(`${event.message}${percent}`, { id: toastId });
  });

  try {
    const result = await dapEnsureAdapter(language);
    if (result.available) {
      if (result.installed) {
        toast.success(`Installed debug adapter '${result.adapterId}'`, { id: toastId });
      } else {
        toast.dismiss(toastId);
      }
      return result.adapterId;
    }
    toast.error(`Debug adapter '${result.adapterId}' was installed but is still not available`, {
      id: toastId,
    });
    return null;
  } catch (err) {
    toast.error(String(err), { id: toastId });
    return null;
  } finally {
    unlisten();
  }
}
