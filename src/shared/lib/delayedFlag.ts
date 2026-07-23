export interface DelayedFlag {
  update: (loading: boolean) => void;
  dispose: () => void;
}

export function createDelayedFlag(
  onChange: (visible: boolean) => void,
  delayMs = 150,
): DelayedFlag {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let visible = false;

  const setVisible = (next: boolean) => {
    if (next === visible) return;
    visible = next;
    onChange(next);
  };

  const cancelTimer = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  return {
    update(loading: boolean) {
      if (loading) {
        if (timer === null && !visible) {
          timer = setTimeout(() => {
            timer = null;
            setVisible(true);
          }, delayMs);
        }
      } else {
        cancelTimer();
        setVisible(false);
      }
    },
    dispose() {
      cancelTimer();
    },
  };
}
