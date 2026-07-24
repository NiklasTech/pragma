import { useEffect, useRef, useState } from "react";

import { createDelayedFlag, type DelayedFlag } from "@/shared/lib/delayedFlag";

export function useDelayedLoading(isLoading: boolean, delayMs = 150): boolean {
  const [visible, setVisible] = useState(false);
  const flagRef = useRef<DelayedFlag | null>(null);

  if (flagRef.current === null) {
    flagRef.current = createDelayedFlag(setVisible, delayMs);
  }

  useEffect(() => {
    flagRef.current?.update(isLoading);
  }, [isLoading]);

  useEffect(() => {
    const flag = flagRef.current;
    return () => flag?.dispose();
  }, []);

  return isLoading && visible;
}
