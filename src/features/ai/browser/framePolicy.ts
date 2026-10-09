import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export interface FramePolicy {
  blocked: boolean;
  reason: string | null;
}

/// Whether `url` refuses to be framed; null while unknown, so the frame loads without waiting.
export function useFramePolicy(url: string | null): FramePolicy | null {
  const [policy, setPolicy] = useState<{ url: string; policy: FramePolicy } | null>(null);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    invoke<FramePolicy>("browser_frame_policy", { url })
      .then((result) => {
        if (!cancelled) setPolicy({ url, policy: result });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [url]);

  return policy && policy.url === url ? policy.policy : null;
}
