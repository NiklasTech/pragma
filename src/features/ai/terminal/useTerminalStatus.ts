import { useEffect, useState } from "react";

import { getTerminalStatus, subscribeTerminalStatus, type TerminalStatus } from "./runner";

export function useTerminalStatus(sessionId: string | null): {
  status: TerminalStatus;
  exitCode: number | null;
} {
  const [state, setState] = useState(() => getTerminalStatus(sessionId ?? ""));

  useEffect(() => {
    if (!sessionId) {
      setState({ status: "running", exitCode: null });
      return;
    }
    setState(getTerminalStatus(sessionId));
    return subscribeTerminalStatus(sessionId, () => {
      setState(getTerminalStatus(sessionId));
    });
  }, [sessionId]);

  return state;
}
