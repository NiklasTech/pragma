import { toast } from "sonner";
import { dapInstallAdapter, type DapAdapterInfo, type DapInstallResult } from "./client";

export function installResultSucceeded(result: DapInstallResult): boolean {
  return result.exitCode === 0;
}

export async function installAdapter(adapter: DapAdapterInfo): Promise<boolean> {
  try {
    const result = await dapInstallAdapter(adapter.id);
    if (installResultSucceeded(result)) {
      toast.success(`Installed ${adapter.label}`);
      return true;
    }
    const detail = result.stderr.trim() || `exit code ${result.exitCode}`;
    toast.error(`Failed to install ${adapter.label}: ${detail}`);
    return false;
  } catch (err) {
    toast.error(String(err));
    return false;
  }
}
