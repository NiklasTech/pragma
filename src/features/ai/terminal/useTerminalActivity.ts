import { useEffect, useState } from "react";

import { ACTIVITY_HOLD_MS, isAgentOutput } from "./activity";
import { getTerminalLastInputAt, subscribeTerminalOutput } from "./runner";

/// True while the terminal's program keeps producing output on its own.
export function useTerminalActivity(sessionId: string | null): boolean {
  const [active, setActive] = useState(false);

  useEffect(() => {
    setActive(false);
    if (!sessionId) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = subscribeTerminalOutput(sessionId, () => {
      if (!isAgentOutput(Date.now(), getTerminalLastInputAt(sessionId))) return;
      setActive(true);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setActive(false), ACTIVITY_HOLD_MS);
    });
    return () => {
      unsubscribe();
      if (timer) clearTimeout(timer);
    };
  }, [sessionId]);

  return active;
}
